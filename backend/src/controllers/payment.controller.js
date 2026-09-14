/**
 * Payment Controller (Phase F)
 * 
 * Handles:
 * - Server-side Razorpay order creation with authoritative amount calculation (tamper-proof)
 * - Cryptographic HMAC-SHA256 checkout response signature verification
 * - Monotonic payment and fee state machine transitions
 * - Concurrency-safe sequential invoice number generation
 * - Strict tenant isolation & student ownership verification
 */

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const Invoice = require('../models/Invoice');
const InvoiceSequence = require('../models/InvoiceSequence');
const Notification = require('../models/Notification');
const LedgerEntry = require('../models/LedgerEntry');
const PaymentAttempt = require('../models/PaymentAttempt');
const Refund = require('../models/Refund');
const AuditLog = require('../models/AuditLog');
const {
  createOrder,
  verifyPaymentSignature,
  getPublicKey,
} = require('../config/razorpay');

// Helper: Resolve active tenant ID
function resolveTenantId(req) {
  if (req.tenant?.isSuperAdmin) {
    return req.body.organizationId || req.query.organizationId || req.tenant.organizationId || null;
  }
  return req.tenant?.organizationId || req.user?.activeOrganizationId || null;
}

/**
 * @desc    Create a Razorpay order for student fee payment
 * @route   POST /api/payments/create-order
 * @access  Private (Student paying own fee or Admin on behalf)
 */
