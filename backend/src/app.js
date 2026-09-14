require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const initSocket = require('./socket');
const { initBackgroundSystem, shutdownBackgroundSystem } = require('./jobs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

// Route imports
const authRoutes = require('./routes/auth.routes');
const studentsRoutes = require('./routes/students.routes');
const roomsRoutes = require('./routes/rooms.routes');
const feesRoutes = require('./routes/fees.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const messRequestsRoutes = require('./routes/messRequests.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const uploadRoutes = require('./routes/upload.routes');
const chatRoutes = require('./routes/chat.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const laundryRoutes = require('./routes/laundry.routes');
const ratingRoutes = require('./routes/rating.routes');
const settingsRoutes = require('./routes/settings.routes');
const superAdminRoutes = require('./routes/superAdmin.routes');
const expensesRoutes = require('./routes/expenses.routes');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');
const healthRoutes = require('./routes/health.routes');
const billingRoutes = require('./routes/billing.routes');
const { requestLogger } = require('./middleware/requestLogger.middleware');
const { requestIdMiddleware } = require('./middleware/requestId.middleware');

// Connect to MongoDB
connectDB();

const app = express();

// Trust proxy required for express-rate-limit behind a reverse proxy (like Render)
app.set('trust proxy', 1);

// Correlation ID middleware (Phase G observability & tracing)
app.use(requestIdMiddleware);

// Compress all responses
app.use(compression());

// Set security HTTP headers
app.use(helmet());

// Global rate limiting (1000 requests per 15 minutes to prevent DoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api', limiter);

// CORS configuration - allow all Vercel domains and local environments
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const isAllowed = 
      origin.startsWith('http://localhost') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.lovable.app') ||
      origin.endsWith('.lovableproject.com') ||
      origin.endsWith('.onrender.com') ||
      (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL);

    if (isAllowed) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Analytics Logger Middleware
app.use(requestLogger);

// Body parsing with rawBody capture for cryptographic signature verification (Razorpay webhooks)
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Anti-caching header middleware for dynamic API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Create HTTP server and initialize Socket.io
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

// Attach io to every request (available inside all controllers)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check & diagnostic routes (Phase G: Liveness & Readiness Probes)
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/mess-requests', messRequestsRoutes);
app.use('/api', feedbackRoutes); // /api/complaints, /api/suggestions
app.use('/api/notifications', notificationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/laundry', laundryRoutes);
app.use('/api/rating', ratingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/subscriptions', billingRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
    },
    message: `Route ${req.originalUrl} not found`,
    requestId: req.requestId,
  });
});

// Centralized Global Error Handler
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = err.errorCode || 'INTERNAL_ERROR';

  // Handle Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for parameter '${err.path}'`;
    errorCode = 'INVALID_ID_FORMAT';
  }

  // Handle Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate entry: '${field}' must be unique`;
    errorCode = 'DUPLICATE_ENTRY';
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
    errorCode = 'VALIDATION_ERROR';
  }

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    console.error(`[UNHANDLED ERROR][${req.requestId || 'no_req_id'}]`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(process.env.NODE_ENV === 'development' && statusCode === 500 ? { stack: err.stack } : {}),
    },
    message, // Backwards compatibility with existing frontends checking res.data.message
    requestId: req.requestId,
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, async () => {
  console.log(`\n🚀 Q2 Connect Suite Backend running on port ${PORT}`);
  console.log(`📡 Socket.io enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  
  // Initialize distributed background job system & repeatable schedules
  initBackgroundSystem().catch(err => console.error('❌ Failed to initialize background system:', err));

  // Seed admin automatically on startup using environment variables
  const User = require('./models/User');
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (adminEmail && adminPassword) {
    User.findOne({ email: adminEmail }).then(admin => {
      if (!admin) {
        console.log('⏳ Seeding admin user automatically...');
        new User({
          name: 'Admin',
          email: adminEmail,
          username: adminEmail.split('@')[0],
          password: adminPassword,
          role: 'admin',
          hostels: ['Q2', 'Q2.0', 'Q2.1']
        }).save().then(() => console.log('✅ Admin user seeded successfully!'))
        .catch(err => console.error('❌ Error seeding admin:', err));
      } else {
        console.log('✅ Admin user already exists.');
      }
    }).catch(err => console.error('❌ Error checking admin:', err));
  }
});

// Graceful Shutdown Handling
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  httpServer.close(async () => {
    console.log('🚪 HTTP server closed.');
    try {
      await shutdownBackgroundSystem();
      const mongoose = require('mongoose');
      await mongoose.connection.close(false);
      console.log('📦 MongoDB connection closed cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('⏰ Forcefully shutting down due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
