/**
 * Distributed Queue Manager (BullMQ)
 * 
 * Manages BullMQ Queues with:
 * - Deterministic job IDs for duplicate prevention
 * - Bounded retry policies (exponential backoff)
 * - Strict job retention limits to protect Redis memory
 * - Non-fatal degraded mode fallback if Redis is unavailable
 */

const { Queue } = require('bullmq');
const { getRedisClient, getRedisStatus, createIsolatedRedisConnection } = require('../config/redis');

// Default queue names
const QUEUES = {
  EMAIL: 'email-queue',
  SCHEDULED: 'scheduled-queue',
};

// Standard bounded job configuration
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 24 * 3600, // 24 hours
    count: 500,     // Max 500 completed jobs kept in Redis
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // 7 days
    count: 1000,        // Max 1000 failed jobs kept for operator inspection
  },
};

let emailQueue = null;
let scheduledQueue = null;

/**
 * Initializes BullMQ queues if Redis is available.
 */
function initQueues() {
  const status = getRedisStatus();
  if (status.degraded && status.status === 'UNCONFIGURED') {
    return { emailQueue: null, scheduledQueue: null };
  }

  const connection = getRedisClient();
  if (!connection) {
    return { emailQueue: null, scheduledQueue: null };
  }

  try {
    if (!emailQueue) {
      emailQueue = new Queue(QUEUES.EMAIL, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      emailQueue.on('error', (err) => {
        console.warn(`[Queue: ${QUEUES.EMAIL}] Queue error: ${err.message}`);
      });
    }

    if (!scheduledQueue) {
      scheduledQueue = new Queue(QUEUES.SCHEDULED, {
        connection,
        defaultJobOptions: {
          ...DEFAULT_JOB_OPTIONS,
          attempts: 2, // Scheduled batch tasks retry at most once
        },
      });
      scheduledQueue.on('error', (err) => {
        console.warn(`[Queue: ${QUEUES.SCHEDULED}] Queue error: ${err.message}`);
      });
    }
  } catch (err) {
    console.warn(`[QueueManager] Error initializing BullMQ queues: ${err.message}`);
  }

  return { emailQueue, scheduledQueue };
}

/**
 * Enqueues an email job. If Redis is degraded/unavailable, handles gracefully.
 * 
 * @param {string} jobType - e.g. 'STUDENT_CREDENTIALS', 'FEE_REMINDER', 'PASSWORD_RESET'
 * @param {object} payload - Concise payload (IDs + minimal metadata only)
 * @param {object} options - Optional BullMQ JobOptions (e.g. deterministic jobId)
 */
async function addEmailJob(jobType, payload, options = {}) {
  initQueues();

  if (emailQueue && getRedisStatus().ready) {
    try {
      const job = await emailQueue.add(jobType, payload, {
        ...DEFAULT_JOB_OPTIONS,
        ...options,
      });
      return { success: true, jobId: job.id, queued: true };
    } catch (err) {
      console.warn(`[QueueManager] Failed to enqueue to Redis (${err.message}). Falling back to degraded mode.`);
    }
  }

  // Degraded Mode Fallback:
  // Execute transactional emails in the background without blocking the HTTP request
  const fallbackJobId = `deg-email-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  setImmediate(async () => {
    try {
      const emailUtils = require('../utils/email');
      switch (jobType) {
        case 'STUDENT_CREDENTIALS':
          await emailUtils.sendStudentCredentials(payload);
          break;
        case 'PASSWORD_RESET':
          await emailUtils.sendPasswordResetEmail(payload);
          break;
        case 'MESS_REQUEST_UPDATE':
          await emailUtils.sendMessRequestUpdate(payload);
          break;
        case 'ADMIN_NEW_STUDENT_REGISTERED':
          await emailUtils.sendAdminNewStudentRegisteredNotification(payload);
          break;
        case 'FEE_REMINDER': {
          const { processEmailJob } = require('../workers/email.worker');
          await processEmailJob({ name: 'FEE_REMINDER', data: payload, id: fallbackJobId });
          break;
        }
        default:
          console.warn(`[QueueManager:Degraded] Unhandled degraded email type: ${jobType}`);
      }
    } catch (err) {
      console.error(`[QueueManager:Degraded] Fallback email dispatch failed: ${err.message}`);
    }
  });

  return {
    success: true,
    jobId: fallbackJobId,
    queued: false,
    degraded: true,
  };
}

/**
 * Enqueues a scheduled batch job.
 * 
 * @param {string} jobType - 'LATE_FEE_CALCULATION' or 'FEE_REMINDER_DISPATCHER'
 * @param {object} payload - Bounded payload
 * @param {object} options - BullMQ JobOptions (e.g. repeat or jobId)
 */
async function addScheduledJob(jobType, payload = {}, options = {}) {
  initQueues();

  if (scheduledQueue && getRedisStatus().ready) {
    try {
      const job = await scheduledQueue.add(jobType, payload, {
        ...DEFAULT_JOB_OPTIONS,
        ...options,
      });
      return { success: true, jobId: job.id, queued: true };
    } catch (err) {
      console.warn(`[QueueManager] Scheduled job enqueue warning: ${err.message}`);
    }
  }

  return {
    success: false,
    queued: false,
    degraded: true,
    message: 'Redis unavailable; scheduled job queued in degraded state',
  };
}

/**
 * Retrieves summary metrics of queues for health checks and observability.
 */
async function getQueueMetrics() {
  const status = getRedisStatus();
  if (!status.ready || !emailQueue) {
    return {
      status: status.degraded ? 'DEGRADED' : 'UNCONFIGURED',
      emailQueue: { waiting: 0, active: 0, completed: 0, failed: 0 },
      scheduledQueue: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };
  }

  try {
    const [emailCounts, scheduledCounts] = await Promise.all([
      emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
      scheduledQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
    ]);

    return {
      status: 'HEALTHY',
      emailQueue: emailCounts,
      scheduledQueue: scheduledCounts,
    };
  } catch (err) {
    return {
      status: 'DEGRADED',
      error: err.message,
    };
  }
}

/**
 * Gracefully shuts down queues.
 */
async function closeQueues() {
  const promises = [];
  if (emailQueue) {
    promises.push(emailQueue.close().catch(() => {}));
    emailQueue = null;
  }
  if (scheduledQueue) {
    promises.push(scheduledQueue.close().catch(() => {}));
    scheduledQueue = null;
  }
  await Promise.allSettled(promises);
}

module.exports = {
  QUEUES,
  DEFAULT_JOB_OPTIONS,
  initQueues,
  addEmailJob,
  addScheduledJob,
  getQueueMetrics,
  closeQueues,
};