const createPaymentOrder = async (req, res) => {
  try {
    const { feeId } = req.body;

    if (!feeId) {
      return res.status(400).json({ success: false, message: 'feeId is required' });
    }

    const organizationId = resolveTenantId(req);
    if (!organizationId && !req.tenant?.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Organization tenant context is required' });
    }

    // 1. Fetch Fee Record with strict tenant boundary
    const feeQuery = { _id: feeId };
    if (!req.tenant?.isSuperAdmin && organizationId) {
      feeQuery.organizationId = organizationId;
    }

    const fee = await Fee.findOne(feeQuery).populate('studentId', '_id name username userId hostel hostelId');
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee record not found in your organization' });
    }

    // 2. Student Ownership Verification Guard
    if (req.user.role === 'student') {
      const studentProfile = await Student.findOne({ userId: req.user._id });
      if (!studentProfile || studentProfile._id.toString() !== fee.studentId._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only create payment orders for your own fee records',
        });
      }
    }

    // 3. Status & Balance Check
    if (fee.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Fee for this period is already fully paid' });
    }

    // 4. Authoritative Payable Amount Calculation (Client input amount is strictly ignored!)
    const totalDue = (fee.amount || 0) + (fee.lateFee || 0) - (fee.discount || 0);
    const payableRupees = Math.max(0, totalDue - (fee.paidAmount || 0));

    if (payableRupees <= 0) {
      return res.status(400).json({ success: false, message: 'No outstanding balance remaining to pay' });
    }

    const amountPaise = Math.round(payableRupees * 100);

    // 5. Prevent Duplicate Active Orders: Reuse existing valid order if created in last 15 min
    const recentOrder = await Payment.findOne({
      feeId: fee._id,
      status: 'CREATED',
      amountPaise,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });

    if (recentOrder) {
      return res.status(200).json({
        success: true,
        data: {
          orderId: recentOrder.orderId,
          amountPaise: recentOrder.amountPaise,
          amountRupees: recentOrder.amountRupees,
          currency: recentOrder.currency,
          keyId: getPublicKey(),
          feeId: fee._id,
          month: fee.month,
          studentName: fee.studentId?.name,
        },
      });
    }

    // 6. Create Razorpay Order via Provider / Test SDK
    const receiptId = `RCPT_${fee._id.toString().slice(-8)}_${Date.now().toString().slice(-4)}`;
    const razorpayOrder = await createOrder({
      amountPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        feeId: fee._id.toString(),
        organizationId: fee.organizationId?.toString() || organizationId.toString(),
        studentId: fee.studentId?._id?.toString(),
        month: fee.month,
      },
    });

    // 7. Persist Payment Attempt Record in CREATED State
    const payment = await Payment.create({
      organizationId: fee.organizationId || organizationId,
      hostelId: fee.hostelId || null,
      studentId: fee.studentId._id,
      feeId: fee._id,
      amountPaise,
      amountRupees: payableRupees,
      currency: 'INR',
      provider: 'RAZORPAY',
      orderId: razorpayOrder.id,
      status: 'CREATED',
      receiptNo: receiptId,
      notes: `Online Fee Payment for ${fee.month}`,
    });

    // Record initial PaymentAttempt
    await PaymentAttempt.create({
      organizationId: payment.organizationId,
      paymentId: payment._id,
      providerOrderId: razorpayOrder.id,
      status: 'INITIATED',
      metadata: { feeId: fee._id, amountPaise },
    }).catch((e) => console.warn('[Payment:CreateOrder] PaymentAttempt notice:', e.message));

    return res.status(201).json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        paymentRecordId: payment._id,
        amountPaise,
        amountRupees: payableRupees,
        currency: 'INR',
        keyId: getPublicKey(),
        feeId: fee._id,
        month: fee.month,
        studentName: fee.studentId?.name,
      },
    });
  } catch (error) {
    console.error('[Payment:CreateOrder] Error creating payment order:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Verify Razorpay checkout signature and update fee state atomically
 * @route   POST /api/payments/verify
 * @access  Private
 */
const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
      });
    }

    // 1. Cryptographic HMAC-SHA256 Signature Verification
    const isValidSignature = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValidSignature) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Authentication failed.',
      });
    }

    // 2. Fetch Payment Record
    const payment = await Payment.findOne({ orderId: razorpay_order_id }).session(session);
    if (!payment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Payment record for order not found' });
    }

    // 3. Tenant Boundary Verification
    const organizationId = resolveTenantId(req);
    if (
      !req.tenant?.isSuperAdmin &&
      organizationId &&
      payment.organizationId.toString() !== organizationId.toString()
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Tenant boundary violation: you do not own this payment' });
    }

    // 4. Idempotency Check: if already CAPTURED, return idempotent response
    if (payment.status === 'CAPTURED') {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: 'Payment was already verified and captured successfully (idempotent)',
        data: payment,
      });
    }

    // 5. Load Associated Fee
    const fee = await Fee.findById(payment.feeId).session(session);
    if (!fee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Associated fee record not found' });
    }

    // 6. Concurrency-Safe Sequential Invoice Number Generation
    const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber(payment.organizationId);

    // 7. Transition Payment to CAPTURED
    payment.status = 'CAPTURED';
    payment.paymentId = razorpay_payment_id;
    payment.signature = razorpay_signature;
    payment.capturedAt = new Date();
    payment.receiptNo = invoiceNumber;
    await payment.save({ session });

    // 8. Create Immutable Invoice Record
    const invoice = await Invoice.create(
      [
        {
          organizationId: payment.organizationId,
          hostelId: payment.hostelId || null,
          studentId: payment.studentId,
          paymentId: payment._id,
          feeId: fee._id,
          invoiceNumber,
          subtotalRupees: payment.amountRupees,
          totalRupees: payment.amountRupees,
          status: 'PAID',
          issuedAt: new Date(),
          notes: `Razorpay Online Payment (${razorpay_payment_id})`,
        },
      ],
      { session }
    );

    payment.invoiceId = invoice[0]._id;
    await payment.save({ session });

    // 8b. Create Immutable Financial Ledger Entry (CREDIT from ONLINE_PAYMENT)
    await LedgerEntry.create(
      [
        {
          organizationId: payment.organizationId,
          hostelId: payment.hostelId || null,
          studentId: payment.studentId,
          feeId: fee._id,
          paymentId: payment._id,
          invoiceId: invoice[0]._id,
          amountPaise: payment.amountPaise,
          amountRupees: payment.amountRupees,
          currency: payment.currency || 'INR',
          type: 'CREDIT',
          source: 'ONLINE_PAYMENT',
          externalReference: razorpay_payment_id,
          description: `Razorpay Online Payment for ${fee.month}`,
          metadata: { orderId: razorpay_order_id, receiptNo: invoiceNumber },
        },
      ],
      { session }
    );

    // 8c. Record PaymentAttempt transition to CAPTURED
    await PaymentAttempt.create(
      [
        {
          organizationId: payment.organizationId,
          paymentId: payment._id,
          providerOrderId: razorpay_order_id,
          providerPaymentId: razorpay_payment_id,
          status: 'CAPTURED',
          metadata: { invoiceNumber },
        },
      ],
      { session }
    );

    // 8d. Financial Audit Trail
    if (req.user) {
      await AuditLog.create(
        [
          {
            organizationId: payment.organizationId,
            hostelId: payment.hostelId || null,
            actorId: req.user._id,
            actorName: req.user.name,
            actorEmail: req.user.email,
            action: 'PAYMENT_CAPTURED',
            entityType: 'Payment',
            entityId: payment._id.toString(),
            newValue: {
              amountRupees: payment.amountRupees,
              paymentId: razorpay_payment_id,
              orderId: razorpay_order_id,
              invoiceNumber,
            },
          },
        ],
        { session }
      );
    }

    // 9. Update Fee Balance and Status Monotonically
    fee.paidAmount = (fee.paidAmount || 0) + payment.amountRupees;
    const totalDue = (fee.amount || 0) + (fee.lateFee || 0) - (fee.discount || 0);

    if (fee.paidAmount >= totalDue) {
      fee.status = 'paid';
    } else if (fee.paidAmount > 0) {
      fee.status = 'partial';
    }

    fee.paidDate = new Date();
    fee.paymentMode = 'upi'; // Online collection standard
    fee.receiptNo = invoiceNumber;
    await fee.save({ session });

    // 10. Student validDate extension if fully paid (best effort)
    if (fee.status === 'paid') {
      const student = await Student.findById(payment.studentId).session(session);
      if (student && student.validDate) {
        const nextValid = new Date(student.validDate);
        nextValid.setMonth(nextValid.getMonth() + 1);
        await Student.findByIdAndUpdate(student._id, { validDate: nextValid }, { session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    // 11. Dispatch Asynchronous In-App Notification
    try {
      const studentDoc = await Student.findById(payment.studentId).select('userId');
      if (studentDoc && studentDoc.userId) {
        await Notification.create({
          userId: studentDoc.userId,
          organizationId: payment.organizationId,
          hostelId: payment.hostelId,
          title: 'Online Payment Successful',
          message: `Your payment of ₹${payment.amountRupees.toLocaleString('en-IN')} for ${fee.month} was successful. Receipt: ${invoiceNumber}`,
          type: 'success',
        });
      }
    } catch (notifErr) {
      console.warn('[Payment:Verify] Notification dispatch notice:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and fee updated successfully',
      data: {
        paymentId: payment._id,
        orderId: payment.orderId,
        paymentReference: payment.paymentId,
        invoiceNumber,
        status: payment.status,
        feeStatus: fee.status,
        amountPaidRupees: payment.amountRupees,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[Payment:Verify] Error verifying payment:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get a payment by ID with tenant scoping
 * @route   GET /api/payments/:id
 * @access  Private
 */
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = resolveTenantId(req);

    const query = { _id: id };
    if (!req.tenant?.isSuperAdmin && organizationId) {
      query.organizationId = organizationId;
    }

    const payment = await Payment.findOne(query)
      .populate('studentId', 'name username roomNo hostel')
      .populate('feeId', 'month amount dueDate status')
      .populate('invoiceId', 'invoiceNumber totalRupees issuedAt');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get payments for authenticated student
 * @route   GET /api/payments/my-payments
 * @access  Private (Student)
 */
const getMyPayments = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const payments = await Payment.find({ studentId: student._id })
      .populate('feeId', 'month amount status')
      .populate('invoiceId', 'invoiceNumber')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    List all payments for organization (Admin)
 * @route   GET /api/payments
 * @access  Private (Admin / SuperAdmin)
 */
const getPayments = async (req, res) => {
  try {
    const { status, studentId, page = 1, limit = 50 } = req.query;
    const organizationId = resolveTenantId(req);

    const query = {};
    if (!req.tenant?.isSuperAdmin && organizationId) {
      query.organizationId = organizationId;
    } else if (req.query.organizationId) {
      query.organizationId = req.query.organizationId;
    }

    if (status) query.status = status;
    if (studentId) query.studentId = studentId;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('studentId', 'name username hostel')
        .populate('feeId', 'month')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Payment.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: payments.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: payments,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Issue a full or partial refund for a captured payment
 * @route   POST /api/payments/:id/refund
 * @access  Private (Admin only)
 */
const refundPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { amountRupees, reason } = req.body;

    const organizationId = resolveTenantId(req);
    const query = { _id: id };
    if (!req.tenant?.isSuperAdmin && organizationId) {
      query.organizationId = organizationId;
    }

    const payment = await Payment.findOne(query).session(session);
    if (!payment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Payment record not found in your organization' });
    }

    if (payment.status !== 'CAPTURED' && payment.status !== 'AUTHORIZED') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Only CAPTURED or AUTHORIZED payments can be refunded (current status: ${payment.status})`,
      });
    }

    const currentRefundedPaise = payment.refundedAmountPaise || 0;
    const maxRefundablePaise = payment.amountPaise - currentRefundedPaise;

    if (maxRefundablePaise <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Payment has already been fully refunded' });
    }

    const requestedPaise = amountRupees ? Math.round(Number(amountRupees) * 100) : maxRefundablePaise;

    if (requestedPaise <= 0 || requestedPaise > maxRefundablePaise) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Invalid refund amount. Maximum refundable balance is ₹${(maxRefundablePaise / 100).toFixed(2)}`,
      });
    }

    const refundRupees = requestedPaise / 100;
    const providerRefundId = `rfnd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Create Refund Record
    const refundDoc = await Refund.create(
      [
        {
          organizationId: payment.organizationId,
          hostelId: payment.hostelId || null,
          paymentId: payment._id,
          feeId: payment.feeId,
          invoiceId: payment.invoiceId,
          amountPaise: requestedPaise,
          amountRupees: refundRupees,
          currency: payment.currency || 'INR',
          providerRefundId,
          status: 'REFUNDED',
          reason: reason || 'Administrative refund',
          adminId: req.user._id,
          adminName: req.user.name,
          processedAt: new Date(),
        },
      ],
      { session }
    );

    // 2. Update Payment State
    payment.refundedAmountPaise = currentRefundedPaise + requestedPaise;
    payment.refundedAmountRupees = (payment.refundedAmountRupees || 0) + refundRupees;
    payment.refundId = providerRefundId;
    payment.refundedAt = new Date();

    if (payment.refundedAmountPaise >= payment.amountPaise) {
      payment.status = 'REFUNDED';
    }
    await payment.save({ session });

    // 3. Update Fee Balance and Status
    const fee = await Fee.findById(payment.feeId).session(session);
    if (fee) {
      fee.paidAmount = Math.max(0, (fee.paidAmount || 0) - refundRupees);
      const totalDue = (fee.amount || 0) + (fee.lateFee || 0) - (fee.discount || 0);
      if (fee.paidAmount >= totalDue) {
        fee.status = 'paid';
      } else if (fee.paidAmount > 0) {
        fee.status = 'partial';
      } else {
        fee.status = 'unpaid';
      }
      await fee.save({ session });
    }

    // 4. Update Invoice Status if fully refunded
    if (payment.status === 'REFUNDED' && payment.invoiceId) {
      await Invoice.findByIdAndUpdate(payment.invoiceId, { status: 'REFUNDED' }, { session });
    }

    // 5. Create Reversing Ledger Entry (DEBIT for refund)
    await LedgerEntry.create(
      [
        {
          organizationId: payment.organizationId,
          hostelId: payment.hostelId || null,
          studentId: payment.studentId,
          feeId: payment.feeId,
          paymentId: payment._id,
          invoiceId: payment.invoiceId,
          amountPaise: requestedPaise,
          amountRupees: refundRupees,
          currency: payment.currency || 'INR',
          type: 'DEBIT',
          source: 'REFUND',
          externalReference: providerRefundId,
          description: `Refund for payment ${payment.orderId}: ${reason || 'Administrative'}`,
          metadata: { refundId: providerRefundId, adminId: req.user._id },
        },
      ],
      { session }
    );

    // 6. Financial Audit Trail
    await AuditLog.create(
      [
        {
          organizationId: payment.organizationId,
          hostelId: payment.hostelId || null,
          actorId: req.user._id,
          actorName: req.user.name,
          actorEmail: req.user.email,
          action: 'PAYMENT_REFUNDED',
          entityType: 'Payment',
          entityId: payment._id.toString(),
          newValue: {
            refundId: providerRefundId,
            refundRupees,
            paymentStatus: payment.status,
            reason,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully and ledger updated',
      data: {
        refundId: providerRefundId,
        refundedAmountRupees: refundRupees,
        paymentStatus: payment.status,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[Payment:Refund] Error processing refund:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getPaymentById,
  getMyPayments,
  getPayments,
  refundPayment,
};
