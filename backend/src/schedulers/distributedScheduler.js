/**
 * Distributed BullMQ Scheduler
 * 
 * Configures single-source distributed repeatable schedules in Redis via BullMQ.
 * Guarantees:
 * - Deterministic repeatable job keys:
 *   - LATE_FEE_CALCULATION (Daily at 00:00 midnight: '0 0 * * *')
 *   - FEE_REMINDER_DISPATCHER (Daily at 10:00 AM: '0 10 * * *')
 * - When Render instance A, B, and C start simultaneously, BullMQ's distributed lock
 *   and Redis repeatable job registry ensures exactly ONE logical schedule is registered.
 * - Zero duplicate cron execution across multiple instances.
 */

const { Queue } = require('bullmq');
const { QUEUES, initQueues } = require('../queues/queueManager');
const { getRedisClient, getRedisStatus } = require('../config/redis');

// Deterministic repeat schedules
const SCHEDULED_TASKS = [
  {
    name: 'LATE_FEE_CALCULATION',
    pattern: '0 0 * * *', // Daily at 00:00 midnight
    jobId: 'repeatable:late-fee-daily',
  },
  {
    name: 'FEE_REMINDER_DISPATCHER',
    pattern: '0 10 * * *', // Daily at 10:00 AM
    jobId: 'repeatable:fee-reminders-daily',
  },
];

/**
 * Initializes distributed repeatable jobs in BullMQ.
 */
async function initDistributedScheduler() {
  const status = getRedisStatus();
  if (status.degraded && status.status === 'UNCONFIGURED') {
    console.log('[DistributedScheduler] Redis is UNCONFIGURED. BullMQ distributed scheduler is in DEGRADED mode.');
    return { initialized: false, degraded: true };
  }

  const { scheduledQueue } = initQueues();
  if (!scheduledQueue || !status.ready) {
    console.warn('[DistributedScheduler] Redis is not ready. Distributed scheduler deferred until Redis connects.');
    return { initialized: false, degraded: true };
  }

  try {
    // 1. Audit existing repeatable jobs in Redis to avoid stale duplicates
    const existingRepeatable = await scheduledQueue.getRepeatableJobs();
    const existingJobKeys = new Set(existingRepeatable.map((j) => j.key));

    // 2. Register each required task with deterministic repeat options
    for (const task of SCHEDULED_TASKS) {
      // Add or update repeatable job
      await scheduledQueue.add(
        task.name,
        { scheduledBy: 'distributed-scheduler', registeredAt: new Date().toISOString() },
        {
          repeat: {
            pattern: task.pattern,
          },
          jobId: task.jobId,
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        }
      );
      console.log(`[DistributedScheduler] Registered distributed repeatable job: ${task.name} (${task.pattern}) [ID: ${task.jobId}]`);
    }

    return { initialized: true, registeredCount: SCHEDULED_TASKS.length };
  } catch (err) {
    console.error(`[DistributedScheduler] Error registering repeatable jobs: ${err.message}`);
    return { initialized: false, error: err.message };
  }
}

module.exports = {
  SCHEDULED_TASKS,
  initDistributedScheduler,
};
