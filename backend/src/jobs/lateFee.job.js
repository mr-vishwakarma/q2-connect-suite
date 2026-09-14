/**
 * Distributed Late Fee Calculation Job
 * 
 * Computes late fees for overdue unpaid/partial fees based on organization & hostel settings.
 * Designed for distributed worker execution:
 * - O(1) in-memory settings lookup map
 * - Cursor-streamed fee queries (batchSize: 500) to ensure strictly bounded V8 heap memory
 * - Batched bulkWrite operations (ordered: false)
 * - Returns execution metrics for observability
 */

const Fee = require('../models/Fee');
const Settings = require('../models/Settings');

/**
 * Runs the late fee calculation job.
 * @param {object} [options] - Optional execution flags
 * @returns {Promise<{ updatedCount: number, processedCount: number, durationMs: number }>}
 */
async function runLateFeeCalculation(options = {}) {
  const startTime = Date.now();
  console.log('[Job: LateFeeCalculation] Starting distributed late fee processing...');

  try {
    const allSettings = await Settings.find({}).lean();
    const settingsMap = new Map();
    allSettings.forEach((s) => {
      const key = s.organizationId ? `${s.organizationId}:${s.hostel}` : s.hostel;
      settingsMap.set(key, s);
      if (!settingsMap.has(s.hostel)) settingsMap.set(s.hostel, s);
    });

    const defaultLateFee = 20;
    const defaultGracePeriod = 5;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 1000 * 60 * 60 * 24;

    // Stream overdue fees via cursor to prevent unbounded memory consumption
    const feeCursor = Fee.find({
      status: { $in: ['unpaid', 'partial'] },
      dueDate: { $ne: null, $lt: today },
    })
      .select('_id hostel organizationId dueDate lateFee')
      .cursor({ batchSize: 500 });

    let bulkOps = [];
    let updatedCount = 0;
    let processedCount = 0;
    const BATCH_SIZE = 500;

    for await (const fee of feeCursor) {
      processedCount++;
      const key = fee.organizationId ? `${fee.organizationId}:${fee.hostel}` : fee.hostel;
      const hostelSettings = settingsMap.get(key) || settingsMap.get(fee.hostel);
      const lateFeePerDay = hostelSettings ? hostelSettings.lateFeePerDay : defaultLateFee;
      const gracePeriodDays = hostelSettings ? hostelSettings.gracePeriodDays : defaultGracePeriod;

      const dueDate = new Date(fee.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const daysLate = Math.floor((today - dueDate) / msPerDay);

      if (daysLate > gracePeriodDays) {
        const penaltyDays = daysLate - gracePeriodDays;
        const newLateFee = penaltyDays * lateFeePerDay;

        if (fee.lateFee !== newLateFee) {
          bulkOps.push({
            updateOne: {
              filter: { _id: fee._id },
              update: { $set: { lateFee: newLateFee } },
            },
          });
          updatedCount++;

          if (bulkOps.length >= BATCH_SIZE) {
            await Fee.bulkWrite(bulkOps, { ordered: false });
            bulkOps = [];
          }
        }
      }
    }

    if (bulkOps.length > 0) {
      await Fee.bulkWrite(bulkOps, { ordered: false });
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Job: LateFeeCalculation] Completed in ${durationMs}ms. Updated ${updatedCount} of ${processedCount} scanned fees.`);

    return { updatedCount, processedCount, durationMs };
  } catch (error) {
    console.error('[Job: LateFeeCalculation] Execution error:', error);
    throw error;
  }
}

module.exports = {
  runLateFeeCalculation,
};
