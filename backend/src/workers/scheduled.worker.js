/**
 * BullMQ Scheduled Task Worker
 * 
 * Executes scheduled batch maintenance jobs:
 * - LATE_FEE_CALCULATION (Daily 00:00 midnight)
 * - FEE_REMINDER_DISPATCHER (Daily 10:00 AM)
 * 
 * Features:
 * - Strict single concurrency (concurrency: 1) to prevent memory overlap
 * - Observable diagnostics and duration logging
 * - Graceful shutdown
 */

const { Worker, UnrecoverableError } = require('bullmq');
const { QUEUES } = require('../queues/queueManager');
const { getRedisStatus, createIsolatedRedisConnection } = require('../config/redis');
const { runLateFeeCalculation } = require('../jobs/lateFee.job');
const { runFeeReminderDispatcher } = require('../jobs/feeReminder.job');

let scheduledWorker = null;

/**
 * Core business processor for scheduled batch jobs.
 * @param {import('bullmq').Job} job
 */
async function processScheduledJob(job) {
  const { name: jobType, data: payload } = job;
  console.log(`[Worker:Scheduled] Starting execution of job ${job.id} (${jobType})`);

  switch (jobType) {
    case 'LATE_FEE_CALCULATION':
      return await runLateFeeCalculation(payload);

    case 'FEE_REMINDER_DISPATCHER':
      return await runFeeReminderDispatcher(payload);

    default:
      throw new UnrecoverableError(`Unknown scheduled job type: ${jobType}`);
  }
}

/**
 * Initializes and starts the BullMQ Scheduled Worker.
 */
function initScheduledWorker() {
  const status = getRedisStatus();
  if (status.degraded && status.status === 'UNCONFIGURED') {
    return null;
  }

  if (scheduledWorker) {
    return scheduledWorker;
  }

  const connection = createIsolatedRedisConnection('scheduled-worker');
  if (!connection) {
    return null;
  }

  try {
    scheduledWorker = new Worker(QUEUES.SCHEDULED, processScheduledJob, {
      connection,
      concurrency: 1, // Single job at a time per worker instance
    });

    scheduledWorker.on('completed', (job, result) => {
      console.log(`[Worker:Scheduled] Job ${job.id} (${job.name}) completed successfully.`);
    });

    scheduledWorker.on('failed', (job, err) => {
      console.error(`[Worker:Scheduled] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
    });

    scheduledWorker.on('error', (err) => {
      console.warn(`[Worker:Scheduled] Worker connection warning: ${err.message}`);
    });

    console.log('[Worker:Scheduled] BullMQ Scheduled Worker initialized (concurrency: 1).');
    return scheduledWorker;
  } catch (err) {
    console.warn(`[Worker:Scheduled] Failed to initialize scheduled worker: ${err.message}`);
    return null;
  }
}

/**
 * Closes the scheduled worker gracefully.
 */
async function closeScheduledWorker() {
  if (scheduledWorker) {
    await scheduledWorker.close();
    scheduledWorker = null;
  }
}

module.exports = {
  initScheduledWorker,
  closeScheduledWorker,
  processScheduledJob,
};
