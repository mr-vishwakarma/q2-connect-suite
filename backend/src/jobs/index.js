/**
 * Background System Orchestrator & Lifecycle Manager
 * 
 * Coordinates:
 * - Redis connection initialization
 * - Queue initialization
 * - BullMQ Workers lifecycle
 * - Distributed scheduler initialization
 * - Unified graceful shutdown
 */

const { getRedisClient, getRedisStatus, closeRedisConnections } = require('../config/redis');
const { initQueues, closeQueues } = require('../queues/queueManager');
const { initEmailWorker, closeEmailWorker } = require('../workers/email.worker');
const { initScheduledWorker, closeScheduledWorker } = require('../workers/scheduled.worker');
const { initDistributedScheduler } = require('../schedulers/distributedScheduler');

let isInitialized = false;

/**
 * Boots the distributed background processing architecture.
 */
async function initBackgroundSystem() {
  if (isInitialized) {
    return;
  }

  console.log('\n🔄 Initializing Q2 Distributed Background Architecture...');
  const redisStatus = getRedisStatus();

  if (!redisStatus.configured) {
    console.log('ℹ️  REDIS_URL not configured. Background queue system running in DEGRADED mode.');
    console.log('   (Transactional emails will be delivered inline/asynchronously; distributed scheduled crons inactive).\n');
    isInitialized = true;
    return;
  }

  // 1. Initialize Queues
  initQueues();

  // 2. Initialize Workers
  initEmailWorker();
  initScheduledWorker();

  // 3. Initialize Distributed Repeatable Scheduler
  await initDistributedScheduler();

  isInitialized = true;
  console.log('✅ Q2 Distributed Background System initialized successfully.\n');
}

/**
 * Gracefully shuts down all workers, queues, and Redis connections.
 */
async function shutdownBackgroundSystem() {
  console.log('\n🛑 Gracefully shutting down distributed background workers and queues...');
  try {
    await Promise.allSettled([
      closeEmailWorker(),
      closeScheduledWorker(),
      closeQueues(),
    ]);
    await closeRedisConnections();
    console.log('✅ All background workers, queues, and Redis connections closed cleanly.');
  } catch (err) {
    console.error('⚠️ Error during background system shutdown:', err.message);
  }
}

module.exports = {
  initBackgroundSystem,
  shutdownBackgroundSystem,
};
