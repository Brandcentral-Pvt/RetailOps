require('dotenv').config();
const globalTimezone = process.env.AUTOMATION_TIMEZONE || 'Asia/Kolkata';
process.env.TZ = globalTimezone;

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getPool, sql } = require('./database/db');
const logger = require('./utils/logger');
const { v4: uuidv4 } = require('uuid');
const { errorHandler } = require('./utils/errors');

// ── Resilience: never let a transient infra failure (DB / Redis / network)
//    take the whole process down. Log loudly and keep serving. ──
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: (reason && (reason.message || reason)) || 'Unknown rejection',
    stack: reason?.stack,
  });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    error: err?.message || String(err),
    stack: err?.stack,
  });
});

// Memory monitoring - reduced frequency to every 30 minutes
setInterval(() => {
  const mem = process.memoryUsage();
  const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(mem.heapTotal / 1024 / 1024);
  const percent = Math.round((heapUsed / heapTotal) * 100);

  if (percent > 85) {
    logger.warn(`High memory usage: ${heapUsed}MB / ${heapTotal}MB (${percent}%)`);
    if (global.gc) {
      logger.info('Running emergency garbage collection...');
      global.gc();
    }
  }
}, 30 * 60 * 1000);

const asyncLocalStorage = require('./utils/asyncStorage');
const apiCallLogger = require('./middleware/apiCallLogger');

const app = express();
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const store = { req, logged: false, requestId };
  asyncLocalStorage.run(store, () => {
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
});
app.set('trust proxy', 1); // Trust the first proxy (e.g. Nginx) to securely read X-Forwarded-For headers
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://10.0.2.2:3001',
    'http://10.0.2.2:8081',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
const { createLimiter, TIERS } = require('./middleware/rateLimiter');
const globalLimiter = createLimiter('READ');
app.use(globalLimiter);

// HTTPS redirect in production
const httpsRedirect = require('./middleware/httpsRedirect');
app.use(httpsRedirect);

const strictLimiter = createLimiter('STRICT');
const bulkLimiter = createLimiter('BULK');

// 1000 users support: Shrink payload limit to save Memory
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(apiCallLogger);
const path = require('path');
const requestGuard = require('./middleware/requestGuard');
app.use(requestGuard);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/tools', express.static(path.join(__dirname, 'public')));

// SQL Server connection verification
async function verifySqlConnection() {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as test');
    logger.info('SQL Server connected successfully');
  } catch (err) {
    logger.error('SQL Server connection error', { error: err.message });
    logger.warn('Server will continue, but SQL-dependent features will not work');
  }
}

verifySqlConnection();

async function loadAutomationSetting() {
  const isEnabled = process.env.AUTOMATION_ENABLED !== 'false';
  process.env.AUTOMATION_ENABLED = isEnabled ? 'true' : 'false';
  logger.info(`Automation is ${isEnabled ? 'ENABLED' : 'DISABLED'} globally`);
}

loadAutomationSetting();

// Structured Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      userId: req.user?.Id || req.user?._id || null,
      ip: req.ip || req.headers?.['x-forwarded-for'],
    });
  });
  next();
});

