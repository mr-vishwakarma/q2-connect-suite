/**
 * Distributed Fee Reminder Dispatcher Job
 * 
 * Identifies eligible unpaid fees and enqueues individual idempotent email reminder jobs.
 * Replaces the unsafe in-memory OOM loop in cronJobs.js with:
 * - Bounded cursor streaming (batchSize: 250)
 * - Concise projections (no deep populate in dispatcher)
 * - Deterministic job IDs (fee-reminder:{feeId}:{date}) to prevent duplicate scheduling
 * - Durable MongoDB-level idempotency via lastReminderSentAt
 * - Bounded payload passing (IDs only, no large documents in Redis)
 */

const Fee = require('../models/Fee');
const { addEmailJob } = require('../queues/queueManager');

/**
 * Scans unpaid fees and dispatches reminder jobs to the email queue.
 * @param {object} [options]
 * @returns {Promise<{ scannedCount: number, enqueuedCount: number, skippedCount: number, durationMs: number }>}
 */
async function runFeeReminderDispatcher(options = {}) {
  const startTime = Date.now();
  console.log('[Job: FeeReminderDispatcher] Starting distributed fee reminder scan...');

  let scannedCount = 0;
  let enqueuedCount = 0;
  let skippedCount = 0;

  try {
    const today = new Date();
    const currentDateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Stream overdue and unpaid fees with projection
    const feeCursor = Fee.find({
      status: { $in: ['unpaid', 'partial'] },
      $or: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { $lt: twentyFourHoursAgo } },
      ],
    })
      .select('_id studentId organizationId hostel month amount dueDate status lastReminderSentAt')
      .lean()
      .cursor({ batchSize: 250 });

    for await (const fee of feeCursor) {
      scannedCount++;

      // Construct deterministic job ID: unique per fee and date
      const deterministicJobId = `fee-reminder:${fee._id}:${currentDateStr}`;

      // Bounded payload: pass IDs and minimal metadata only
      const emailPayload = {
        type: 'FEE_REMINDER',
        feeId: fee._id.toString(),
        organizationId: fee.organizationId ? fee.organizationId.toString() : null,
        studentId: fee.studentId ? fee.studentId.toString() : null,
        month: fee.month,
        amount: fee.amount,
        reminderDate: currentDateStr,
      };

      try {
        const enqueueResult = await addEmailJob('FEE_REMINDER', emailPayload, {
          jobId: deterministicJobId,
        });

        if (enqueueResult && enqueueResult.success) {
          enqueuedCount++;
        } else {
          skippedCount++;
        }
      } catch (enqueueErr) {
        console.warn(`[Job: FeeReminderDispatcher] Failed to enqueue reminder for fee ${fee._id}:`, enqueueErr.message);
        skippedCount++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Job: FeeReminderDispatcher] Scan finished in ${durationMs}ms. Scanned: ${scannedCount}, Enqueued: ${enqueuedCount}, Skipped: ${skippedCount}`);

    return { scannedCount, enqueuedCount, skippedCount, durationMs };
  } catch (error) {
    console.error('[Job: FeeReminderDispatcher] Dispatcher error:', error);
    throw error;
  }
}

module.exports = {
  runFeeReminderDispatcher,
};
