/**
 * Webhook Controller (Phase F)
 * 
 * Handles incoming Razorpay webhooks:
 * - Validates HMAC-SHA256 signature against unmodified raw request body
 * - Enforces durable idempotency via WebhookEvent collection (x-razorpay-event-id)
 * - Safely handles out-of-order and duplicate webhook events
 * - Monotonically updates Payment, Fee, and Invoice records
 */

const mongoose = require('mongoose');
const WebhookEvent = require('../models/WebhookEvent');
const Payment = require('../models/Payment');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const Invoice = require('../models/Invoice');
const InvoiceSequence = require('../models/InvoiceSequence');
const Notification = require('../models/Notification');
const { verifyWebhookSignature } = require('../config/razorpay');

/**
 * @desc    Handle Razorpay Webhook Events
 * @route   POST /api/webhooks/razorpay
 * @access  Public (Guarded cryptographically by HMAC-SHA256 signature)
 */
const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const eventId = req.headers['x-razorpay-event-id'] || req.body?.event_id || req.body?.id;

    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing x-razorpay-signature header' });
    }

    // 1. Verify Webhook Signature against Raw Body
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const isValid = verifyWebhookSignature({ rawBody, signature });

    if (!isValid) {
      console.warn('[Webhook:Razorpay] Signature verification failed');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body?.event;
    const providerEventId = eventId || `ev_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    // 2. Durable Webhook Idempotency Check (MongoDB source of truth)
    const existingEvent = await WebhookEvent.findOne({
      provider: 'RAZORPAY',
      providerEventId,
    });

    if (existingEvent) {
      // Event already received and handled; suppress duplicate financial execution
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'Duplicate webhook event received and safely suppressed without duplicate side-effects',
        eventId: providerEventId,
      });
    }

    // 3. Durably Persist Webhook Event in RECEIVED State
    let webhookRecord;
    try {
      webhookRecord = await WebhookEvent.create({
        provider: 'RAZORPAY',
        providerEventId,
        eventType: event || 'unknown',
        payload: req.body,
        status: 'RECEIVED',
      });
    } catch (insertErr) {
      // Catch race condition if parallel identical webhooks arrived simultaneously
      if (insertErr.code === 11000) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: 'Duplicate webhook event caught by unique constraint',
        });
      }
      throw insertErr;
    }

    // 4. Process Financial Events Monotonically
    const payload = req.body?.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        await processPaymentCapturedEvent(orderId, paymentId, paymentEntity);
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        await processPaymentFailedEvent(orderId, paymentEntity);
      }
    } else if (event === 'refund.processed' || event === 'refund.created') {
      const refundEntity = payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;
      if (paymentId) {
        await processRefundEvent(paymentId, refundEntity);
      }
    }

    // 5. Mark Event PROCESSED
    webhookRecord.status = 'PROCESSED';
    webhookRecord.processedAt = new Date();
    await webhookRecord.save();

    return res.status(200).json({
      success: true,
      processed: true,
      eventId: providerEventId,
    });
  } catch (error) {
    console.error('[Webhook:Razorpay] Error processing webhook event:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Atomically handles payment captured event.
 * Idempotent: safe if verification endpoint already processed it.
 */
async function processPaymentCapturedEvent(orderId, paymentId, paymentEntity) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await Payment.findOne({ orderId }).session(session);
    if (!payment) {
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // If already CAPTURED, maintain monotonic state (no duplicate invoices or fee updates)
    if (payment.status === 'CAPTURED') {
      await session.commitTransaction();
      session.endSession();
      return;
    }

    payment.status = 'CAPTURED';
    payment.paymentId = paymentId || payment.paymentId;
    payment.capturedAt = new Date();
    if (paymentEntity?.method) {
      payment.paymentMethod = paymentEntity.method;
    }

    const fee = await Fee.findById(payment.feeId).session(session);
    if (fee) {
      const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber(payment.organizationId);
      payment.receiptNo = invoiceNumber;

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
            notes: `Razorpay Webhook Captured (${paymentId})`,
          },
        ],
        { session }
      );

      payment.invoiceId = invoice[0]._id;

      fee.paidAmount = (fee.paidAmount || 0) + payment.amountRupees;
      const totalDue = (fee.amount || 0) + (fee.lateFee || 0) - (fee.discount || 0);
      fee.status = fee.paidAmount >= totalDue ? 'paid' : 'partial';
      fee.paidDate = new Date();
      fee.paymentMode = 'upi';
      fee.receiptNo = invoiceNumber;
      await fee.save({ session });

      if (fee.status === 'paid') {
        const student = await Student.findById(payment.studentId).session(session);
        if (student && student.validDate) {
          const cur = new Date(student.validDate);
          cur.setMonth(cur.getMonth() + 1);
          await Student.findByIdAndUpdate(student._id, { validDate: cur }, { session });
        }
      }
    }

    await payment.save({ session });
    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

/**
 * Handles payment failure event without corrupting Fee state.
 */
async function processPaymentFailedEvent(orderId, paymentEntity) {
  const payment = await Payment.findOne({ orderId });
  if (!payment) return;

  // Never downgrade a CAPTURED payment to FAILED if out-of-order webhook arrived
  if (payment.status === 'CAPTURED') {
    return;
  }

  payment.status = 'FAILED';
  payment.failedAt = new Date();
  payment.failureCode = paymentEntity?.error_code || 'PAYMENT_FAILED';
  payment.failureReason = paymentEntity?.error_description || 'Payment failed at provider';
  await payment.save();
}

/**
 * Handles refund processed event.
 */
async function processRefundEvent(paymentId, refundEntity) {
  const payment = await Payment.findOne({ paymentId });
  if (!payment) return;

  payment.status = 'REFUNDED';
  payment.refundedAt = new Date();
  payment.refundId = refundEntity?.id;
  await payment.save();

  if (payment.invoiceId) {
    await Invoice.findByIdAndUpdate(payment.invoiceId, { status: 'REFUNDED' });
  }
}

module.exports = {
  handleRazorpayWebhook,
};
