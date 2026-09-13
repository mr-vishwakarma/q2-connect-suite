const mongoose = require('mongoose');
const os = require('os');

const systemHealthService = {
  async getSystemHealth() {
    // 1. Measure MongoDB Ping Latency
    const startTime = Date.now();
    let dbStatus = 'DISCONNECTED';
    let dbPingMs = 0;

    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        dbPingMs = Date.now() - startTime;
        dbStatus = 'HEALTHY';
      } else {
        dbStatus = 'CONNECTING';
      }
    } catch (err) {
      dbStatus = 'DEGRADED';
      dbPingMs = -1;
    }

    // 2. Node.js Memory & Process Metrics
    const memUsage = process.memoryUsage();
    const toMB = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

    // 3. Infrastructure Details
    const uptimeSeconds = process.uptime();
    const systemUptimeSeconds = os.uptime();

    // 4. External Services Configuration Check
    const services = {
      imageKit: {
        configured: Boolean(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY),
        status: process.env.IMAGEKIT_PUBLIC_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
      },
      googleOAuth: {
        configured: Boolean(process.env.GOOGLE_CLIENT_ID),
        status: process.env.GOOGLE_CLIENT_ID ? 'CONFIGURED' : 'OPTIONAL',
      },
      emailService: {
        configured: Boolean(process.env.SMTP_HOST || process.env.EMAIL_USER),
        status: (process.env.SMTP_HOST || process.env.EMAIL_USER) ? 'CONFIGURED' : 'MOCK_FALLBACK',
      },
      jwtAuth: {
        configured: Boolean(process.env.JWT_SECRET),
        status: process.env.JWT_SECRET ? 'SECURE' : 'DEFAULT_WARN',
      },
    };

    return {
      status: dbStatus === 'HEALTHY' ? 'OPERATIONAL' : 'DEGRADED',
      timestamp: new Date(),
      uptime: {
        processSeconds: Math.floor(uptimeSeconds),
        formatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${Math.floor(uptimeSeconds % 60)}s`,
      },
      database: {
        status: dbStatus,
        latencyMs: dbPingMs,
        pingLatencyMs: dbPingMs,
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name || 'q2-connect',
        host: mongoose.connection.host || 'localhost',
        connectedHost: mongoose.connection.host || 'localhost',
      },
      memory: {
        rssMB: toMB(memUsage.rss),
        rssMb: toMB(memUsage.rss),
        heapUsedMB: toMB(memUsage.heapUsed),
        heapUsedMb: toMB(memUsage.heapUsed),
        heapTotalMB: toMB(memUsage.heapTotal),
        heapTotalMb: toMB(memUsage.heapTotal),
        externalMB: toMB(memUsage.external),
        externalMb: toMB(memUsage.external),
        systemFreeMB: toMB(os.freemem()),
        systemTotalMB: toMB(os.totalmem()),
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || 'development',
      },
      services,
    };
  },
};

module.exports = { systemHealthService };
