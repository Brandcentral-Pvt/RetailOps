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

// Process-level safety nets — log and keep serving, never take the worker down
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection (worker continues)', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});
process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught exception (worker will exit for clean restart)', { error: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 1000).unref();
});

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
// ── F-21 / RB8 / F4: Content-Security-Policy rollout ladder ────────────────
//   1. NOW        — production ALWAYS receives the policy as
//                   Content-Security-Policy-Report-Only (zero breakage; every
//                   violation is surfaced in browser devtools/console for
//                   telemetry). Dev sends no CSP header unless the flag is set.
//   2. NEXT       — watch/collect violation reports, fix directives as needed.
//   3. ENFORCE    — set ENABLE_STRICT_CSP=true to send an enforcing
//                   Content-Security-Policy header instead of report-only.
// Origins below were derived from the frontend bundle:
//   - fonts.googleapis.com / fonts.gstatic.com  → Google Fonts (index.html, index.css)
//   - cdn.jsdelivr.net                          → bootstrap-icons CSS+font, CometChat embed icons
//   - api.keepa.com                             → Keepa is called browser-direct today
//   - *.cometchat.io (+wss)                     → CometChat REST/websocket endpoints
//   - 'unsafe-inline' style-src                 → antd/cssinjs injects inline styles
const ENABLE_STRICT_CSP = process.env.ENABLE_STRICT_CSP === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: (ENABLE_STRICT_CSP || IS_PRODUCTION) ? {
    useDefaults: false,
    // F4: Report-Only by default — enforcing requires ENABLE_STRICT_CSP=true.
    reportOnly: !ENABLE_STRICT_CSP,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // cssinjs/antd require inline styles; fonts CSS loads from Google/jsdelivr.
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'], // ui-avatars, brandfetch, wikimedia, amazon images
      // Chat media (voice notes/call recordings) are served from region-dependent CDNs.
      mediaSrc: ["'self'", 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://api.keepa.com', 'https://*.cometchat.io', 'wss://*.cometchat.io', 'https://*.cometchat.com', 'wss://*.cometchat.com'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
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
// SECURITY (F1 capability URLs): /uploads is PUBLIC BY DESIGN — access
// control for uploaded files is the unguessable filename (see
// utils/safeUploadName.js; all NEW upload names are 192-bit random tokens).
// express.static serves no directory listings by default, and the mount root
// is backend/uploads (not a webroot), so traversal above it is not possible.
// HISTORICAL files keep their pre-hardening names — DB rows referencing them
// are untouched by this change.
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
//
// SECURITY (RB2): the unauthenticated endpoints disclose ONLY liveness/
// readiness status. Detailed diagnostics (pool sizes, Redis state, env,
// versions) moved to /api/health/detailed behind authenticate +
// settings_manage. Docker HEALTHCHECK only inspects the HTTP status of
// /api/health (wget --spider), so the 200/503 semantics below keep it valid.
const { authenticate, requirePermission } = require('./middleware/auth');

async function runHealthChecks() {
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

  return { mem, checks };
}

// Liveness/readiness probe — minimal body by design.
app.get('/api/health', async (req, res) => {
  const { checks } = await runHealthChecks();
  const allOk = Object.values(checks).every(c => c.status === 'connected');
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded' });
});

// Detailed diagnostics — authenticated admins/settings managers only.
app.get('/api/health/detailed', authenticate, requirePermission('settings_manage'), async (req, res) => {
  const { mem, checks } = await runHealthChecks();
  const allOk = Object.values(checks).every(c => c.status === 'connected');
  res.status(200).json({
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
  } catch (_err) {
    // SECURITY (RB2): no error text to unauthenticated callers (may embed DB
    // host/driver detail); detailed failure reason lives in /api/health/detailed.
    res.status(503).json({ status: 'not-ready' });
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

const tokenBlacklist = require('./services/tokenBlacklistService');
const { isGlobalUserRole } = require('./utils/roleUtils');

// True if userId is a participant of conversationId (SQL-backed).
async function isConversationParticipant(conversationId, userId) {
  if (!conversationId || !userId) return false;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('convId', sql.VarChar, conversationId)
      .input('userId', sql.VarChar, userId)
      .query(`SELECT 1 FROM ConversationParticipants WHERE ConversationId = @convId AND UserId = @userId`);
    return result.recordset.length > 0;
  } catch (err) {
    logger.error('Conversation participant check failed', { error: err.message, conversationId });
    return false;
  }
}

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
    // SECURITY (RB1): algorithm pinning — HS256 only.
    decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  } catch (err) {
    socket.disconnect(true);
    return;
  }

  // SECURITY: only access tokens may open a socket session (never refresh/temp tokens)
  if (decoded.type !== 'access') {
    logger.warn('Socket handshake rejected: non-access token type', { userId: decoded.userId });
    socket.disconnect(true);
    return;
  }

  // SECURITY: honor revoked tokens and invalidated sessions
  if (await tokenBlacklist.isBlacklisted(token)) {
    logger.warn('Socket handshake rejected: blacklisted token', { userId: decoded.userId });
    socket.disconnect(true);
    return;
  }
  if (await tokenBlacklist.isUserBlacklisted(decoded.userId, decoded.iat)) {
    logger.warn('Socket handshake rejected: user session invalidated', { userId: decoded.userId });
    socket.disconnect(true);
    return;
  }

  const userId = decoded.userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  // SECURITY: load user fresh from DB — reject unknown/deactivated accounts
  // explicitly instead of letting the IsOnline UPDATE silently affect 0 rows.
  let authUser = null;
  try {
    const authPool = await getPool();
    const authResult = await authPool.request()
      .input('id', sql.VarChar, userId)
      .query(`
        SELECT U.Id, U.IsActive, U.RoleId, R.Name AS RoleName
        FROM Users U
        LEFT JOIN Roles R ON U.RoleId = R.Id
        WHERE U.Id = @id
      `);
    authUser = authResult.recordset[0];
  } catch (err) {
    logger.error('Socket handshake DB check failed', { error: err.message, userId });
    socket.disconnect(true);
    return;
  }

  if (!authUser || !authUser.IsActive) {
    logger.warn('Socket handshake rejected: unknown or deactivated user', { userId });
    socket.disconnect(true);
    return;
  }

  socket.userId = userId;
  socket.userRoleName = authUser.RoleName || null;
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

  // SECURITY: whitelist rooms — only own personal room or assigned-seller
  // rooms. Never allow joining arbitrary conversation/user rooms.
  socket.on('join_room', async (roomId) => {
    try {
      if (typeof roomId !== 'string' || !roomId) return;

      // Own personal room (both naming conventions used in this codebase).
      if (roomId === socket.userId || roomId === `user:${socket.userId}`) {
        socket.join(roomId);
        logger.debug(`Socket ${socket.id} joined room: ${roomId}`);
        return;
      }

      // Seller rooms — require seller assignment or a global-bypass role.
      if (roomId.startsWith('seller:')) {
        const sellerId = roomId.slice('seller:'.length);
        if (!sellerId) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'Room not allowed' });
          logger.warn('Socket join_room denied: empty seller id', { userId: socket.userId });
          return;
        }

        let allowed = isGlobalUserRole(socket.userRoleName);
        if (!allowed) {
          const pool = await getPool();
          const res = await pool.request()
            .input('userId', sql.VarChar, socket.userId)
            .input('sellerId', sql.VarChar, sellerId)
            .query('SELECT 1 FROM UserSellers WHERE UserId = @userId AND SellerId = @sellerId');
          allowed = res.recordset.length > 0;
        }

        if (!allowed) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'Room not allowed' });
          logger.warn('Socket join_room denied: no seller access', { userId: socket.userId, sellerId });
          return;
        }

        socket.join(roomId);
        logger.debug(`Socket ${socket.id} joined room: ${roomId}`);
        return;
      }

      socket.emit('error', { code: 'FORBIDDEN', message: 'Room not allowed' });
      logger.warn('Socket join_room denied: non-whitelisted room', { userId: socket.userId, roomId });
    } catch (err) {
      logger.error('Socket join_room error', { error: err.message, userId: socket.userId });
    }
  });

  // SECURITY: server-side RBAC gate. Mirrors requirePermission's admin bypass
  // (middleware/auth.js): role 'admin'/'super_admin' OR explicit 'roles_manage'
  // permission loaded FRESH from SQL for socket.userId (client identity never trusted).
  const PROTECTED_ROLE_NAMES = ['admin', 'super_admin'];
  socket.on('update_role_permissions', async ({ roleId, permissions } = {}) => {
    try {
      if (typeof roleId !== 'string' || !roleId) return;
      if (permissions !== undefined && !Array.isArray(permissions)) return;

      const pool = await getPool();

      // Load requester's role + permissions fresh from SQL.
      const requesterResult = await pool.request()
        .input('id', sql.VarChar, socket.userId)
        .query(`
          SELECT U.Id, U.RoleId, R.Name AS RoleName, R.IsSystem AS RoleIsSystem
          FROM Users U
          LEFT JOIN Roles R ON U.RoleId = R.Id
          WHERE U.Id = @id
        `);
      const requester = requesterResult.recordset[0];

      if (!requester || !requester.RoleId) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Not authorized to modify role permissions' });
        logger.warn('[SOCKET] update_role_permissions denied: requester has no resolvable role', { userId: socket.userId, roleId });
        return;
      }

      let canManageRoles = requester.RoleName === 'admin'
        || requester.RoleName === 'super_admin';

      if (!canManageRoles && requester.RoleName) {
        const permResult = await pool.request()
          .input('roleId', sql.VarChar, requester.RoleId)
          .input('permName', sql.VarChar, 'roles_manage')
          .query(`
            SELECT 1 FROM Permissions P
            JOIN RolePermissions RP ON P.Id = RP.PermissionId
            WHERE RP.RoleId = @roleId AND P.Name = @permName
          `);
        canManageRoles = permResult.recordset.length > 0;
      }

      if (!canManageRoles) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Not authorized to modify role permissions' });
        logger.warn('[SOCKET] update_role_permissions denied: missing roles_manage/admin', { userId: socket.userId, roleId });
        return;
      }

      // Resolve target role.
      const roleResult = await pool.request()
        .input('roleId', sql.VarChar, roleId)
        .query('SELECT * FROM Roles WHERE Id = @roleId');

      if (roleResult.recordset.length === 0) {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Role not found' });
        logger.warn('[SOCKET] update_role_permissions denied: unknown role', { userId: socket.userId, roleId });
        return;
      }

      const targetRole = roleResult.recordset[0];
      const targetIsSystem = targetRole.IsSystem === 1 || targetRole.IsSystem === true
        || PROTECTED_ROLE_NAMES.includes(String(targetRole.Name || '').toLowerCase());

      // Block protected/system roles on the socket path entirely; block
      // privilege escalation into the requester's OWN role otherwise.
      if (targetIsSystem || String(requester.RoleId) === String(roleId)) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'This role cannot be modified here' });
        logger.warn('[SOCKET] update_role_permissions denied: protected or self role', {
          userId: socket.userId,
          roleId,
          roleName: targetRole.Name,
          isSystem: targetIsSystem,
          isSelfRole: String(requester.RoleId) === String(roleId),
        });
        return;
      }

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

  // SECURITY: identity is always socket.userId; relay requires conversation
  // membership (same participant check as send_message).
  socket.on('typing', async ({ conversationId, isTyping } = {}) => {
    try {
      if (typeof conversationId !== 'string' || !conversationId) return;
      if (!(await isConversationParticipant(conversationId, socket.userId))) {
        logger.warn('Socket typing denied: not a conversation participant', { userId: socket.userId, conversationId });
        return;
      }
      socket.to(conversationId).emit('typing', { conversationId, senderId: socket.userId, isTyping });
    } catch (err) {
      logger.error('Socket typing error', { error: err.message, userId: socket.userId });
    }
  });

  socket.on('send_message', async (data) => {
    try {
      const { conversationId, content, type, fileUrl, replyTo } = data;
      // SECURITY: sender identity comes from the authenticated socket only —
      // never from the client-supplied payload.
      const senderId = socket.userId;
      const pool = await getPool();

      // Check participant (validates socket.userId's membership)
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

  socket.on('add_reaction', async ({ messageId, emoji } = {}) => {
    try {
      if (!messageId || typeof messageId !== 'string') return;
      const pool = await getPool();

      // SECURITY: reactor identity is socket.userId; verify the message exists
      // and that this user belongs to the message's conversation first.
      const convId = await conversationIdFromMessage(messageId);
      if (!convId || !(await isConversationParticipant(convId, socket.userId))) {
        logger.warn('Socket add_reaction denied: not a conversation participant', { userId: socket.userId, messageId });
        return;
      }

      await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .input('uid', sql.VarChar, socket.userId)
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

      io.to(convId).emit('message_reaction_updated', {
        messageId,
        reactions: reactionsResult.recordset
      });
    } catch (err) {
      logger.error('Socket add_reaction error', { error: err.message, userId: socket.userId });
    }
  });

  socket.on('message_read', async ({ messageId } = {}) => {
    try {
      if (!messageId || typeof messageId !== 'string') return;

      // SECURITY: reader identity is socket.userId; require conversation
      // membership before recording read state.
      const convId = await conversationIdFromMessage(messageId);
      if (!convId || !(await isConversationParticipant(convId, socket.userId))) {
        logger.warn('Socket message_read denied: not a conversation participant', { userId: socket.userId, messageId });
        return;
      }

      const pool = await getPool();
      await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .input('userId', sql.VarChar, socket.userId)
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
      logger.error('Socket message_read error', { error: err.message, userId: socket.userId });
    }
  });

  socket.on('invite_to_call', async ({ conversationId, type, receiverId } = {}) => {
    try {
      if (typeof conversationId !== 'string' || !conversationId) return;
      if (!receiverId || typeof receiverId !== 'string') return;

      // SECURITY: caller identity is socket.userId — client value ignored.
      const callerId = socket.userId;
      const pool = await getPool();

      // Validate the call target exists and is active.
      const targetCheck = await pool.request()
        .input('receiverId', sql.VarChar, receiverId)
        .query(`SELECT 1 FROM Users WHERE Id = @receiverId AND IsActive = 1`);
      if (targetCheck.recordset.length === 0) {
        logger.warn('Socket invite_to_call denied: unknown or inactive target', { userId: callerId, receiverId });
        return;
      }

      // Caller must belong to the conversation they are calling from.
      if (!(await isConversationParticipant(conversationId, callerId))) {
        logger.warn('Socket invite_to_call denied: not a conversation participant', { userId: callerId, conversationId });
        return;
      }

      const { generateId } = require('./database/db');
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
      logger.error('Socket invite_to_call error', { error: err.message, userId: socket.userId });
    }
  });

  socket.on('accept_call', async ({ callId } = {}) => {
    try {
      if (!callId || typeof callId !== 'string') return;
      const pool = await getPool();

      // SECURITY: only the callee this call was invited to may accept it.
      const ownerCheck = await pool.request()
        .input('callId', sql.VarChar, callId)
        .input('userId', sql.VarChar, socket.userId)
        .query(`SELECT 1 FROM CallLogs WHERE Id = @callId AND ReceiverId = @userId AND Status = 'INITIATED'`);

      if (ownerCheck.recordset.length === 0) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Call cannot be accepted by this user' });
        logger.warn('Socket accept_call denied: user is not the invited callee', { userId: socket.userId, callId });
        return;
      }

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
      logger.error('Socket accept_call error', { error: err.message, userId: socket.userId });
    }
  });

  socket.on('reject_call', async ({ callId } = {}) => {
    try {
      if (!callId || typeof callId !== 'string') return;
      const pool = await getPool();

      // SECURITY: only a call participant (callee rejecting an initiated
      // call) may reject it.
      const callInfo = await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`SELECT CallerId, ReceiverId FROM CallLogs WHERE Id = @callId AND Status = 'INITIATED'`);

      const callRow = callInfo.recordset[0];
      if (!callRow) return;

      if (socket.userId !== callRow.ReceiverId && socket.userId !== callRow.CallerId) {
        logger.warn('Socket reject_call denied: user is not a call participant', { userId: socket.userId, callId });
        return;
      }

      await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`UPDATE CallLogs SET Status = 'REJECTED' WHERE Id = @callId AND Status = 'INITIATED'`);

      io.to(callRow.CallerId).emit('call_rejected', { callId });
    } catch (err) {
      logger.error('Socket reject_call error', { error: err.message, userId: socket.userId });
    }
  });

  socket.on('end_call', async ({ callId } = {}) => {
    try {
      if (!callId || typeof callId !== 'string') return;
      const pool = await getPool();
      const callResult = await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`SELECT * FROM CallLogs WHERE Id = @callId AND Status = 'ONGOING'`);

      if (callResult.recordset.length === 0) return;

      const call = callResult.recordset[0];

      // SECURITY: only a participant of the ongoing call may end it.
      if (socket.userId !== call.CallerId && socket.userId !== call.ReceiverId) {
        logger.warn('Socket end_call denied: user is not a call participant', { userId: socket.userId, callId });
        return;
      }

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

