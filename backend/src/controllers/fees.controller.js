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
    const { studentId, hostel, month, status, page = 1, limit = 50 } = req.query;
    const query = {};

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    // Enforce Tenant Scoping
    if (!isSuperAdmin) {
      query.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      query.organizationId = orgId;
    }

    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user._id }).lean();
      if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
      query.studentId = student._id;
    } else {
      if (studentId) query.studentId = studentId;
      if (hostel && hostel !== 'All') {
        query.hostel = hostel;
      } else if (req.tenant && req.tenant.hostelAccess && !req.tenant.hostelAccess.includes('all') && !isSuperAdmin) {
        query.hostel = { $in: req.tenant.hostelAccess };
      }
    }

    if (month) query.month = month;
    if (status) query.status = status;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitAmount = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const skip = (pageNum - 1) * limitAmount;

    const [total, fees] = await Promise.all([
      Fee.countDocuments(query),
      Fee.find(query)
        .populate('studentId', 'name username roomNo hostel')
        .sort({ month: -1, _id: -1 })
        .skip(skip)
        .limit(limitAmount)
        .lean()
    ]);

    return res.status(200).json({ 
      success: true, 
      count: fees.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitAmount) || (total === 0 ? 0 : 1),
      limit: limitAmount,
      data: fees 
    });
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

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    if (!isSuperAdmin && !orgId) {
      return res.status(403).json({ success: false, message: 'Organization tenant context required' });
    }

    // Verify student belongs to this tenant organization
    const studentQuery = { _id: studentId };
    if (!isSuperAdmin) {
      studentQuery.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      studentQuery.organizationId = orgId;
    }

    const student = await Student.findOne(studentQuery);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your organization' });
    }

    const Hostel = require('../models/Hostel');
    const hostelDoc = await Hostel.findOne({ organizationId: orgId, code: hostel || student.hostel });

    const fee = await Fee.create({
      studentId,
      organizationId: orgId || null,
      hostelId: student.hostelId || hostelDoc?._id || null,
      hostel: hostel || student.hostel || 'Q2',
      month,
      amount,
      discount,
      lateFee,
      dueDate,
      notes,
      status,
      paymentMode,
    });
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
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const feeQuery = { _id: req.params.id };
    if (!isSuperAdmin) {
      feeQuery.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      feeQuery.organizationId = orgId;
    }

    const fee = await Fee.findOneAndUpdate(
      feeQuery,
      { paidAmount, status, paymentMode, receiptNo, paidDate, discount, lateFee, notes, amount },
      { new: true, runValidators: true }
    ).populate('studentId', 'name username hostel userId');

    if (!fee) return res.status(404).json({ success: false, message: 'Fee not found in your organization' });

    // If marked as paid, notify student
    if (status === 'paid' && fee.studentId) {
      await Notification.create({
        userId: fee.studentId.userId,
        organizationId: fee.organizationId || null,
        hostelId: fee.hostelId || null,
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
    if (!month) return res.status(400).json({ success: false, message: 'month is required (e.g. "October 2026" or "2026-10")' });

    const query = { isActive: true };

    // Enforce Tenant Scoping
    if (req.tenant && req.tenant.organizationId && !req.tenant.isSuperAdmin) {
      query.organizationId = req.tenant.organizationId;
    }

    if (hostel && hostel !== 'All') {
      query.hostel = hostel;
    } else if (req.tenant && req.tenant.hostelAccess && !req.tenant.hostelAccess.includes('all') && !req.tenant.isSuperAdmin) {
      query.hostel = { $in: req.tenant.hostelAccess };
    }

    const students = await Student.find(query).select('_id hostel hostelId organizationId fees validDate').lean();
    if (students.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active students found for fee generation',
        created: 0,
        skipped: 0,
      });
    }

    // High-performance batched bulkWrite with $setOnInsert: 1 round-trip instead of N sequential writes
    const bulkOps = students.map((student) => ({
      updateOne: {
        filter: {
          studentId: student._id,
          month,
        },
        update: {
          $setOnInsert: {
            studentId: student._id,
            organizationId: student.organizationId || req.tenant?.organizationId || null,
            hostelId: student.hostelId || null,
            hostel: student.hostel || 'Q2',
            month,
            amount: student.fees || 0,
            paidAmount: 0,
            status: 'unpaid',
            dueDate: student.validDate || new Date(),
          },
        },
        upsert: true,
      },
    }));

    const writeResult = await Fee.bulkWrite(bulkOps, { ordered: false });
    const created = writeResult.upsertedCount || 0;
    const skipped = writeResult.matchedCount || 0;

    return res.status(200).json({
      success: true,
      message: `Generated monthly fees: ${created} created, ${skipped} skipped (already existed)`,
      created,
      skipped,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get fee payments
// @route   GET /api/fees/payments
const getFeePayments = async (req, res) => {
  try {
    const { studentId, hostel, page = 1, limit = 50 } = req.query;
    const query = {};

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    // Enforce Tenant Scoping
    if (!isSuperAdmin) {
      query.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      query.organizationId = orgId;
    }

    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user._id }).lean();
      if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
      query.studentId = student._id;
    } else {
      if (studentId) query.studentId = studentId;
      if (hostel && hostel !== 'All') {
        query.hostel = hostel;
      } else if (req.tenant && req.tenant.hostelAccess && !req.tenant.hostelAccess.includes('all') && !isSuperAdmin) {
        query.hostel = { $in: req.tenant.hostelAccess };
      }
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitAmount = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const skip = (pageNum - 1) * limitAmount;

    const [total, payments] = await Promise.all([
      FeePayment.countDocuments(query),
      FeePayment.find(query)
        .populate('studentId', 'name username')
        .sort({ paymentDate: -1, _id: -1 })
        .skip(skip)
        .limit(limitAmount)
        .lean()
    ]);

    return res.status(200).json({ 
      success: true, 
      count: payments.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitAmount) || (total === 0 ? 0 : 1),
      limit: limitAmount,
      data: payments 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Record a fee payment (handles fees, fee_payments, security_deposits, and students table)
// @route   POST /api/fees/collect
const collectPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  let idempotencyKey = null;
  let orgId = null;

  try {
    const {
      studentId, hostel, month, amount, lateFee, discount, securityDeposit,
      receivedAmount, paymentMode, notes, receiptNo, receiptUrl, idempotencyKey: bodyIdempotencyKey
    } = req.body;

    idempotencyKey = req.headers['idempotency-key'] || bodyIdempotencyKey;

    if (!studentId || !month || !receivedAmount || !paymentMode || !receiptNo) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    if (!isSuperAdmin && !orgId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Organization tenant context required' });
    }

    // Idempotency check: prevent duplicate financial charges on network retry
    if (idempotencyKey) {
      const existingPayment = await FeePayment.findOne({
        idempotencyKey,
        ...(orgId ? { organizationId: orgId } : {})
      }).session(session);

      if (existingPayment) {
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({
          success: true,
          data: existingPayment,
          idempotent: true,
          message: 'Payment already recorded successfully (idempotent response)'
        });
      }
    }

    // Check duplicate receipt number within organization
    if (orgId) {
      const existingReceipt = await FeePayment.findOne({
        receiptNo,
        organizationId: orgId
      }).session(session);

      if (existingReceipt) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          message: `Receipt number "${receiptNo}" has already been issued.`
        });
      }
    }

    // Verify student belongs to this tenant
    const studentQuery = { _id: studentId };
    if (!isSuperAdmin) {
      studentQuery.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      studentQuery.organizationId = orgId;
    }

    const student = await Student.findOne(studentQuery).session(session);
    if (!student) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Student not found in this organization' });
    }
    const actualHostel = student.hostel || hostel;


    // 1. Ensure a monthly fees row exists
    const feeFilter = { studentId, month, hostel: actualHostel };
    if (orgId) feeFilter.organizationId = orgId;

    let feeRow = await Fee.findOne(feeFilter).session(session);
    
    if (feeRow && feeRow.status === 'paid') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Fee for this month is already fully paid' });
    }

    const numAmount = Number(amount) || 0;
    const numLateFee = Number(lateFee) || 0;
    const numDiscount = Number(discount) || 0;
    const numSecDeposit = Number(securityDeposit) || 0;
    const numReceived = Number(receivedAmount) || 0;

    if (!feeRow) {
      const newFees = await Fee.create([{
        studentId,
        organizationId: orgId || null,
        hostelId: student.hostelId || null,
        hostel: actualHostel,
        month,
        amount: numAmount || (numReceived - numSecDeposit),
        lateFee: numLateFee,
        discount: numDiscount,
        status: 'unpaid',
        paymentMode
      }], { session, ordered: true });
      feeRow = newFees[0];
    } else {
      feeRow = await Fee.findByIdAndUpdate(
        feeRow._id,
        { lateFee: numLateFee, discount: numDiscount, amount: numAmount || feeRow.amount },
        { new: true, session }
      );
    }

    const feeCore = Math.max(0, numReceived - numSecDeposit);
    const totalDue = (numAmount || feeRow.amount || 0) + numLateFee - numDiscount;

    // 2. Create the fee payment record with organization and idempotency tracking
    const payments = await FeePayment.create([{
      feeId: feeRow._id,
      studentId,
      organizationId: orgId || null,
      hostelId: student.hostelId || null,
      hostel: actualHostel,
      receiptNo,
      receiptUrl,
      amount: feeCore,
      lateFee: numLateFee,
      discount: numDiscount,
      securityDeposit: numSecDeposit,
      paymentMode,
      paymentDate: new Date(),
      adminId: req.user._id,
      adminName: req.user.name,
      month,
      notes: notes || null,
      idempotencyKey: idempotencyKey || null,
    }], { session, ordered: true });
    const payment = payments[0];

    // 3. Security deposit tracking
    if (numSecDeposit > 0) {
      await SecurityDeposit.create([{
        studentId,
        organizationId: orgId || null,
        hostelId: student.hostelId || null,
        hostel: actualHostel,
        amount: numSecDeposit,
        collectedDate: new Date(),
        status: 'collected',
        paymentMode,
      }], { session, ordered: true });
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
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    if (error.code === 11000 || error.code === 112 || (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) || (error.message && error.message.includes('Write conflict'))) {
      if (idempotencyKey) {
        // Wait briefly for concurrent winning transaction to commit
        await new Promise((r) => setTimeout(r, 150));
        const existingPayment = await FeePayment.findOne({
          idempotencyKey,
          ...(orgId ? { organizationId: orgId } : {})
        });
        if (existingPayment) {
          return res.status(200).json({
            success: true,
            data: existingPayment,
            idempotent: true,
            message: 'Payment already recorded successfully (idempotent response)'
          });
        }
      }
      return res.status(409).json({ success: false, message: 'Concurrent write conflict or duplicate receipt detected' });
    }
    console.error('Error in collectPayment:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getFeeManagementDashboard, getFees, createFee, updateFee, generateMonthlyFees, getFeePayments, collectPayment };
