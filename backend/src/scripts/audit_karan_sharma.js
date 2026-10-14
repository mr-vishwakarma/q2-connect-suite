require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const Hostel = require('../models/Hostel');
const Settings = require('../models/Settings');

async function audit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const students = await Student.find({ name: /karan/i }).lean();
  console.log(`Found ${students.length} student(s) matching "karan":`);
  for (const s of students) {
    console.log({
      _id: s._id,
      name: s.name,
      username: s.username,
      roomNo: s.roomNo,
      hostel: s.hostel,
      hostelId: s.hostelId,
      organizationId: s.organizationId,
      fees: s.fees,
      securityDeposit: s.securityDeposit,
      startDate: s.startDate,
      validDate: s.validDate,
      isActive: s.isActive,
    });

    const studentFees = await Fee.find({ studentId: s._id }).lean();
    console.log(`  Fees for ${s.name} (${studentFees.length} records):`);
    for (const f of studentFees) {
      console.log('   Fee:', {
        _id: f._id,
        month: f.month,
        amount: f.amount,
        paidAmount: f.paidAmount,
        status: f.status,
        dueDate: f.dueDate,
        lateFee: f.lateFee,
        discount: f.discount,
        paymentMode: f.paymentMode,
        paidDate: f.paidDate,
      });
    }

    const payments = await FeePayment.find({ studentId: s._id }).lean();
    console.log(`  FeePayments for ${s.name} (${payments.length} records):`);
    for (const p of payments) {
      console.log('   Payment:', {
        _id: p._id,
        feeId: p.feeId,
        month: p.month,
        amount: p.amount,
        lateFee: p.lateFee,
        discount: p.discount,
        securityDeposit: p.securityDeposit,
        paymentMode: p.paymentMode,
        paymentDate: p.paymentDate,
        receiptNo: p.receiptNo,
      });
    }
  }

  // Also inspect Rahul
  const rahul = await Student.findOne({ name: /rahul/i }).lean();
  if (rahul) {
    console.log('\nRahul:');
    console.log({
      _id: rahul._id,
      name: rahul.name,
      roomNo: rahul.roomNo,
      fees: rahul.fees,
      securityDeposit: rahul.securityDeposit,
      startDate: rahul.startDate,
      validDate: rahul.validDate,
    });
    const rahulFees = await Fee.find({ studentId: rahul._id }).lean();
    console.log(`  Fees for Rahul (${rahulFees.length} records):`, rahulFees);
    const rahulPayments = await FeePayment.find({ studentId: rahul._id }).lean();
    console.log(`  Payments for Rahul (${rahulPayments.length} records):`, rahulPayments);
  }

  // Check Settings
  const allSettings = await Settings.find({}).lean();
  console.log('\nSettings:', allSettings.map(s => ({
    hostel: s.hostel,
    lateFeePerDay: s.lateFeePerDay,
    gracePeriodDays: s.gracePeriodDays,
    monthlyRentDueDay: s.monthlyRentDueDay,
  })));

  await mongoose.disconnect();
}

audit().catch(console.error);
