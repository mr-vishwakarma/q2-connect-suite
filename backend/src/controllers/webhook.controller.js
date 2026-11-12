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
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const Invoice = require('../models/Invoice');
const InvoiceSequence = require('../models/InvoiceSequence');
const LedgerEntry = require('../models/LedgerEntry');
const PaymentAttempt = require('../models/PaymentAttempt');
const Refund = require('../models/Refund');
const AuditLog = require('../models/AuditLog');
const Voucher = require('../models/Voucher');
const VoucherReservation = require('../models/VoucherReservation');
const VoucherRedemption = require('../models/VoucherRedemption');
const { verifyWebhookSignature } = require('../config/razorpay');
const { startSafeTransaction } = require('../utils/transaction');
const {
  finalizeOnlinePaymentActivation,
  recordOnlinePaymentFailure,
} = require('../services/subscriptionLifecycle.service');

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
 * Handles payment captured event for SaaS orders or legacy orders idempotently.
 */
async function processPaymentCapturedEvent(orderId, paymentId, paymentEntity) {
  const payment = await Payment.findOne({ orderId });
  if (payment && payment.status === 'CAPTURED') return;

  // Check if this order corresponds to a SaaS subscription checkout
  const isStudentFeePayment = Boolean(payment?.feeId && !payment?.subscriptionId);
  const subscription = !isStudentFeePayment
    ? (payment?.subscriptionId ? await Subscription.findById(payment.subscriptionId) : null) ||
      (await Subscription.findOne({
        $or: [{ 'pendingCheckout.orderId': orderId }, { orderId }],
      }))
    : null;

  if (subscription && (!payment || payment.billingDomain === 'SAAS')) {
    if (!paymentId) return;

    const finalized = await finalizeOnlinePaymentActivation({
      subscription,
      orderId,
      paymentId,
      paymentMethod: paymentEntity?.method || 'webhook_captured',
    });

    // If a partial-discount voucher reservation was held on this order's checkoutSessionId, commit it idempotently
    const pendingVoucherId = subscription.pendingCheckout?.voucherId;
    if (pendingVoucherId) {
      const heldReservation = await VoucherReservation.findOne({
        organizationId: subscription.organizationId,
        voucherId: pendingVoucherId,
        status: 'HELD',
      }).populate('voucherId planId');

      if (heldReservation) {
        const updatedVoucher = await Voucher.findOneAndUpdate(
          {
            _id: heldReservation.voucherId._id || heldReservation.voucherId,
            currentRedemptionCount: { $lt: heldReservation.voucherId.globalRedemptionLimit || 1000000 },
          },
          { $inc: { currentRedemptionCount: 1 } },
          { new: true }
        );
        heldReservation.status = 'COMMITTED';
        await heldReservation.save();

        if (updatedVoucher && updatedVoucher.currentRedemptionCount >= updatedVoucher.globalRedemptionLimit) {
          await Voucher.findByIdAndUpdate(updatedVoucher._id, { status: 'EXHAUSTED' });
        }

        const existingRedemption = await VoucherRedemption.findOne({
          idempotencyKey: heldReservation.checkoutSessionId,
          status: 'COMPLETED',
        });

        if (!existingRedemption && finalized?.subscription) {
          const redemption = await VoucherRedemption.create({
            voucherId: updatedVoucher?._id || heldReservation.voucherId._id,
            organizationId: subscription.organizationId,
            subscriptionId: finalized.subscription._id,
            paymentId: finalized.payment?._id,
            invoiceId: finalized.invoice?._id,
            planId: heldReservation.planId?._id || finalized.subscription.planId?._id || finalized.subscription.planId,
            billingCycle: heldReservation.billingCycle,
            benefitType: 'DISCOUNT',
            originalAmountRupees: heldReservation.originalAmountRupees,
            discountAmountRupees: heldReservation.discountAmountRupees,
            finalPayableRupees: heldReservation.finalPayableRupees,
            isZeroPayable: false,
            status: 'COMPLETED',
            idempotencyKey: heldReservation.checkoutSessionId,
            redeemedBy: heldReservation.heldBy,
            redeemedAt: new Date(),
          });

          await Subscription.findByIdAndUpdate(finalized.subscription._id, {
            activationMethod: 'VOUCHER',
            lastVoucherId: updatedVoucher?._id || heldReservation.voucherId._id,
            lastVoucherReference: updatedVoucher?.reference || subscription.pendingCheckout?.voucherReference,
          });

          if (finalized.payment) {
            finalized.payment.voucherRedemptionId = redemption._id;
            finalized.payment.discountRupees = heldReservation.discountAmountRupees;
            finalized.payment.paymentMethod = 'subscription_discounted_online';
            await finalized.payment.save();
          }

          if (finalized.invoice) {
            finalized.invoice.voucherRedemptionId = redemption._id;
            finalized.invoice.subtotalRupees = heldReservation.originalAmountRupees;
            finalized.invoice.originalAmountRupees = heldReservation.originalAmountRupees;
            finalized.invoice.discountRupees = heldReservation.discountAmountRupees;
            finalized.invoice.totalRupees = heldReservation.finalPayableRupees;
            await finalized.invoice.save();
          }
        }
      }
    }
    return;
  }

  if (!payment) return;

  const tx = await startSafeTransaction();
  const session = tx.session;
  const sessionOpts = session ? { session } : {};
  const sessionOrderedOpts = session ? { session, ordered: true } : { ordered: true };
  const withSession = (q) => (session ? q.session(session) : q);

  try {
    const txPayment = await withSession(Payment.findOne({ orderId }));
    if (!txPayment || txPayment.status === 'CAPTURED') {
      await tx.commit();
      return;
    }

    txPayment.status = 'CAPTURED';
    txPayment.paymentId = paymentId || txPayment.paymentId;
    txPayment.capturedAt = new Date();
    if (paymentEntity?.method) {
      txPayment.paymentMethod = paymentEntity.method;
    }

    if (txPayment.feeId) {
      const fee = await withSession(Fee.findById(txPayment.feeId));
      if (fee) {
        let invoiceNumber = txPayment.receiptNo;
        if (!txPayment.invoiceId) {
          invoiceNumber = await InvoiceSequence.getNextInvoiceNumber(txPayment.organizationId);
          txPayment.receiptNo = invoiceNumber;

          const createdInvoices = await Invoice.create(
            [
              {
                organizationId: txPayment.organizationId,
                hostelId: txPayment.hostelId || null,
                studentId: txPayment.studentId,
                paymentId: txPayment._id,
                feeId: fee._id,
                invoiceNumber,
                subtotalRupees: txPayment.amountRupees,
                totalRupees: txPayment.amountRupees,
                status: 'PAID',
                issuedAt: new Date(),
                paidAt: new Date(),
                notes: `Razorpay Webhook Captured (${paymentId || orderId})`,
              },
            ],
            sessionOrderedOpts
          );
          txPayment.invoiceId = createdInvoices[0]._id;

          await LedgerEntry.create(
            [
              {
                organizationId: txPayment.organizationId,
                hostelId: txPayment.hostelId || null,
                studentId: txPayment.studentId,
                feeId: fee._id,
                paymentId: txPayment._id,
                invoiceId: createdInvoices[0]._id,
                amountPaise: txPayment.amountPaise,
                amountRupees: txPayment.amountRupees,
                currency: txPayment.currency || 'INR',
                type: 'CREDIT',
                source: 'ONLINE_PAYMENT',
                externalReference: paymentId || txPayment.orderId,
                description: `Razorpay Webhook Online Payment for ${fee.month}`,
                metadata: { orderId, receiptNo: invoiceNumber },
              },
            ],
            sessionOrderedOpts
          );

          await PaymentAttempt.create(
            [
              {
                organizationId: txPayment.organizationId,
                paymentId: txPayment._id,
                providerOrderId: orderId,
                providerPaymentId: paymentId,
                status: 'CAPTURED',
                metadata: { invoiceNumber, source: 'webhook' },
              },
            ],
            sessionOrderedOpts
          );
        } else {
          await Invoice.findByIdAndUpdate(
            txPayment.invoiceId,
            { status: 'PAID', paidAt: new Date() },
            sessionOpts
          );
        }

        fee.paidAmount = (fee.paidAmount || 0) + txPayment.amountRupees;
        const totalDue = (fee.amount || 0) + (fee.lateFee || 0) - (fee.discount || 0);
        if (fee.paidAmount >= totalDue) {
          fee.status = 'paid';
        } else if (fee.paidAmount > 0) {
          fee.status = 'partial';
        }
        fee.paidDate = new Date();
        fee.paymentMode = paymentEntity?.method === 'upi' ? 'upi' : 'online';
        if (invoiceNumber) {
          fee.receiptNo = invoiceNumber;
        }
        await fee.save(sessionOpts);

        if (fee.status === 'paid' && txPayment.studentId) {
          const student = await withSession(Student.findById(txPayment.studentId));
          if (student && student.validDate) {
            const nextValid = new Date(student.validDate);
            nextValid.setMonth(nextValid.getMonth() + 1);
            await Student.findByIdAndUpdate(student._id, { validDate: nextValid }, sessionOpts);
          }
        }
      }
    } else if (txPayment.invoiceId) {
      await Invoice.findByIdAndUpdate(
        txPayment.invoiceId,
        { status: 'ISSUED', paidAt: new Date() },
        sessionOpts
      );
    }

    await txPayment.save(sessionOpts);
    await tx.commit();
  } catch (err) {
    await tx.abort();
    throw err;
  }
}

/**
 * Handles payment failure event without corrupting active subscription state.
 */
async function processPaymentFailedEvent(orderId, paymentEntity) {
  await recordOnlinePaymentFailure({
    orderId,
    code: paymentEntity?.error_code || 'PAYMENT_FAILED',
    reason: paymentEntity?.error_description || 'Payment failed at provider',
  });
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
