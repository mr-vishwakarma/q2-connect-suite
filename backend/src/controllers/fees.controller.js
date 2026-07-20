const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const SecurityDeposit = require('../models/SecurityDeposit');
const Student = require('../models/Student');
const Notification = require('../models/Notification');

// @desc    Get complete fee management data for admin
// @route   GET /api/fees/dashboard
const getFeeManagementDashboard = async (req, res) => {
  try {
    const { hostel } = req.query;
    const filter = hostel && hostel !== 'All' ? { hostel } : {};

    const [students, fees, payments, deposits] = await Promise.all([
      Student.find(filter).select('_id userId name phone roomNo fees startDate validDate username parentPhone').lean(),
      Fee.find(filter).sort({ createdAt: -1 }).lean(),
      FeePayment.find(filter).sort({ paymentDate: -1 }).lean(),
      SecurityDeposit.find(filter).lean(),
    ]);

    // Map Mongoose _id to id and userId to user_id to match frontend expectations
    const mappedStudents = students.map(s => ({
      id: s._id,
      user_id: s.userId,
      name: s.name,
      phone: s.phone,
      parent_phone: s.parentPhone,
      room_no: s.roomNo,
      fees: s.fees,
      start_date: s.startDate,
      valid_date: s.validDate,
      username: s.username
    }));

    const mappedFees = fees.map(f => ({
      id: f._id,
      student_id: f.studentId,
      month: f.month,
      amount: f.amount,
      paid_date: f.paidDate,
      payment_mode: f.paymentMode,
      status: f.status,
      due_date: f.dueDate,
      late_fee: f.lateFee,
      discount: f.discount,
      paid_amount: f.paidAmount,
      receipt_no: f.receiptNo,
      notes: f.notes
    }));

    const mappedPayments = payments.map(p => ({
      id: p._id,
      fee_id: p.feeId,
      student_id: p.studentId,
      receipt_no: p.receiptNo,
      amount: p.amount,
      late_fee: p.lateFee,
      discount: p.discount,
      security_deposit: p.securityDeposit,
      payment_mode: p.paymentMode,
      payment_date: p.paymentDate,
      admin_name: p.adminName,
      month: p.month,
      notes: p.notes
    }));

    const mappedDeposits = deposits.map(d => ({
      id: d._id,
      student_id: d.studentId,
      amount: d.amount,
      status: d.status,
      collected_date: d.collectedDate,
      refund_date: d.refundDate
    }));

    return res.status(200).json({
      success: true,
      data: {
        students: mappedStudents,
        fees: mappedFees,
        payments: mappedPayments,
        deposits: mappedDeposits
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ... keep existing functions

// @desc    Get fees (admin: all/by student; student: own)
// @route   GET /api/fees
const getFees = async (req, res) => {
  try {
    const { studentId, hostel, month, status } = req.query;
    const query = {};

    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
      query.studentId = student._id;
    } else {
      if (studentId) query.studentId = studentId;
      if (hostel) query.hostel = hostel;
    }

    if (month) query.month = month;
    if (status) query.status = status;

    const fees = await Fee.find(query)
      .populate('studentId', 'name username roomNo hostel')
      .sort({ month: -1 });

    return res.status(200).json({ success: true, data: fees });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a fee record
// @route   POST /api/fees
const createFee = async (req, res) => {
  try {
    const { studentId, hostel, month, amount, discount, lateFee, dueDate, notes, status, paymentMode } = req.body;
    if (!studentId || !month || !amount) {
      return res.status(400).json({ success: false, message: 'studentId, month, amount are required' });
    }
    const fee = await Fee.create({ studentId, hostel, month, amount, discount, lateFee, dueDate, notes, status, paymentMode });
    return res.status(201).json({ success: true, data: fee });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Fee record for this student/month already exists' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update fee (e.g. record payment)
// @route   PUT /api/fees/:id
const updateFee = async (req, res) => {
  try {
    const { paidAmount, status, paymentMode, receiptNo, paidDate, discount, lateFee, notes, amount } = req.body;
    const fee = await Fee.findByIdAndUpdate(
      req.params.id,
      { paidAmount, status, paymentMode, receiptNo, paidDate, discount, lateFee, notes, amount },
      { new: true, runValidators: true }
    ).populate('studentId', 'name username hostel userId');

    if (!fee) return res.status(404).json({ success: false, message: 'Fee not found' });

    // If marked as paid, notify student
    if (status === 'paid' && fee.studentId) {
      await Notification.create({
        userId: fee.studentId.userId,
        hostel: fee.hostel,
        title: 'Fee Payment Confirmed',
        message: `Your fee for ${fee.month} has been marked as paid. Receipt: ${receiptNo || fee.receiptNo}`,
        type: 'success',
      });
    }

    return res.status(200).json({ success: true, data: fee });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate monthly fees for all active students
// @route   POST /api/fees/generate-monthly
const generateMonthlyFees = async (req, res) => {
  try {
    const { month, hostel } = req.body;
    if (!month) return res.status(400).json({ success: false, message: 'month is required (YYYY-MM)' });

    const query = { isActive: true };
    if (hostel) query.hostel = hostel;

    const students = await Student.find(query);
    const results = { created: 0, skipped: 0 };

    for (const student of students) {
      try {
        await Fee.create({
          studentId: student._id,
          hostel: student.hostel,
          month,
          amount: student.fees || 0,
        });
        results.created++;
      } catch (err) {
        if (err.code === 11000) results.skipped++; // already exists
      }
    }

    return res.status(200).json({ success: true, message: `Generated fees: ${results.created} created, ${results.skipped} skipped` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get fee payments for a student
// @route   GET /api/fee-payments
const getFeePayments = async (req, res) => {
  try {
    const { studentId } = req.query;
    const query = {};

    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
      query.studentId = student._id;
    } else if (studentId) {
      query.studentId = studentId;
    }

    const payments = await FeePayment.find(query)
      .populate('studentId', 'name username')
      .sort({ paymentDate: -1 });

    return res.status(200).json({ success: true, data: payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Record a fee payment (handles fees, fee_payments, security_deposits, and students table)
// @route   POST /api/fees/collect
const collectPayment = async (req, res) => {
  try {
    const {
      studentId, hostel, month, amount, lateFee, discount, securityDeposit,
      receivedAmount, paymentMode, notes, receiptNo
    } = req.body;

    if (!studentId || !month || !receivedAmount || !paymentMode || !receiptNo) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // 1. Ensure a monthly fees row exists
    let feeRow = await Fee.findOne({ studentId, month, hostel });
    if (!feeRow) {
      feeRow = await Fee.create({
        studentId, hostel, month, amount, lateFee, discount,
        status: 'unpaid', paymentMode
      });
    } else {
      feeRow = await Fee.findByIdAndUpdate(
        feeRow._id,
        { lateFee, discount, amount },
        { new: true }
      );
    }

    const feeCore = Math.max(0, receivedAmount - securityDeposit);

    // 2. Create the fee payment record
    const payment = await FeePayment.create({
      feeId: feeRow._id,
      studentId,
      hostel,
      receiptNo,
      amount: feeCore,
      lateFee,
      discount,
      securityDeposit,
      paymentMode,
      paymentDate: new Date(),
      adminId: req.user._id,
      adminName: req.user.name,
      month,
      notes: notes || null,
    });

    // 3. Security deposit tracking
    if (securityDeposit > 0) {
      await SecurityDeposit.create({
        studentId,
        hostel,
        amount: securityDeposit,
        collectedDate: new Date(),
        status: 'collected',
        paymentMode,
      });
    }

    // 4. Extend student validDate if fully paid (best-effort)
    const totalDue = amount + lateFee - discount;
    if (feeCore >= totalDue) {
      const student = await Student.findById(studentId);
      if (student && student.validDate) {
        const cur = new Date(student.validDate);
        cur.setMonth(cur.getMonth() + 1);
        await Student.findByIdAndUpdate(studentId, { validDate: cur });
      }
    }

    // 5. Update Fee status to paid if fully paid
    if (feeCore >= totalDue) {
      await Fee.findByIdAndUpdate(feeRow._id, { status: 'paid', paidAmount: feeCore, paidDate: new Date() });
    } else if (feeCore > 0) {
      await Fee.findByIdAndUpdate(feeRow._id, { status: 'partial', paidAmount: feeCore, paidDate: new Date() });
    }

    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error('Error in collectPayment:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getFeeManagementDashboard, getFees, createFee, updateFee, generateMonthlyFees, getFeePayments, collectPayment };
