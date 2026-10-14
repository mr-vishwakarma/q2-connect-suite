require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const Student = require('../models/Student');

async function reconcile() {
  const isApply = process.argv.includes('--apply');
  console.log('============================================================');
  console.log(`🔧 RECONCILIATION: KARAN SHARMA OCTOBER 2026 RECORD [${isApply ? 'APPLY MODE' : 'DRY RUN'}]`);
  console.log('============================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const student = await Student.findOne({ username: 'karan123' }).lean();
  if (!student) {
    console.error('❌ Student karan123 not found');
    process.exit(1);
  }

  console.log(`Student: ${student.name} (${student.username})`);
  console.log(`Contracted Room Fee: ₹${student.fees}`);
  console.log(`Due Date / Valid Date: ${student.validDate}\n`);

  // Find October 2026 fee record
  const octFee = await Fee.findOne({
    studentId: student._id,
    month: 'October 2026',
  }).lean();

  if (!octFee) {
    console.log('No October 2026 fee found for Karan Sharma.');
    process.exit(0);
  }

  console.log('Current October 2026 Fee Record in DB:');
  console.dir(octFee, { depth: null });

  // Find payments for October 2026
  const octPayments = await FeePayment.find({
    studentId: student._id,
    month: 'October 2026',
  }).lean();

  console.log(`\nPayments associated with October 2026 (${octPayments.length} records):`);
  console.dir(octPayments, { depth: null });

  // Source of truth analysis
  console.log('\n--- SOURCE OF TRUTH ANALYSIS ---');
  console.log(`1. Student contracted rent is ₹5,000, but fee record amount is ₹${octFee.amount}.`);
  console.log('2. The ₹8,000 amount was created by an erroneous test submission where the modal defaulted to ₹8,000.');
  console.log('3. Late fee for Karan Sharma (due 11 Oct 2026) is ₹160.');
  console.log('4. The true outstanding payable for October 2026 is ₹5,000 base + ₹160 late fee = ₹5,160.');

  if (!isApply) {
    console.log('\n💡 DRY RUN COMPLETE. To apply this justified correction and create a backup, run:');
    console.log('   node src/scripts/reconcile_karan_sharma_october.js --apply\n');
    await mongoose.disconnect();
    return;
  }

  // Backup records to disk before modifying
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `backup_karan_october_${Date.now()}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        reason: 'Reconciliation of Karan Sharma October 2026 fee to contracted rent ₹5,000 and unpaid status for browser verification',
        fee: octFee,
        payments: octPayments,
      },
      null,
      2
    )
  );
  console.log(`\n💾 Historical record backed up to: ${backupPath}`);

  // Update October Fee record to true contracted state
  const updatedFee = await Fee.findByIdAndUpdate(
    octFee._id,
    {
      amount: 5000,
      paidAmount: 0,
      lateFee: 160,
      discount: 0,
      status: 'unpaid',
      dueDate: new Date('2026-10-11T00:00:00.000Z'),
      paidDate: null,
      paymentMode: null,
    },
    { new: true }
  );

  console.log('\n✅ Successfully reconciled Karan Sharma October 2026 Fee Record:');
  console.dir(updatedFee.toObject ? updatedFee.toObject() : updatedFee, { depth: null });

  await mongoose.disconnect();
  console.log('\nDatabase connection closed.');
}

reconcile().catch(console.error);
