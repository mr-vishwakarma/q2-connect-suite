const cron = require('node-cron');
const Fee = require('../models/Fee');
const Settings = require('../models/Settings');

// Run every midnight at 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily cron job for late fee calculation...');
  try {
    // We get all distinct hostels from Settings, or we fallback to default
    const allSettings = await Settings.find({});
    
    // Default settings if not configured
    const defaultLateFee = 20;
    const defaultGracePeriod = 5;

    // Get all unpaid or partial fees that have a due date
    const fees = await Fee.find({
      status: { $in: ['unpaid', 'partial'] },
      dueDate: { $ne: null }
    });

    let updatedCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const fee of fees) {
      const hostelSettings = allSettings.find(s => s.hostel === fee.hostel);
      const lateFeePerDay = hostelSettings ? hostelSettings.lateFeePerDay : defaultLateFee;
      const gracePeriodDays = hostelSettings ? hostelSettings.gracePeriodDays : defaultGracePeriod;

      const dueDate = new Date(fee.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const msPerDay = 1000 * 60 * 60 * 24;
      const daysLate = Math.floor((today - dueDate) / msPerDay);

      if (daysLate > gracePeriodDays) {
        // Penalty starts accruing AFTER the grace period.
        // E.g., if grace period is 5 days and daysLate is 6, penalty is 1 * lateFeePerDay.
        const penaltyDays = daysLate - gracePeriodDays;
        const newLateFee = penaltyDays * lateFeePerDay;

        if (fee.lateFee !== newLateFee) {
          fee.lateFee = newLateFee;
          await fee.save();
          updatedCount++;
        }
      }
    }

    console.log(`Successfully updated late fees for ${updatedCount} records.`);
  } catch (error) {
    console.error('Error in late fee cron job:', error);
  }
});

console.log('Late fee calculation cron job scheduled.');
