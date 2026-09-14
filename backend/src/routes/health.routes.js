/**
 * Health & Dependency Diagnostic Endpoints (Phase G)
 * 
 * Provides:
 * - GET /api/health/live   -> Liveness Probe (process responsiveness, uptime, heap)
 * - GET /api/health/ready  -> Readiness Probe (deep dependency status for Mongo, Redis, BullMQ)
 * - GET /api/health        -> Backward compatible health check
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getRedisStatus } = require('../config/redis');

/**
 * Liveness Probe: Checks if the Node.js process is alive and responsive.
 * Does NOT depend on external databases or network services.
 */
router.get('/live', (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    success: true,
    status: 'UP',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rssMB: (mem.rss / 1024 / 1024).toFixed(2),
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2),
    },
    requestId: req.requestId,
  });
});

/**
 * Readiness Probe: Checks whether the service is ready to accept user traffic.
 * Inspects MongoDB connection and Redis/BullMQ status.
 */
router.get('/ready', async (req, res) => {
  const startTime = Date.now();
  const dependencies = {};
  let isReady = true;

  // 1. Check MongoDB
  const mongoState = mongoose.connection.readyState;
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoState === 1) {
    try {
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      dependencies.mongodb = {
        status: 'HEALTHY',
        latencyMs: Date.now() - pingStart,
        host: mongoose.connection.host,
      };
    } catch (err) {
      isReady = false;
      dependencies.mongodb = {
        status: 'UNAVAILABLE',
        error: err.message,
      };
    }
  } else {
    isReady = false;
    dependencies.mongodb = {
      status: 'DISCONNECTED',
      state: mongoState,
    };
  }

  // 2. Check Redis & Background Queues
  const redisHealth = getRedisStatus();
  if (redisHealth.ready) {
    dependencies.redis = {
      status: 'HEALTHY',
      configured: true,
    };
  } else if (redisHealth.configured && redisHealth.degraded) {
    dependencies.redis = {
      status: 'DEGRADED',
      configured: true,
      lastError: redisHealth.lastError,
    };
  } else {
    dependencies.redis = {
      status: 'DEGRADED_UNCONFIGURED',
      configured: false,
      note: 'Operating gracefully in degraded fallback mode (inline email dispatch)',
    };
  }

  // 3. ImageKit Media Service Configuration
  const imagekitReady = Boolean(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY);
  dependencies.imagekit = {
    status: imagekitReady ? 'HEALTHY' : 'DEGRADED_UNCONFIGURED',
    configured: imagekitReady,
  };

  // 4. Razorpay Payment Gateway Configuration
  const razorpayReady = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  dependencies.razorpay = {
    status: razorpayReady ? 'HEALTHY' : 'TEST_SIMULATED',
    configured: razorpayReady,
    environment: process.env.RAZORPAY_ENVIRONMENT || 'test',
  };

  const totalDurationMs = Date.now() - startTime;
  const overallStatus = isReady
    ? (dependencies.redis.status === 'HEALTHY' ? 'OPERATIONAL' : 'DEGRADED')
    : 'UNAVAILABLE';

  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    success: isReady,
    status: overallStatus,
    durationMs: totalDurationMs,
    timestamp: new Date().toISOString(),
    dependencies,
    requestId: req.requestId,
  });
});

/**
 * Backward-compatible root health check.
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Q2 Connect Suite API is running 🚀',
    status: 'UP',
    env: process.env.NODE_ENV,
    requestId: req.requestId,
  });
});

module.exports = router;
