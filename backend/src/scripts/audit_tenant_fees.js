require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');

async function auditTenant() {
  await mongoose.connect(process.env.MONGODB_URI);
  const orgId = new mongoose.Types.ObjectId('6a8c4c75a58a07e75037d911');

  const students = await Student.find({ organizationId: orgId }).lean();
  console.log(`=== TENANT STUDENTS (${students.length}) ===`);
  for (const s of students) {
    console.log(`[Student ${s._id}] ${s.name} (@${s.username}), Room: ${s.roomNo}, Hostel: ${s.hostel}, Fees: ₹${s.fees}, Start: ${s.startDate?.toISOString()?.split('T')[0]}, Valid: ${s.validDate?.toISOString()?.split('T')[0]}`);
  }

  const fees = await Fee.find({ organizationId: orgId }).lean();
  console.log(`\n=== TENANT FEES (${fees.length}) ===`);
  for (const f of fees) {
    const student = students.find(s => s._id.toString() === f.studentId?.toString());
    console.log(`[Fee ${f._id}] Student: ${student?.name} (@${student?.username}), Month: "${f.month}", Amount: ₹${f.amount}, PaidAmount: ₹${f.paidAmount}, LateFee: ₹${f.lateFee}, Discount: ₹${f.discount}, Status: "${f.status}", DueDate: ${f.dueDate?.toISOString()?.split('T')[0]}`);
  }

  const payments = await FeePayment.find({ organizationId: orgId }).lean();
  console.log(`\n=== TENANT PAYMENTS (${payments.length}) ===`);
  for (const p of payments) {
    const student = students.find(s => s._id.toString() === p.studentId?.toString());
    console.log(`[Payment ${p._id}] Student: ${student?.name}, Month: "${p.month}", Amount: ₹${p.amount}, LateFee: ₹${p.lateFee}, Date: ${p.paymentDate?.toISOString()?.split('T')[0]}, Receipt: ${p.receiptNo}`);
  }

  await mongoose.disconnect();
}

auditTenant().catch(console.error);