// ── Health check endpoints ──
// Registered BEFORE the app-level routers so they are not shadowed by
// alertsRoutes' /api/health, and so /api/health/liveness + /api/health/readiness
// are not intercepted by growthExecutionRoutes' router.use(protect).
app.get('/api/health', async (req, res) => {
  const mem = process.memoryUsage();
  const checks = {};

  // DB check
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as test');
    checks.database = { status: 'connected', poolSize: pool.size, poolAvailable: pool.available };
  } catch (err) {
    checks.database = { status: 'disconnected', error: err.message };
  }

  // Redis check — raw TCP PING so it also works with older Redis 3.x
  // (the `redis` client's HELLO command is unsupported below Redis 6).
  try {
    const net = require('net');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(redisUrl);
    const port = Number(parsed.port) || 6379;
    const host = parsed.hostname || 'localhost';
    await new Promise((resolve, reject) => {
      const socket = net.createConnection(port, host);
      socket.setTimeout(3000);
      socket.once('connect', () => socket.write('PING\r\n'));
      socket.once('data', (data) => {
        socket.destroy();
        if (data.toString().includes('+PONG')) resolve();
        else reject(new Error('Unexpected PING reply: ' + data.toString()));
      });
      socket.once('timeout', () => {
        socket.destroy();
        reject(new Error('PING timeout'));
      });
      socket.once('error', reject);
    });
    checks.redis = { status: 'connected' };
  } catch (err) {
    checks.redis = { status: 'disconnected', error: err.message };
  }

  const allOk = Object.values(checks).every(c => c.status === 'connected');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
    },
    env: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    checks,
  });
});

app.get('/api/health/liveness', (req, res) => {
  res.status(200).json({ status: 'alive', uptime: Math.floor(process.uptime()) });
});

app.get('/api/health/readiness', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as test');
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', error: err.message });
  }
});

