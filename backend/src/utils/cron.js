const cron = require('node-cron');
const Fee = require('../models/Fee');
const Settings = require('../models/Settings');

// Run every midnight at 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily cron job for late fee calculation...');
  try {
    const allSettings = await Settings.find({}).lean();
    // O(1) in-memory settings lookup map: organizationId:hostel or hostel code
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
    const BATCH_SIZE = 500;

    for await (const fee of feeCursor) {
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

    console.log(`Successfully updated late fees for ${updatedCount} records via bulkWrite.`);
  } catch (error) {
    console.error('Error in late fee cron job:', error);
  }
});

console.log('Late fee calculation cron job scheduled.');
