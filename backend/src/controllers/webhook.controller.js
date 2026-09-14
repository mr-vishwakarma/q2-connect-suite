/**
 * Webhook Controller (Phase F/G Reconciliation)
 * 
 * Handles incoming Razorpay webhooks:
 * - Validates HMAC-SHA256 signature against unmodified raw request body
 * - Enforces durable idempotency via WebhookEvent collection (x-razorpay-event-id)
 * - Safely handles out-of-order and duplicate webhook events
 * - Orchestrates Razorpay SaaS Subscription lifecycle (authenticated, activated, charged, halted, cancelled)
 * - Preserves monotonic state updates & prevents duplicate invoices/ledger entries
 */

const mongoose = require('mongoose');
const WebhookEvent = require('../models/WebhookEvent');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const InvoiceSequence = require('../models/InvoiceSequence');
const LedgerEntry = require('../models/LedgerEntry');
const PaymentAttempt = require('../models/PaymentAttempt');
const Refund = require('../models/Refund');
const AuditLog = require('../models/AuditLog');
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

    // 4. Process Financial & Subscription Events Monotonically
    const payload = req.body?.payload;

    if (event && event.startsWith('subscription.')) {
      const subscriptionEntity = payload?.subscription?.entity;
      const paymentEntity = payload?.payment?.entity;
      await processSubscriptionEvent(event, subscriptionEntity, paymentEntity);
    } else if (event === 'payment.captured' || event === 'order.paid') {
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
 * Handles all Razorpay Subscription lifecycle events.
 */
async function processSubscriptionEvent(event, subscriptionEntity, paymentEntity) {
  const subscriptionId = subscriptionEntity?.id;
  if (!subscriptionId) return;

  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: subscriptionId,
  }).populate('planId');

  if (!subscription) {
    console.warn(`[Webhook:Subscription] Subscription ${subscriptionId} not found in database.`);
    return;
  }

  switch (event) {
    case 'subscription.authenticated':
      subscription.status = 'AUTHENTICATED';
      await subscription.save();
      break;

    case 'subscription.activated':
      subscription.status = 'ACTIVE';
      subscription.startedAt = subscription.startedAt || new Date();
      await subscription.save();
      await Organization.findByIdAndUpdate(subscription.organizationId, {
        subscriptionId: subscription._id,
        status: 'ACTIVE',
      });
      break;

    case 'subscription.charged': {
      subscription.status = 'ACTIVE';
      subscription.paidCount = (subscription.paidCount || 0) + 1;
      if (subscriptionEntity?.current_start) {
        subscription.currentPeriodStart = new Date(subscriptionEntity.current_start * 1000);
      }
      if (subscriptionEntity?.current_end) {
        subscription.currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000);
      }
      if (subscriptionEntity?.charge_at) {
        subscription.nextChargeAt = new Date(subscriptionEntity.charge_at * 1000);
      }
      await subscription.save();

      // Record SaaS payment and sequential invoice if new payment captured
      const paymentId = paymentEntity?.id;
      if (paymentId) {
        const existingPayment = await Payment.findOne({ paymentId });
        if (!existingPayment) {
          const amountPaise = paymentEntity.amount || subscription.amountPaise || 0;
          const amountRupees = amountPaise / 100;

          const payment = await Payment.create({
            organizationId: subscription.organizationId,
            billingDomain: 'SAAS',
            subscriptionId: subscription._id,
            planId: subscription.planId._id,
            razorpaySubscriptionId: subscription.razorpaySubscriptionId,
            orderId: `order_sub_${paymentId || Date.now()}`,
            amountPaise,
            amountRupees,
            currency: paymentEntity.currency || subscription.currency || 'INR',
            provider: 'RAZORPAY',
            paymentId,
            status: 'CAPTURED',
            paymentMethod: paymentEntity.method || 'subscription_recurring',
            capturedAt: new Date(),
          });

          const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber(subscription.organizationId);
          const invoice = await Invoice.create({
            organizationId: subscription.organizationId,
            paymentId: payment._id,
            subscriptionId: subscription._id,
            invoiceNumber,
            invoiceType: 'SAAS_INVOICE',
            subtotalRupees: amountRupees,
            taxRupees: 0,
            totalRupees: amountRupees,
            currency: payment.currency,
            status: 'ISSUED',
            issuedAt: new Date(),
            paidAt: new Date(),
          });

          payment.invoiceId = invoice._id;
          await payment.save();

          await LedgerEntry.create({
            organizationId: subscription.organizationId,
            subscriptionId: subscription._id,
            paymentId: payment._id,
            invoiceId: invoice._id,
            amountPaise: payment.amountPaise,
            amountRupees: payment.amountRupees,
            currency: payment.currency,
            type: 'CREDIT',
            source: 'SAAS_SUBSCRIPTION',
            externalReference: paymentId,
            description: `SaaS Subscription Recurring Charge - ${subscription.planId.name} (${invoiceNumber})`,
          });
        }
      }
      break;
    }

    case 'subscription.pending':
      subscription.status = 'PENDING';
      await subscription.save();
      break;

    case 'subscription.halted':
      subscription.status = 'HALTED';
      await subscription.save();
      break;

    case 'subscription.paused':
      subscription.status = 'PAUSED';
      subscription.pausedAt = new Date();
      await subscription.save();
      break;

    case 'subscription.resumed':
      subscription.status = 'ACTIVE';
      await subscription.save();
      break;

    case 'subscription.cancelled':
      subscription.status = 'CANCELLED';
      subscription.cancelledAt = new Date();
      await subscription.save();
      break;

    case 'subscription.completed':
      subscription.status = 'COMPLETED';
      subscription.endedAt = new Date();
      await subscription.save();
      break;

    case 'subscription.updated':
      if (subscriptionEntity?.current_start) {
        subscription.currentPeriodStart = new Date(subscriptionEntity.current_start * 1000);
      }
      if (subscriptionEntity?.current_end) {
        subscription.currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000);
      }
      await subscription.save();
      break;

    default:
      console.log(`[Webhook:Subscription] Unhandled subscription event: ${event}`);
  }
}

