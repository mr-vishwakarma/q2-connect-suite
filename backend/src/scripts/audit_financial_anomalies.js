require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const Hostel = require('../models/Hostel');
const Settings = require('../models/Settings');

async function runAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  console.log('============================================================');
  console.log('🔍 Q2 CONNECT SUITE — FINANCIAL ANOMALIES AUDIT (READ-ONLY)');
  console.log('============================================================\n');

  const students = await Student.find({}).lean();
  const fees = await Fee.find({}).lean();
  const payments = await FeePayment.find({}).lean();
  const hostels = await Hostel.find({}).lean();

  const studentMap = new Map(students.map(s => [s._id.toString(), s]));
  const feeMap = new Map(fees.map(f => [f._id.toString(), f]));

  const anomalies = {
    feeMismatchWithStudentRent: [],
    paidStatusWithOutstanding: [],
    unpaidStatusZeroOutstanding: [],
    overpaymentRecords: [],
    duplicateStudentMonthHostel: [],
    missingDueDates: [],
    negativeAmounts: [],
    missingTenantOrHostelRel: [],
  };

  // Check 1: Fee Amount vs Student configured monthly fees
  for (const f of fees) {
    const student = studentMap.get(f.studentId?.toString());
    if (student) {
      if (student.fees && f.amount !== student.fees) {
        anomalies.feeMismatchWithStudentRent.push({
          feeId: f._id,
          studentId: student._id,
          studentName: student.name,
          username: student.username,
          month: f.month,
          feeAmount: f.amount,
          studentConfiguredFee: student.fees,
          status: f.status,
          paidAmount: f.paidAmount,
        });
      }
    } else {
      anomalies.missingTenantOrHostelRel.push({
        feeId: f._id,
        reason: 'Student not found for studentId: ' + f.studentId,
      });
    }

    // Check 2: Paid status with positive outstanding balance
    const outstanding = Math.max(0, (f.amount || 0) + (f.lateFee || 0) - (f.discount || 0) - (f.paidAmount || 0));
    if (f.status === 'paid' && outstanding > 0) {
      anomalies.paidStatusWithOutstanding.push({
        feeId: f._id,
        studentId: f.studentId,
        studentName: student?.name,
        month: f.month,
        amount: f.amount,
        paidAmount: f.paidAmount,
        outstanding,
      });
    }

    // Check 3: Zero outstanding balance but unpaid status
    if (f.status !== 'paid' && outstanding === 0 && (f.amount > 0 || f.paidAmount > 0)) {
      anomalies.unpaidStatusZeroOutstanding.push({
        feeId: f._id,
        studentId: f.studentId,
        studentName: student?.name,
        month: f.month,
        status: f.status,
        amount: f.amount,
        paidAmount: f.paidAmount,
      });
    }

    // Check 4: Overpayment records (paidAmount > amount + lateFee - discount)
    const totalCharged = (f.amount || 0) + (f.lateFee || 0) - (f.discount || 0);
    if ((f.paidAmount || 0) > totalCharged && totalCharged > 0) {
      anomalies.overpaymentRecords.push({
        feeId: f._id,
        studentName: student?.name,
        month: f.month,
        totalCharged,
        paidAmount: f.paidAmount,
        difference: f.paidAmount - totalCharged,
      });
    }

    // Check 5: Missing or invalid due dates
    if (!f.dueDate) {
      anomalies.missingDueDates.push({
        feeId: f._id,
        studentName: student?.name,
        month: f.month,
        status: f.status,
      });
    }

    // Check 6: Negative amounts
    if (f.amount < 0 || f.paidAmount < 0 || f.lateFee < 0 || f.discount < 0) {
      anomalies.negativeAmounts.push({
        feeId: f._id,
        studentName: student?.name,
        month: f.month,
        amount: f.amount,
        paidAmount: f.paidAmount,
      });
    }

    // Check 7: Missing organizationId or hostelId
    if (!f.organizationId || !f.hostelId) {
      anomalies.missingTenantOrHostelRel.push({
        feeId: f._id,
        studentName: student?.name,
        month: f.month,
        organizationId: f.organizationId,
        hostelId: f.hostelId,
      });
    }
  }

  // Check 8: Duplicate student + month + hostel
  const seenMap = new Map();
  for (const f of fees) {
    const key = `${f.studentId?.toString()}_${f.month}_${f.hostel}`;
    if (seenMap.has(key)) {
      anomalies.duplicateStudentMonthHostel.push({
        key,
        feeId1: seenMap.get(key),
        feeId2: f._id,
        studentName: studentMap.get(f.studentId?.toString())?.name,
        month: f.month,
        hostel: f.hostel,
      });
    } else {
      seenMap.set(key, f._id);
    }
  }

  console.log('Audit Summary:');
  console.log(`- Total Students: ${students.length}`);
  console.log(`- Total Fee Records: ${fees.length}`);
  console.log(`- Total Payments: ${payments.length}`);
  console.log(`- Fee Amount Mismatches with Student Monthly Fee: ${anomalies.feeMismatchWithStudentRent.length}`);
  console.log(`- Status Paid but positive outstanding: ${anomalies.paidStatusWithOutstanding.length}`);
  console.log(`- Unpaid status with 0 outstanding: ${anomalies.unpaidStatusZeroOutstanding.length}`);
  console.log(`- Overpayments (paid > totalCharged): ${anomalies.overpaymentRecords.length}`);
  console.log(`- Missing due dates: ${anomalies.missingDueDates.length}`);
  console.log(`- Negative amounts: ${anomalies.negativeAmounts.length}`);
  console.log(`- Missing tenant/hostel links: ${anomalies.missingTenantOrHostelRel.length}`);
  console.log(`- Duplicate student/month/hostel: ${anomalies.duplicateStudentMonthHostel.length}\n`);

  console.log('Detailed Anomalies:');
  console.log('1. Fee Amount Mismatches with Student Configured Rent:');
  console.dir(anomalies.feeMismatchWithStudentRent, { depth: null });

  console.log('\n2. Overpayments:');
  console.dir(anomalies.overpaymentRecords, { depth: null });

  console.log('\n3. Missing Due Dates:');
  console.dir(anomalies.missingDueDates, { depth: null });

  console.log('\n4. Duplicate Student/Month/Hostel:');
  console.dir(anomalies.duplicateStudentMonthHostel, { depth: null });

  await mongoose.disconnect();
}

runAudit().catch(console.error);