// Routes (same as before)
const dataRoutes = require('./routes/dataRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const exportRoutes = require('./routes/exportRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const asinRoutes = require('./routes/asinRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const seedRoutes = require('./routes/seedRoutes');
const revenueCalculatorRoutes = require('./routes/revenueCalculatorRoutes');
const actionRoutes = require('./routes/actionRoutes');
const fileRoutes = require('./routes/fileRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const teamRoutes = require('./routes/teamRoutes');
const rulesetRoutes = require('./routes/rulesetRoutes');
const objectiveRoutes = require('./routes/objectiveRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const marketSyncRoutes = require('./routes/marketDataSyncRoutes');
const growthExecutionRoutes = require('./routes/growthExecutionRoutes');
const systemLogRoutes = require('./routes/systemLogRoutes');
const securityRoutes = require('./routes/securityRoutes');
const setupWizardRoutes = require('./routes/setupWizardRoutes');
const systemSettingRoutes = require('./routes/systemSettingRoutes');
const aiRoutes = require('./routes/aiRoutes');
const sellerAsinTrackerRoutes = require('./routes/sellerAsinTrackerRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
const goalRoutes = require('./routes/goalRoutes');
const asinTableRoutes = require('./routes/asinTableRoutes');
const listingQualityRoutes = require('./routes/listingQualityRoutes');
const bulkRoutes = require('./routes/bulkRoutes');
const taskRoutes = require('./routes/taskRoutes');
const scheduledRunRoutes = require('./routes/scheduledRunRoutes');
const targetRoutes = require('./routes/targetRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const pemsRoutes = require('./routes/pems/pemsRoutes');
const pemsDashboardRoutes = require('./routes/pems/dashboardRoutes');
const pemsLiveSyncRoutes = require('./routes/pems/liveSyncTrackerRoutes');
const liveDataRoutes = require('./routes/pems/liveDataRoutes');
const keywordRoutes = require('./routes/keywordRoutes');
const keywordAnalysisRoutes = require('./routes/keywordAnalysisRoutes');

// Maintenance mode — returns 503 for /api/* when MAINTENANCE_MODE=true
app.use(require('./middleware/maintenanceMode'));

app.use('/api', dataRoutes);
app.use('/api', uploadRoutes);
app.use('/api', alertsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api', rulesetRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/asins', asinRoutes);
app.use('/api/auth', createLimiter('AUTH'), authRoutes);
app.use('/api/users', strictLimiter, userRoutes);
app.use('/api/roles', strictLimiter, roleRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/revenue', revenueCalculatorRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/objectives', objectiveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/market-sync', marketSyncRoutes);
app.use('/api/live-data', liveDataRoutes);
app.use('/api', growthExecutionRoutes);
app.use('/api/logs', systemLogRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/setup-wizard', setupWizardRoutes);
app.use('/api/settings', systemSettingRoutes);
app.use('/api/strategy', aiRoutes);
app.use('/api/seller-tracker', sellerAsinTrackerRoutes);
app.use('/api/revenue-engine', revenueRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/asins-table', asinTableRoutes);
app.use('/api/listing-quality', listingQualityRoutes);
app.use('/api/bulk', bulkLimiter, bulkRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/scheduled-runs', scheduledRunRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/pems', pemsRoutes);
app.use('/api/live-sync-tracker', pemsLiveSyncRoutes);
app.use('/api/keywords', keywordRoutes);
app.use('/api/keyword-analysis', keywordAnalysisRoutes);

// Error handling
app.use(async (err, req, res, next) => {
  try {
    const SystemLogService = require('./services/SystemLogService');
    await SystemLogService.log({
      type: 'SYSTEM_ERROR',
      entityType: 'SERVER',
      user: req.userId || null,
      description: err.isOperational ? err.message : 'Unhandled server error',
      metadata: {
        code: err.code || 'INTERNAL_ERROR',
        url: req.originalUrl,
        method: req.method,
        ip: req.ip || req.headers?.['x-forwarded-for'],
        userId: req.userId || req.user?.Id || null,
      },
    });
  } catch (_) {}

  errorHandler(err, req, res, next);
});

const PORT = process.env.PORT || 3001;
const http = require('http');
// Server Initialization
const server = http.createServer(app);

// Increase timeouts for large data uploads (Octoparse ingestion)
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 610000;
server.headersTimeout = 620000;

// Scheduled jobs
require('./jobs/otpCleanup');

// --- Socket.io Integration ---
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      process.env.FRONTEND_URL,
      /\.brandcentral\.in$/
    ].filter(Boolean),
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize global SocketService
const SocketService = require('./services/socketService');
SocketService.init(io);

// Redis adapter for Socket.IO cluster mode (PM2 multi-instance)
try {
  const { createAdapter } = require('@socket.io/redis-adapter');
  const { createClient } = require('redis');
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter connected');
  }).catch(err => {
    logger.warn('Socket.IO Redis adapter failed (falling back to in-memory)', { error: err.message });
  });
} catch (err) {
  logger.warn('Socket.IO Redis adapter not available (falling back to in-memory)', { error: err.message });
}

if (!io) logger.fatal('Socket.io failed to initialize');

app.set('io', io);

const onlineUsers = new Map();

io.on('connection', async (socket) => {
  // Validate JWT token from handshake
  const token = socket.handshake.auth?.token;
  if (!token) {
    socket.disconnect(true);
    return;
  }
  
  let decoded;
  try {
    const jwt = require('jsonwebtoken');
    const config = require('./config/env');
    if (!config.jwt?.secret) {
      socket.disconnect(true);
      return;
    }
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    socket.disconnect(true);
    return;
  }
  
  const userId = decoded.userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  socket.userId = userId;
  onlineUsers.set(userId, socket.id);

  // Update user status in DB using SQL
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, userId)
    .query("UPDATE Users SET IsOnline = 1, LastSeen = dbo.GetEnvDate() WHERE Id = @id");

  // Get user's assigned sellers to join rooms
  const sellersResult = await pool.request()
    .input('userId', sql.VarChar, userId)
    .query("SELECT SellerId FROM UserSellers WHERE UserId = @userId");

  // Join personal room
  socket.join(userId);

  // Join rooms for each seller
  sellersResult.recordset.forEach(row => {
    socket.join(`seller:${row.SellerId}`);
  });

  io.emit('user_status_change', { userId, status: 'online' });

  socket.on('join_room', (roomId) => {
    if (typeof roomId === 'string') {
      socket.join(roomId);
      logger.debug(`Socket ${socket.id} joined room: ${roomId}`);
    }
  });

  socket.on('update_role_permissions', async ({ roleId, permissions }) => {
    try {
      const pool = await getPool();

      await pool.request()
        .input('roleId', sql.VarChar, roleId)
        .query('DELETE FROM RolePermissions WHERE RoleId = @roleId');

      if (permissions && Array.isArray(permissions)) {
        for (const permId of permissions) {
          await pool.request()
            .input('roleId', sql.VarChar, roleId)
            .input('permId', sql.VarChar, permId)
            .query('INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permId)');
        }
      }

      const roleResult = await pool.request()
        .input('roleId', sql.VarChar, roleId)
        .query('SELECT * FROM Roles WHERE Id = @roleId');

      if (roleResult.recordset.length > 0) {
        const role = roleResult.recordset[0];
        const perms = await pool.request()
          .input('roleId', sql.VarChar, roleId)
          .query('SELECT P.* FROM Permissions P JOIN RolePermissions RP ON P.Id = RP.PermissionId WHERE RP.RoleId = @roleId');

        const formattedRole = {
          _id: role.Id,
          id: role.Id,
          name: role.Name,
          displayName: role.DisplayName,
          description: role.Description,
          level: role.Level || 0,
          color: role.Color || '#4F46E5',
          isSystem: role.IsSystem === 1 || role.IsSystem === true,
          isActive: role.IsActive === 1 || role.IsActive === true,
          createdAt: role.CreatedAt,
          updatedAt: role.UpdatedAt,
          permissions: perms.recordset.map(p => ({
            _id: p.Id,
            id: p.Id,
            name: p.Name,
            displayName: p.DisplayName,
            description: p.Description,
            category: p.Category,
            action: p.Action
          }))
        };

        io.emit('role_permissions_updated', formattedRole);
      }
    } catch (err) {
      logger.error('Socket update_role_permissions error', { error: err.message });
    }
  });

  socket.on('typing', ({ conversationId, senderId, isTyping }) => {
    socket.to(conversationId).emit('typing', { conversationId, senderId, isTyping });
  });

  socket.on('send_message', async (data) => {
    try {
      const { conversationId, senderId, content, type, fileUrl, replyTo } = data;
      const pool = await getPool();

      // Check participant
      const partCheck = await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('userId', sql.VarChar, senderId)
        .query(`SELECT 1 FROM ConversationParticipants WHERE ConversationId = @convId AND UserId = @userId`);

      if (partCheck.recordset.length === 0) {
        return; // Not authorized
      }

      const messageId = require('crypto').randomUUID().replace(/-/g, '').substring(0, 24);

      await pool.request()
        .input('Id', sql.VarChar, messageId)
        .input('ConversationId', sql.VarChar, conversationId)
        .input('SenderId', sql.VarChar, senderId)
        .input('Type', sql.NVarChar, type || 'TEXT')
        .input('Content', sql.NVarChar, content)
        .input('FileUrl', sql.NVarChar, fileUrl || null)
        .input('ReplyToId', sql.VarChar, replyTo || null)
        .query(`
          INSERT INTO Messages (Id, ConversationId, SenderId, Type, Content, FileUrl, ReplyToId, CreatedAt)
          VALUES (@Id, @ConversationId, @SenderId, @Type, @Content, @FileUrl, @ReplyToId, dbo.GetEnvDate())
        `);

      await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('msgId', sql.VarChar, messageId)
        .query(`UPDATE Conversations SET LastMessageId = @msgId, UpdatedAt = dbo.GetEnvDate() WHERE Id = @convId`);

      const msgResult = await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .query(`
          SELECT m.*, u.FirstName, u.LastName, u.Avatar
          FROM Messages m
          JOIN Users u ON m.SenderId = u.Id
          WHERE m.Id = @msgId
        `);

      const populatedMessage = msgResult.recordset[0];
      io.to(conversationId).emit('receive_message', populatedMessage);
    } catch (err) {
      logger.error('Socket send_message error', { error: err.message });
    }
  });

  socket.on('add_reaction', async ({ messageId, emoji, userId }) => {
    try {
      const pool = await getPool();
      const { sql } = require('./database/db');

      await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .input('uid', sql.VarChar, userId)
        .input('emoji', sql.NVarChar, emoji)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM MessageReactions WHERE MessageId = @msgId AND UserId = @uid AND Emoji = @emoji
          )
          BEGIN
            INSERT INTO MessageReactions (MessageId, UserId, Emoji, CreatedAt)
            VALUES (@msgId, @uid, @emoji, dbo.GetEnvDate())
          END
        `);

      const reactionsResult = await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .query(`SELECT Emoji, COUNT(*) as count FROM MessageReactions WHERE MessageId = @msgId GROUP BY Emoji`);

      const convId = await conversationIdFromMessage(messageId);
      if (convId) {
        io.to(convId).emit('message_reaction_updated', {
          messageId,
          reactions: reactionsResult.recordset
        });
      }
    } catch (err) {
      logger.error('Socket add_reaction error', { error: err.message });
    }
  });

  socket.on('message_read', async ({ messageId, userId }) => {
    try {
      const pool = await getPool();
      await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .input('userId', sql.VarChar, userId)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM MessageStatus WHERE MessageId = @msgId AND UserId = @userId
          )
          BEGIN
            INSERT INTO MessageStatus (MessageId, UserId, IsRead, ReadAt)
            VALUES (@msgId, @userId, 1, dbo.GetEnvDate())
          END
        `);
    } catch (err) {
      logger.error('Socket message_read error', { error: err.message });
    }
  });

  socket.on('invite_to_call', async ({ conversationId, callerId, type, receiverId }) => {
    try {
      const pool = await getPool();
      const { sql, generateId } = require('./database/db');
      const callId = generateId();

      await pool.request()
        .input('Id', sql.VarChar, callId)
        .input('ConversationId', sql.VarChar, conversationId)
        .input('CallerId', sql.VarChar, callerId)
        .input('ReceiverId', sql.VarChar, receiverId)
        .input('Type', sql.NVarChar, type)
        .input('Status', sql.NVarChar, 'INITIATED')
        .query(`
          INSERT INTO CallLogs (Id, ConversationId, CallerId, ReceiverId, Type, Status, StartedAt)
          VALUES (@Id, @ConversationId, @CallerId, @ReceiverId, @Type, @Status, dbo.GetEnvDate())
        `);

      io.to(receiverId).emit('incoming_call', { callId, conversationId, callerId, type, status: 'INITIATED' });
      socket.emit('call_initiated', { callId, conversationId, callerId, type, status: 'INITIATED' });
    } catch (err) {
      logger.error('Socket invite_to_call error', { error: err.message });
    }
  });

  socket.on('accept_call', async ({ callId }) => {
    try {
      const pool = await getPool();
      await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`UPDATE CallLogs SET Status = 'ONGOING', StartedAt = dbo.GetEnvDate() WHERE Id = @callId AND Status = 'INITIATED'`);

      const callResult = await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`
          SELECT cl.*, u1.FirstName + ' ' + u1.LastName as callerName, u2.FirstName + ' ' + u2.LastName as receiverName
          FROM CallLogs cl
          JOIN Users u1 ON cl.CallerId = u1.Id
          JOIN Users u2 ON cl.ReceiverId = u2.Id
          WHERE cl.Id = @callId
        `);

      const call = callResult.recordset[0];
      if (call) {
        io.to(call.CallerId).emit('call_accepted', call);
        io.to(call.ReceiverId).emit('call_accepted', call);
      }
    } catch (err) {
      logger.error('Socket accept_call error', { error: err.message });
    }
  });

  socket.on('reject_call', async ({ callId }) => {
    try {
      const pool = await getPool();
      await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`UPDATE CallLogs SET Status = 'REJECTED' WHERE Id = @callId AND Status = 'INITIATED'`);

      const callResult = await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`SELECT CallerId FROM CallLogs WHERE Id = @callId`);

      if (callResult.recordset.length > 0) {
        io.to(callResult.recordset[0].CallerId).emit('call_rejected', { callId });
      }
    } catch (err) {
      logger.error('Socket reject_call error', { error: err.message });
    }
  });

  socket.on('end_call', async ({ callId }) => {
    try {
      const pool = await getPool();
      const callResult = await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`SELECT * FROM CallLogs WHERE Id = @callId AND Status = 'ONGOING'`);

      if (callResult.recordset.length === 0) return;

      const call = callResult.recordset[0];
      const endedAt = new Date();
      const duration = call.StartedAt ? Math.floor((endedAt - new Date(call.StartedAt)) / 1000) : 0;

      await pool.request()
        .input('callId', sql.VarChar, callId)
        .input('duration', sql.Int, duration)
        .query(`UPDATE CallLogs SET Status = 'ENDED', EndedAt = dbo.GetEnvDate(), Duration = @duration WHERE Id = @callId`);

      io.to(call.CallerId).emit('call_ended', { callId, duration });
      if (call.ReceiverId) {
        io.to(call.ReceiverId).emit('call_ended', { callId, duration });
      }
    } catch (err) {
      logger.error('Socket end_call error', { error: err.message });
    }
  });

  socket.on('disconnect', async () => {
    logger.debug('Socket disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      try {
        const pool = await getPool();
        await pool.request()
          .input('id', sql.VarChar, socket.userId)
          .query("UPDATE Users SET IsOnline = 0, LastSeen = dbo.GetEnvDate() WHERE Id = @id");
      } catch (e) { }
      io.emit('user_status_change', { userId: socket.userId, status: 'offline' });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Backend running on port ${PORT}`);

  const isPrimaryWorker = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0';

  if (isPrimaryWorker) {
    const recurringTaskScheduler = require('./services/recurringTaskScheduler');
    recurringTaskScheduler.start();

    const schedulerService = require('./services/schedulerService');
    schedulerService.init();

    // Ensure PEMS event store table
    const eventStore = require('./services/pems/eventStore');
    eventStore.ensureEventStoreTable();

    // Run DB migrations (idempotent; gated by RUN_MIGRATIONS_ON_STARTUP=false)
    // Primary worker only — avoids N concurrent runs in PM2 cluster mode.
    const { runMigrationsAtStartup } = require('./database/migrate');
    runMigrationsAtStartup();

    logger.info('Primary Node Worker [0] — initialized schedulers and background tasks');
  } else {
    logger.info(`Secondary Node Worker [${process.env.NODE_APP_INSTANCE}] — API request handler only`);
  }

  logger.info(`Automation: ${process.env.AUTOMATION_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);

  // Initialize Redis cache
  const cacheService = require('./services/cacheService');
  cacheService.connect();

  // Initialize job queues
  const { initializeQueues } = require('./jobs/queueDefinitions');
  initializeQueues();
  const { registerProcessors } = require('./jobs/processors');
  registerProcessors();

  // Register event handlers
  const { registerEventHandlers } = require('./jobs/eventHandlers');
  registerEventHandlers();
});

// Graceful shutdown — close the Redis cache connection before the process exits.
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal} — shutting down gracefully`);
  try {
    const cacheService = require('./services/cacheService');
    await cacheService.disconnect();
  } catch (err) {
    logger.error('Graceful shutdown error', { error: err.message });
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Make getPool available globally for socket handlers
global.getPool = getPool;
global.sql = sql;

// Helper to get conversation ID from message ID
async function conversationIdFromMessage(messageId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('msgId', sql.VarChar, messageId)
      .query('SELECT ConversationId FROM Messages WHERE Id = @msgId');
    return result.recordset[0]?.ConversationId || '';
  } catch (err) {
    console.error('Failed to get conversationId from messageId:', err.message);
    return '';
  }
}

