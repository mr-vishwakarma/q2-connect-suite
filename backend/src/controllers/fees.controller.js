const mongoose = require('mongoose');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const SecurityDeposit = require('../models/SecurityDeposit');
const Student = require('../models/Student');
const Notification = require('../models/Notification');

const feeService = require('../services/fee.service');
const { calculateCycleDueDate, getNextMonthlyDueDate, calculateBillingPeriod } = require('../utils/billingCycle');

// @desc    Get complete fee management data for admin
// @route   GET /api/fees/dashboard
const getFeeManagementDashboard = async (req, res) => {
  try {
    const { hostel, page = 1, limit = 100, sortBy = 'roomNo', sortOrder = 'asc' } = req.query;
    const data = await feeService.getDashboardData({
      hostel,
      organizationId: req.tenant?.organizationId,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Calculate payable fee breakdown authoritatively
// @route   GET /api/fees/calculate
const calculatePayableFeeEndpoint = async (req, res) => {
  try {
    const { studentId, hostel, feeId, hostelId } = req.query;
    const month = req.query.month || req.query.feeMonth;
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const breakdown = await feeService.calculatePayableFee({
      studentId,
      hostelId,
      feeId,
      feeMonth: month,
      organizationId: isSuperAdmin ? null : orgId,
    });

    return res.status(200).json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
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

    const students = await Student.find(query).select('_id hostel hostelId organizationId fees validDate startDate').lean();
    if (students.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active students found for fee generation',
        created: 0,
        skipped: 0,
      });
    }

    const MONTHS = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthParts = (month || '').trim().split(/\s+/);
    let targetM = -1;
    let targetY = NaN;
    if (monthParts.length === 2) {
      targetM = MONTHS.indexOf(monthParts[0].toLowerCase());
      targetY = parseInt(monthParts[1], 10);
    }

    // High-performance batched bulkWrite with $setOnInsert: 1 round-trip instead of N sequential writes
    const bulkOps = students.map((student) => {
      let derivedDueDate = student.validDate || new Date();
      if (student.startDate) {
        if (targetM >= 0 && !isNaN(targetY)) {
          const joinD = new Date(student.startDate);
          if (!isNaN(joinD.getTime())) {
            const diffMonths = (targetY - joinD.getFullYear()) * 12 + (targetM - joinD.getMonth());
            derivedDueDate = calculateCycleDueDate(student.startDate, Math.max(0, diffMonths));
          }
        } else {
          derivedDueDate = calculateCycleDueDate(student.startDate, 0);
        }
      }

      return {
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
              dueDate: derivedDueDate,
            },
          },
          upsert: true,
        },
      };
    });

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

// @desc    Get security deposits
// @route   GET /api/fees/deposits
const getSecurityDeposits = async (req, res) => {
  try {
    const { studentId, hostel, status, page = 1, limit = 50 } = req.query;
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
      if (status) query.status = status;
      if (hostel && hostel !== 'All') {
        query.hostel = hostel;
      } else if (req.tenant && req.tenant.hostelAccess && !req.tenant.hostelAccess.includes('all') && !isSuperAdmin) {
        query.hostel = { $in: req.tenant.hostelAccess };
      }
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitAmount = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const skip = (pageNum - 1) * limitAmount;

    const [total, deposits] = await Promise.all([
      SecurityDeposit.countDocuments(query),
      SecurityDeposit.find(query)
        .populate('studentId', 'name username room')
        .sort({ collectedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitAmount)
        .lean()
    ]);

    return res.status(200).json({
      success: true,
      count: deposits.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitAmount) || (total === 0 ? 0 : 1),
      limit: limitAmount,
      data: deposits
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const { startSafeTransaction } = require('../utils/transaction');

// @desc    Record a fee payment (handles fees, fee_payments, security_deposits, and students table)
// @route   POST /api/fees/collect
const collectPayment = async (req, res) => {
  const tx = await startSafeTransaction();
  const session = tx.session;
  const withSession = (q) => (session ? q.session(session) : q);
  const sessionOpts = session ? { session, ordered: true } : { ordered: true };

  let idempotencyKey = null;
  let orgId = null;

  try {
    const {
      studentId, hostel, month, amount, lateFee, discount, securityDeposit,
      receivedAmount, paymentMode, notes, receiptNo, depositReceiptNo: reqDepositReceiptNo,
      receiptUrl, idempotencyKey: bodyIdempotencyKey
    } = req.body;

    idempotencyKey = req.headers['idempotency-key'] || bodyIdempotencyKey;

    if (!studentId || !month || receivedAmount === undefined || receivedAmount === null || !paymentMode) {
      await tx.abort();
      return res.status(400).json({ success: false, message: 'Missing required fields: studentId, month, receivedAmount, paymentMode' });
    }

    const numReceived = Number(receivedAmount);
    if (isNaN(numReceived) || numReceived <= 0) {
      await tx.abort();
      return res.status(400).json({ success: false, message: 'Received amount must be greater than zero' });
    }

    orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    if (!isSuperAdmin && !orgId) {
      await tx.abort();
      return res.status(403).json({ success: false, message: 'Organization tenant context required' });
    }

    // Idempotency check: prevent duplicate financial charges on network retry
    if (idempotencyKey) {
      const existingPayment = await withSession(FeePayment.findOne({
        idempotencyKey,
        ...(orgId ? { organizationId: orgId } : {})
      }));

      if (existingPayment) {
        await tx.abort();
        return res.status(200).json({
          success: true,
          data: existingPayment,
          idempotent: true,
          message: 'Payment already recorded successfully (idempotent response)'
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

    const student = await withSession(Student.findOne(studentQuery));
    if (!student) {
      await tx.abort();
      return res.status(404).json({ success: false, message: 'Student not found in this organization' });
    }
    const actualHostel = student.hostel || hostel;

    // Calculate authoritative payable breakdown
    const breakdown = await feeService.calculatePayableFee({
      studentId: student._id,
      hostelId: student.hostelId,
      feeMonth: month,
      organizationId: orgId,
    });

    const explicitFeeAmount = amount !== undefined && amount !== null ? Number(amount) : null;
    const numAmount = student.fees > 0 ? Number(student.fees) : (Number(amount) || breakdown.baseFee);
    let numLateFee = lateFee !== undefined && !isNaN(Number(lateFee)) ? Number(lateFee) : breakdown.applicableLateFee;
    const numDiscount = Number(discount) || 0;
    const numSecDeposit = Number(securityDeposit) || 0;

    // If explicit fee amount was sent without explicit late fee, and receivedAmount matches base + deposit:
    if (explicitFeeAmount !== null && lateFee === undefined && Math.abs((explicitFeeAmount + numSecDeposit) - numReceived) < 0.01) {
      numLateFee = 0;
    }

    // Validate security deposit liability
    if (numSecDeposit > 0) {
      if (breakdown.isDepositFullyPaid || breakdown.depositDue === 0) {
        await tx.abort();
        return res.status(400).json({
          success: false,
          message: 'Security deposit has already been fully paid for this student and cannot be charged again.'
        });
      }
      if (numSecDeposit > breakdown.depositDue) {
        await tx.abort();
        return res.status(400).json({
          success: false,
          message: `Security deposit amount (₹${numSecDeposit}) exceeds the outstanding deposit balance of ₹${breakdown.depositDue}.`
        });
      }
    }

    // Explicit allocation validation:
    // If client specified an intended fee amount and security deposit amount,
    // their sum (including late fee and discount on fee) must match the receivedAmount.
    const computedFeeTarget = explicitFeeAmount !== null
      ? Math.max(0, explicitFeeAmount + numLateFee - numDiscount)
      : Math.max(0, numAmount + numLateFee - numDiscount);

    if (explicitFeeAmount !== null && Math.abs((computedFeeTarget + numSecDeposit) - numReceived) > 0.01) {
      await tx.abort();
      return res.status(400).json({
        success: false,
        message: `Allocation mismatch: received amount (₹${numReceived}) does not match the sum of fee allocation (₹${computedFeeTarget}) and security deposit (₹${numSecDeposit}).`
      });
    }

    // Determine fee portion vs deposit portion
    const feeCore = Math.max(0, numReceived - numSecDeposit);
    const totalDue = Math.max(0, numAmount + numLateFee - numDiscount);

    if (Math.abs((feeCore + numSecDeposit) - numReceived) > 0.01) {
      await tx.abort();
      return res.status(400).json({
        success: false,
        message: `Sum of fee allocation (₹${feeCore}) and deposit allocation (₹${numSecDeposit}) must equal total received amount (₹${numReceived}).`
      });
    }

    // Check fee payment status
    const feeFilter = { studentId, month };
    if (orgId) feeFilter.organizationId = orgId;
    let feeRow = await withSession(Fee.findOne(feeFilter));
    if (feeRow && !feeRow.hostel && actualHostel) {
      feeRow.hostel = actualHostel;
    }

    if (feeRow && feeRow.status === 'paid' && feeCore > 0) {
      await tx.abort();
      return res.status(400).json({
        success: false,
        message: `Monthly fee for ${month} is already fully paid. Only outstanding security deposit can be collected.`
      });
    }

    if (feeRow && feeRow.status === 'paid' && breakdown.depositDue === 0) {
      await tx.abort();
      return res.status(400).json({
        success: false,
        message: 'Both monthly fee and security deposit are already fully settled. No payment due.'
      });
    }

    // Generate or validate distinct receipt numbers
    const feeReceiptNo = feeCore > 0
      ? (receiptNo || `RCPT-FEE-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`)
      : null;
    const depositReceiptNo = numSecDeposit > 0
      ? (reqDepositReceiptNo || (feeCore === 0 ? receiptNo : null) || `RCPT-DEP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`)
      : null;

    // Check duplicate receipt numbers within organization
    if (orgId && feeReceiptNo) {
      const existingReceipt = await withSession(FeePayment.findOne({
        receiptNo: feeReceiptNo,
        organizationId: orgId
      }));

      if (existingReceipt) {
        await tx.abort();
        return res.status(409).json({
          success: false,
          message: `Receipt number "${feeReceiptNo}" has already been issued.`
        });
      }
    }

    if (orgId && depositReceiptNo) {
      const existingDepositReceipt = await withSession(SecurityDeposit.findOne({
        receiptNo: depositReceiptNo,
        organizationId: orgId
      }));

      if (existingDepositReceipt) {
        await tx.abort();
        return res.status(409).json({
          success: false,
          message: `Security Deposit Receipt number "${depositReceiptNo}" has already been issued.`
        });
      }
    }

    // 1. Ensure or update monthly fee row
    if (!feeRow) {
      const newFees = await Fee.create([{
        studentId,
        organizationId: orgId || null,
        hostelId: student.hostelId || null,
        hostel: actualHostel,
        month,
        amount: numAmount,
        lateFee: numLateFee,
        discount: numDiscount,
        status: 'unpaid',
        paymentMode,
        dueDate: breakdown.dueDate,
        periodStart: breakdown.periodStart,
        periodEnd: breakdown.periodEnd,
        cycleNumber: breakdown.billingCycle?.cycleIndex ?? null,
      }], sessionOpts);
      feeRow = newFees[0];
    } else if (feeCore > 0) {
      feeRow = await Fee.findByIdAndUpdate(
        feeRow._id,
        {
          lateFee: numLateFee,
          discount: numDiscount,
          amount: numAmount,
          ...(breakdown.dueDate && !feeRow.dueDate ? { dueDate: breakdown.dueDate } : {}),
        },
        session ? { new: true, session } : { new: true }
      );
    }

    const now = new Date();

    // 2. Create the FeePayment record (tracks fee allocation + cross-reference to deposit receipt)
    const primaryReceiptNo = feeReceiptNo || depositReceiptNo;
    const payments = await FeePayment.create([{
      feeId: feeRow._id,
      studentId,
      organizationId: orgId || null,
      hostelId: student.hostelId || null,
      hostel: actualHostel,
      receiptNo: primaryReceiptNo,
      depositReceiptNo: depositReceiptNo || undefined,
      receiptUrl,
      amount: feeCore,
      lateFee: numLateFee,
      discount: numDiscount,
      securityDeposit: numSecDeposit,
      paymentMode,
      paymentDate: now,
      adminId: req.user._id,
      adminName: req.user.name,
      month,
      notes: notes || null,
      idempotencyKey: idempotencyKey || null,
    }], sessionOpts);
    const payment = payments[0];

    // 3. Security deposit tracking: update pending deposit or record new collected deposit
    if (numSecDeposit > 0) {
      const pendingDeposit = await withSession(SecurityDeposit.findOne({
        studentId,
        status: 'pending',
        ...(orgId ? { organizationId: orgId } : {}),
      }));

      const previouslyCollected = breakdown.securityDepositCollected || 0;
      const totalPaidNow = previouslyCollected + numSecDeposit;
      const isSettled = totalPaidNow >= breakdown.securityDepositRequired;

      if (pendingDeposit) {
        pendingDeposit.status = isSettled ? 'collected' : 'pending';
        if (!pendingDeposit.amount || pendingDeposit.amount < totalPaidNow) {
          pendingDeposit.amount = breakdown.securityDepositRequired || student.securityDeposit || totalPaidNow;
        }
        pendingDeposit.paidAmount = totalPaidNow;
        pendingDeposit.collectedDate = now;
        pendingDeposit.paymentMode = paymentMode;
        pendingDeposit.receiptNo = depositReceiptNo;
        pendingDeposit.adminId = req.user._id;
        pendingDeposit.adminName = req.user.name;
        pendingDeposit.feePaymentId = payment._id;
        pendingDeposit.notes = notes || 'Security deposit collected';
        await pendingDeposit.save(session ? { session } : undefined);
      } else {
        await SecurityDeposit.create([{
          studentId,
          organizationId: orgId || null,
          hostelId: student.hostelId || null,
          hostel: actualHostel,
          amount: breakdown.securityDepositRequired || student.securityDeposit || numSecDeposit,
          paidAmount: totalPaidNow,
          collectedDate: now,
          status: isSettled ? 'collected' : 'pending',
          paymentMode,
          receiptNo: depositReceiptNo,
          adminId: req.user._id,
          adminName: req.user.name,
          feePaymentId: payment._id,
          notes: notes || 'Security deposit collected',
        }], sessionOpts);
      }
    }

    // 4. Update Fee status and extend validDate if fee was collected
    let newPaidAmount = feeRow.paidAmount || 0;
    if (feeCore > 0) {
      newPaidAmount += feeCore;
      if (newPaidAmount >= totalDue) {
        await Fee.findByIdAndUpdate(
          feeRow._id,
          { status: 'paid', paidAmount: newPaidAmount, paidDate: now, receiptNo: feeReceiptNo },
          session ? { session } : undefined
        );
        if (student && (student.startDate || student.validDate)) {
          const anchor = student.startDate || student.validDate;
          const nextDue = getNextMonthlyDueDate(anchor, 1);
          await Student.findByIdAndUpdate(
            studentId,
            { validDate: nextDue },
            session ? { session } : undefined
          );
        }
      } else {
        await Fee.findByIdAndUpdate(
          feeRow._id,
          { status: 'partial', paidAmount: newPaidAmount, paidDate: now },
          session ? { session } : undefined
        );
      }
    }

    await tx.commit();

    // Construct structured receipts payload for immediate download / presentation
    const feeReceipt = feeCore > 0 ? {
      receiptNo: feeReceiptNo,
      receipt_no: feeReceiptNo,
      amount: feeCore,
      amount_paid: feeCore,
      monthly_fee: numAmount,
      late_fee: numLateFee,
      discount: numDiscount,
      month,
      billing_period: breakdown.periodStart && breakdown.periodEnd
        ? `${new Date(breakdown.periodStart).toLocaleDateString('en-IN')} - ${new Date(breakdown.periodEnd).toLocaleDateString('en-IN')}`
        : undefined,
      payment_mode: paymentMode,
      paymentMode,
      payment_date: now.toISOString(),
      paymentDate: now.toISOString(),
      deposit_collected_separately: numSecDeposit > 0 ? numSecDeposit : null,
      deposit_receipt_no: depositReceiptNo,
      remaining_fee_balance: Math.max(0, totalDue - newPaidAmount),
      student_name: student.name,
      username: student.username,
      student_code: student.studentCode,
      room_no: student.roomNo,
      hostel: actualHostel,
      admin_name: req.user.name,
      notes,
    } : null;

    const depositReceipt = numSecDeposit > 0 ? {
      receiptNo: depositReceiptNo,
      receipt_no: depositReceiptNo,
      deposit_amount: numSecDeposit,
      amount: numSecDeposit,
      total_required: breakdown.securityDepositRequired,
      previously_paid: breakdown.securityDepositCollected || 0,
      remaining_balance: Math.max(0, breakdown.depositDue - numSecDeposit),
      payment_mode: paymentMode,
      paymentMode,
      payment_date: now.toISOString(),
      paymentDate: now.toISOString(),
      student_name: student.name,
      username: student.username,
      student_code: student.studentCode,
      room_no: student.roomNo,
      hostel: actualHostel,
      admin_name: req.user.name,
      notes,
    } : null;

    return res.status(200).json({
      success: true,
      data: {
        payment,
        feeReceipt,
        depositReceipt,
      }
    });
  } catch (error) {
    await tx.abort();
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

// @desc    Send fee statement / reminder email to a student
// @route   POST /api/fees/send-reminder/:studentId
// @access  Admin
const sendFeeReminderEmail = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month } = req.body;
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const studentQuery = { _id: studentId };
    if (orgId && !isSuperAdmin) {
      studentQuery.organizationId = orgId;
    }

    const student = await Student.findOne(studentQuery);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (!student.email || !student.email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Student has no registered email address' });
    }

    const targetMonth = month || new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
    const fee = await Fee.findOne({ studentId: student._id, month: targetMonth });

    const monthlyAmount = fee?.amount ?? (student.fees || 0);
    const lateFee = fee?.lateFee || 0;
    const paidAmount = fee?.paidAmount || 0;
    const discount = fee?.discount || 0;
    const totalDue = fee ? Math.max(0, monthlyAmount + lateFee - paidAmount - discount) : (student.fees || 0);
    const feeStatus = fee ? (fee.status || (totalDue === 0 ? 'paid' : 'pending')) : (totalDue === 0 ? 'paid' : 'pending');

    const emailUtils = require('../utils/email');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #6366f1; margin: 0 0 6px 0;">Hostel Fee Statement & Notice</h2>
          <p style="color: #64748b; font-size: 14px; margin: 0;">${student.hostel} Hostel — Resident Billing</p>
        </div>

        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
          Dear <strong>${student.name}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0 0 16px 0;">
          Here is your official hostel fee status statement for the billing period of <strong>${targetMonth}</strong>.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Student Code:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right; font-family: monospace;">${student.studentCode || student.username}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Room No:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right;">${student.roomNo || 'N/A'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Fee Month:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right;">${targetMonth}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 6px 0;">Monthly Rent:</td>
              <td style="color: #0f172a; font-weight: 600; text-align: right;">₹${monthlyAmount.toLocaleString('en-IN')}</td>
            </tr>
            ${lateFee > 0 ? `
            <tr>
              <td style="color: #d97706; padding: 6px 0;">Late Fee:</td>
              <td style="color: #d97706; font-weight: 600; text-align: right;">₹${lateFee.toLocaleString('en-IN')}</td>
            </tr>` : ''}
            ${paidAmount > 0 ? `
            <tr>
              <td style="color: #10b981; padding: 6px 0;">Paid Amount:</td>
              <td style="color: #10b981; font-weight: 600; text-align: right;">₹${paidAmount.toLocaleString('en-IN')}</td>
            </tr>` : ''}
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="color: #0f172a; font-weight: 700; padding: 10px 0 0 0; font-size: 15px;">Total Balance Due:</td>
              <td style="color: ${totalDue > 0 ? '#ef4444' : '#10b981'}; font-weight: 700; text-align: right; padding: 10px 0 0 0; font-size: 16px;">
                ₹${totalDue.toLocaleString('en-IN')} (${totalDue > 0 ? 'Pending' : 'Settled'})
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 16px 0;">
          Hostel fees are collected offline at the hostel administration desk. Please contact your branch administrator or warden to clear any outstanding dues.
        </p>

        <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; margin-top: 20px; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">Sent by ${student.hostel} Hostel Administration via Q2 Connect Suite.</p>
        </div>
      </div>
    `;

    await emailUtils.sendEmail({
      to: student.email,
      subject: `Hostel Fee Statement — ${targetMonth} (${student.hostel} Hostel)`,
      html,
      text: `Hello ${student.name}, your hostel fee for ${targetMonth} at ${student.hostel} is ₹${totalDue} (${feeStatus.toUpperCase()}). Please contact hostel administration for payment clearance.`,
      purpose: 'FEE_REMINDER',
      targetStudentId: student._id,
      metadata: { month: targetMonth, totalDue, monthlyAmount },
    });

    return res.status(200).json({
      success: true,
      message: `Fee statement email sent successfully to ${student.email}`,
    });
  } catch (error) {
    console.error('sendFeeReminderEmail error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to send fee statement email' });
  }
};

module.exports = {
  getFeeManagementDashboard,
  calculatePayableFeeEndpoint,
  getFees,
  createFee,
  updateFee,
  generateMonthlyFees,
  getFeePayments,
  getSecurityDeposits,
  collectPayment,
  sendFeeReminderEmail,
};
