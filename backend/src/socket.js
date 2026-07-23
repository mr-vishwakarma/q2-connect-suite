const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

/**
 * Initialize Socket.io on the HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server} io
 */
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = 
          origin.startsWith('http://localhost') ||
          origin.endsWith('.vercel.app') ||
          (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL);

        if (isAllowed) {
          callback(null, origin);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication token required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshTokens');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 Socket connected: ${socket.user.name} (${userId})`);

    // Join user's personal room for targeted notifications
    socket.join(userId);

    // Join hostel room if student
    if (socket.user.role === 'student' && socket.user.studentId) {
      // We'll join hostel room after we get student data
    }

    socket.on('join:hostel', (hostel) => {
      socket.join(`hostel:${hostel}`);
      console.log(`📡 ${socket.user.name} joined hostel room: ${hostel}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

module.exports = initSocket;
