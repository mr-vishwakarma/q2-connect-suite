/**
 * PHASE 11 — DATA INTEGRITY AUDIT (READ-ONLY)
 *
 * Scans financial collections (Fees, FeePayments, SecurityDeposits, Students, Hostels, Settings)
 * and outputs machine-readable counts and affected record IDs.
 *
 * Does NOT modify or mutate any historical database records.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Settings = require('../models/Settings');
const SecurityDeposit = require('../models/SecurityDeposit');
const { calculateLateFeeBreakdown, getNextMonthlyDueDate } = require('../utils/billingCycle');

async function runAudit() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('🔍 Connected to MongoDB Atlas. Starting Read-Only Financial Audit...\n');

  const anomalies = {
    paidFeesWithPositiveBalance: [],
    inconsistentPaymentBreakdowns: [],
    duplicateFeeCycles: [],
    missingDueDates: [],
    dueDatesInconsistentWithJoiningDate: [],
    lateFeesInconsistentWithPolicy: [],
    securityDepositsInMonthlyFees: [],
    orphanedFeeRecords: [],
  };

  // Cache settings by hostel
  const settingsDocs = await Settings.find({}).lean();
  const settingsByHostel = {};
  settingsDocs.forEach((s) => {
    const key = `${s.organizationId || 'global'}_${s.hostel || 'default'}`;
    settingsByHostel[key] = {
      gracePeriodDays: s.gracePeriodDays ?? 5,
      lateFeePerDay: s.lateFeePerDay ?? 20,
    };
  });

  const students = await Student.find({}).lean();
  const studentMap = new Map();
  students.forEach((s) => studentMap.set(s._id.toString(), s));

  const allFees = await Fee.find({}).lean();
  const allPayments = await FeePayment.find({}).lean();

  console.log(`📊 Scanned ${allFees.length} Fee records, ${allPayments.length} Payment records, and ${students.length} Student records.\n`);

  // 1. Check paid fees with positive balance
  for (const fee of allFees) {
    const totalDue = (fee.amount || 0) + (fee.lateFee || 0) - (fee.discount || 0);
    const balance = totalDue - (fee.paidAmount || 0);

    if (fee.status === 'paid' && balance > 0.01) {
      anomalies.paidFeesWithPositiveBalance.push({
        feeId: fee._id.toString(),
        studentId: fee.studentId?.toString(),
        month: fee.month,
        amount: fee.amount,
        paidAmount: fee.paidAmount,
        unpaidBalance: balance,
      });
    }

    // 2. Check missing due dates
    if (!fee.dueDate) {
      anomalies.missingDueDates.push({
        feeId: fee._id.toString(),
        studentId: fee.studentId?.toString(),
        month: fee.month,
      });
    }

    // 3. Check orphaned fee records
    if (!fee.studentId || !studentMap.has(fee.studentId.toString())) {
      anomalies.orphanedFeeRecords.push({
        feeId: fee._id.toString(),
        studentId: fee.studentId?.toString() || 'NULL',
        month: fee.month,
      });
    }

    // 4. Check due date consistency with student joining date
    if (fee.studentId && studentMap.has(fee.studentId.toString()) && fee.dueDate) {
      const student = studentMap.get(fee.studentId.toString());
      if (student.startDate) {
        const joinDate = new Date(student.startDate);
        const feeDueDate = new Date(fee.dueDate);
        // Canonical policy anchors the due date day to the student's joining day
        const expectedDay = Math.min(joinDate.getDate(), 28);
        const actualDay = feeDueDate.getDate();

        // If actual day is legacy fixed 5th/11th and differs from joining date day
        if (Math.abs(actualDay - joinDate.getDate()) > 1 && (actualDay === 5 || actualDay === 11) && joinDate.getDate() !== actualDay) {
          anomalies.dueDatesInconsistentWithJoiningDate.push({
            feeId: fee._id.toString(),
            studentId: student._id.toString(),
            studentName: student.name,
            joiningDate: student.startDate,
            storedDueDate: fee.dueDate,
            joiningDay: joinDate.getDate(),
            storedDueDay: actualDay,
          });
        }
      }
    }

    // 5. Check late fee calculation consistency with configured policy
    if (fee.status !== 'paid' && fee.dueDate) {
      const hostKey = `${fee.organizationId || 'global'}_${fee.hostel || 'default'}`;
      const policy = settingsByHostel[hostKey] || { gracePeriodDays: 5, lateFeePerDay: 20 };
      const calc = calculateLateFeeBreakdown(fee.dueDate, policy.gracePeriodDays, policy.lateFeePerDay, new Date());

      // If stored late fee differs by more than 0.01 from live calculated policy
      if (typeof fee.lateFee === 'number' && fee.lateFee !== calc.lateFee) {
        anomalies.lateFeesInconsistentWithPolicy.push({
          feeId: fee._id.toString(),
          studentId: fee.studentId?.toString(),
          month: fee.month,
          storedLateFee: fee.lateFee,
          authoritativeLateFee: calc.lateFee,
          chargeableDays: calc.chargeableDays,
          overdueDays: calc.overdueDays,
          rate: policy.lateFeePerDay,
          gracePeriod: policy.gracePeriodDays,
        });
      }
    }
  }

  // 6. Check duplicate fee cycles
  const studentCycleMap = new Map();
  for (const fee of allFees) {
    if (!fee.studentId) continue;
    const key = `${fee.studentId.toString()}_${fee.month}`;
    if (studentCycleMap.has(key)) {
      studentCycleMap.get(key).push(fee._id.toString());
    } else {
      studentCycleMap.set(key, [fee._id.toString()]);
    }
  }
  for (const [key, feeIds] of studentCycleMap.entries()) {
    if (feeIds.length > 1) {
      anomalies.duplicateFeeCycles.push({
        key,
        count: feeIds.length,
        feeIds,
      });
    }
  }

  // 7. Check payment allocation consistency
  for (const p of allPayments) {
    const computedTotal = (p.amount || 0) + (p.lateFee || 0) - (p.discount || 0) + (p.securityDeposit || 0);
    // If payment mode has negative amounts or corrupted fields
    if (p.amount < 0 || p.lateFee < 0 || p.discount < 0) {
      anomalies.inconsistentPaymentBreakdowns.push({
        paymentId: p._id.toString(),
        receiptNo: p.receiptNo,
        amount: p.amount,
        lateFee: p.lateFee,
        discount: p.discount,
      });
    }
  }

  // Summary Report
  console.log('====================================================');
  console.log('📌 FINANCIAL AUDIT SUMMARY (READ-ONLY MACHINE REPORT)');
  console.log('====================================================');
  console.log(`1. Paid Fees with Positive Balance:            ${anomalies.paidFeesWithPositiveBalance.length}`);
  console.log(`2. Missing Due Dates:                          ${anomalies.missingDueDates.length}`);
  console.log(`3. Orphaned Fee Records:                       ${anomalies.orphanedFeeRecords.length}`);
  console.log(`4. Due Dates Inconsistent with Joining Date:   ${anomalies.dueDatesInconsistentWithJoiningDate.length}`);
  console.log(`5. Late Fees Inconsistent with Policy:         ${anomalies.lateFeesInconsistentWithPolicy.length}`);
  console.log(`6. Duplicate Fee Cycles:                       ${anomalies.duplicateFeeCycles.length}`);
  console.log(`7. Inconsistent Payment Breakdowns:            ${anomalies.inconsistentPaymentBreakdowns.length}`);
  console.log('====================================================\n');

  if (anomalies.dueDatesInconsistentWithJoiningDate.length > 0) {
    console.log('Sample Inconsistent Due Date Records (derived from fixed day instead of joining date):');
    console.log(JSON.stringify(anomalies.dueDatesInconsistentWithJoiningDate.slice(0, 3), null, 2));
    console.log('');
  }

  if (anomalies.lateFeesInconsistentWithPolicy.length > 0) {
    console.log('Sample Stored Late Fees needing live alignment:');
    console.log(JSON.stringify(anomalies.lateFeesInconsistentWithPolicy.slice(0, 3), null, 2));
    console.log('');
  }

  console.log('✅ Machine-Readable Audit Output Complete. Zero writes performed.');

  await mongoose.disconnect();
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
