const mongoose = require('mongoose');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const SecurityDeposit = require('../models/SecurityDeposit');
const Student = require('../models/Student');
const Notification = require('../models/Notification');

const feeService = require('../services/fee.service');

// @desc    Get complete fee management data for admin
// @route   GET /api/fees/dashboard
const getFeeManagementDashboard = async (req, res) => {
  try {
    const { hostel, page = 1, limit = 100 } = req.query;
    const data = await feeService.getDashboardData({
      hostel,
      organizationId: req.tenant?.organizationId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data,
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
          dueDate: student.validDate || new Date()
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      studentId, hostel, month, amount, lateFee, discount, securityDeposit,
      receivedAmount, paymentMode, notes, receiptNo, receiptUrl
    } = req.body;

    if (!studentId || !month || !receivedAmount || !paymentMode || !receiptNo) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const student = await Student.findById(studentId).session(session);
    if (!student) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const actualHostel = student.hostel || hostel;

    // 1. Ensure a monthly fees row exists
    let feeRow = await Fee.findOne({ studentId, month, hostel: actualHostel }).session(session);
    
    if (feeRow && feeRow.status === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Fee for this month is already fully paid' });
    }

    if (!feeRow) {
      const newFees = await Fee.create([{
        studentId, hostel: actualHostel, month, amount, lateFee, discount,
        status: 'unpaid', paymentMode
      }], { session });
      feeRow = newFees[0];
    } else {
      feeRow = await Fee.findByIdAndUpdate(
        feeRow._id,
        { lateFee, discount, amount },
        { new: true, session }
      );
    }

    const feeCore = Math.max(0, receivedAmount - securityDeposit);
    const totalDue = amount + lateFee - discount;

    // 2. Create the fee payment record
    const payments = await FeePayment.create([{
      feeId: feeRow._id,
      studentId,
      hostel: actualHostel,
      receiptNo,
      receiptUrl,
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
    }], { session });
    const payment = payments[0];

    // 3. Security deposit tracking
    if (securityDeposit > 0) {
      await SecurityDeposit.create([{
        studentId,
        hostel: actualHostel,
        amount: securityDeposit,
        collectedDate: new Date(),
        status: 'collected',
        paymentMode,
      }], { session });
    }

    // 4. Extend student validDate if fully paid (best-effort)
    if (feeCore >= totalDue) {
      if (student && student.validDate) {
        const cur = new Date(student.validDate);
        cur.setMonth(cur.getMonth() + 1);
        await Student.findByIdAndUpdate(studentId, { validDate: cur }, { session });
      }
    }

    // 5. Update Fee status to paid if fully paid
    const newPaidAmount = (feeRow.paidAmount || 0) + feeCore;
    if (newPaidAmount >= totalDue) {
      await Fee.findByIdAndUpdate(feeRow._id, { status: 'paid', paidAmount: newPaidAmount, paidDate: new Date() }, { session });
    } else if (newPaidAmount > 0) {
      await Fee.findByIdAndUpdate(feeRow._id, { status: 'partial', paidAmount: newPaidAmount, paidDate: new Date() }, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error in collectPayment:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getFeeManagementDashboard, getFees, createFee, updateFee, generateMonthlyFees, getFeePayments, collectPayment };
