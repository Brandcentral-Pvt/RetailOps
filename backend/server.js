require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection options
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Connect MongoDB
console.log('🔄 Connecting to MongoDB...');
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easysell', mongoOptions)
  .then(() => {
    console.log('✅ MongoDB Connected successfully');
    console.log(`📦 Database: ${mongoose.connection.name}`);
    initializeDefaults();
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️  Server will run without database connection');
    console.log('💡 Make sure MongoDB is running or check your MONGO_URI');
  });

// MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Routes
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

app.use('/api', dataRoutes);
app.use('/api', uploadRoutes);
app.use('/api', alertsRoutes);
app.use('/api', exportRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/asins', asinRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/revenue', revenueCalculatorRoutes);
app.use('/api/actions', actionRoutes);
const objectiveRoutes = require('./routes/objectiveRoutes');
app.use('/api/objectives', objectiveRoutes);
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const marketSyncRoutes = require('./routes/marketDataSyncRoutes');
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/market-sync', marketSyncRoutes);

const systemLogRoutes = require('./routes/systemLogRoutes');
const systemSettingRoutes = require('./routes/systemSettingRoutes');
app.use('/api/logs', systemLogRoutes);
app.use('/api/settings', systemSettingRoutes);

// AI Routes
const aiRoutes = require('./routes/aiRoutes');
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbState,
    uptime: process.uptime()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('🚨 [GLOBAL ERROR]:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

const PORT = process.env.PORT || 3001;
const http = require('http');
console.log('📡 Creating HTTP server...');
const server = http.createServer(app);

// --- Socket.io Integration ---
console.log('📡 Initializing Socket.io...');
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize global SocketService
const SocketService = require('./services/socketService');
SocketService.init(io);

if (io) {
  console.log('✅ Socket.io initialized successfully');
} else {
  console.error('❌ Socket.io failed to initialize');
}

app.set('io', io);

server.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);

  // Start recurring task scheduler
  const recurringTaskScheduler = require('./services/recurringTaskScheduler');
  recurringTaskScheduler.start();
  console.log('⏰ Recurring task scheduler initialized');
});

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('join', (userId) => {
    socket.userId = userId;
    onlineUsers.set(userId, socket.id);
    socket.join(userId);
    console.log(`👤 User ${userId} joined their private room`);

    // Broadcast user is online
    io.emit('user_status_change', { userId, status: 'online' });

    // Send list of currently online users to the joining user
    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('typing', ({ senderId, recipientId }) => {
    io.to(recipientId).emit('typing', { senderId });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('user_status_change', { userId: socket.userId, status: 'offline' });
    }
  });
});

// Initialize defaults
const initializeDefaults = async () => {
  try {
    // Initialize default alert rules
    const { AlertRule } = require('./models/AlertModel');
    const existingRules = await AlertRule.countDocuments();

    if (existingRules === 0) {
      console.log('🔧 Initializing default alert rules');

      const defaultRules = [
        {
          name: 'Revenue Drop Alert',
          type: 'revenue',
          condition: { metric: 'revenue', operator: 'decrease', value: 10, period: '7d' },
          severity: 'warning',
          active: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          name: 'Low Inventory Alert',
          type: 'inventory',
          condition: { metric: 'stock', operator: '<', value: 50, period: '1d' },
          severity: 'critical',
          active: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          name: 'High ACOS Alert',
          type: 'ads',
          condition: { metric: 'acos', operator: '>', value: 25, period: '7d' },
          severity: 'warning',
          active: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ];

      await AlertRule.insertMany(defaultRules);
      console.log('✅ Default alert rules initialized');
    }

    // Initialize roles and permissions
    const Role = require('./models/Role');
    const Permission = require('./models/Permission');
    const existingRoles = await Role.countDocuments();

    if (existingRoles === 0) {
      console.log('🔧 Initializing roles and permissions');
      await Role.seedDefaultRoles(Permission);
      console.log('✅ Default roles and permissions initialized');
    }

    // Create admin user if not exists
    const User = require('./models/User');
    const existingAdmin = await User.findOne({ email: 'admin@gms.com' });

    if (!existingAdmin) {
      console.log('🔧 Creating admin user');
      const adminRole = await Role.findOne({ name: 'admin' });
      if (adminRole) {
        await User.create({
          email: 'admin@gms.com',
          password: 'admin123',
          firstName: 'Admin',
          lastName: 'User',
          role: adminRole._id,
          isEmailVerified: true,
        });
        console.log('✅ Admin user created (email: admin@gms.com, password: admin123)');
      }
    }

    // Initialize Revenue Calculator data
    const { seedInitialData } = require('./models/RevenueCalculatorModel');
    await seedInitialData();
  } catch (error) {
    console.error('❌ Error initializing defaults:', error);
  }
};