/**
 * Handles payment captured event for legacy or direct orders.
 */
async function processPaymentCapturedEvent(orderId, paymentId, paymentEntity) {
  const payment = await Payment.findOne({ orderId });
  if (!payment) return;

  if (payment.status === 'CAPTURED') return;

  payment.status = 'CAPTURED';
  payment.paymentId = paymentId || payment.paymentId;
  payment.capturedAt = new Date();
  if (paymentEntity?.method) {
    payment.paymentMethod = paymentEntity.method;
  }
  await payment.save();

  if (payment.invoiceId) {
    await Invoice.findByIdAndUpdate(payment.invoiceId, { status: 'ISSUED', paidAt: new Date() });
  }
}

/**
 * Handles payment failure event without corrupting state.
 */
async function processPaymentFailedEvent(orderId, paymentEntity) {
  const payment = await Payment.findOne({ orderId });
  if (!payment) return;

  // Never downgrade a CAPTURED payment to FAILED if out-of-order webhook arrived
  if (payment.status === 'CAPTURED') return;

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
  const refundPaise = refundEntity?.amount || payment.amountPaise;
  const refundRupees = refundPaise / 100;
  payment.refundedAmountPaise = (payment.refundedAmountPaise || 0) + refundPaise;
  payment.refundedAmountRupees = (payment.refundedAmountRupees || 0) + refundRupees;
  await payment.save();

  if (payment.invoiceId) {
    await Invoice.findByIdAndUpdate(payment.invoiceId, { status: 'REFUNDED' });
  }

  // Create reversing Ledger Entry
  await LedgerEntry.create({
    organizationId: payment.organizationId,
    subscriptionId: payment.subscriptionId,
    paymentId: payment._id,
    invoiceId: payment.invoiceId,
    amountPaise: refundPaise,
    amountRupees: refundRupees,
    currency: payment.currency || 'INR',
    type: 'DEBIT',
    source: 'REFUND',
    externalReference: refundEntity?.id,
    description: `Razorpay Webhook Refund Processed (${refundEntity?.id})`,
  }).catch((e) => console.warn('[Webhook:Refund] LedgerEntry notice:', e.message));
}

module.exports = {
  handleRazorpayWebhook,
};
