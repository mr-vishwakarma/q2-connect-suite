require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const initSocket = require('./socket');
const { initCronJobs } = require('./utils/cronJobs');

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

// Connect to MongoDB
connectDB();

const app = express();

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Q2 Connect Suite API is running 🚀', env: process.env.NODE_ENV });
});

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Create HTTP server and attach Socket.io
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

// Attach io to every request (for use in controllers)
app.use((req, res, next) => {
  req.io = io;
  next();
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Q2 Connect Suite Backend running on port ${PORT}`);
  console.log(`📡 Socket.io enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  
  // Initialize cron jobs
  initCronJobs();
});

module.exports = app;
