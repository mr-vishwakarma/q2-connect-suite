/**
 * Billing Controller (Phase F/G Architectural Reconciliation)
 * 
 * Manages Q2 SaaS Subscriptions & Recurring Billing for Organizations:
 * - Public & authenticated SaaS plan catalog
 * - Organization subscription creation via Razorpay Subscriptions API
 * - Server-side cryptographic signature verification (payment_id + "|" + subscription_id)
 * - Monotonic subscription lifecycle updates (CREATED -> AUTHENTICATED -> ACTIVE)
 * - Sequential invoice generation & immutable double-entry ledger integration
 * - Strict RBAC barrier: Students are unconditionally denied (403 Forbidden)
 */

const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const InvoiceSequence = require('../models/InvoiceSequence');
const LedgerEntry = require('../models/LedgerEntry');
const AuditLog = require('../models/AuditLog');
const {
  createSubscription: rzpCreateSubscription,
  fetchSubscription: rzpFetchSubscription,
  cancelSubscription: rzpCancelSubscription,
  verifySubscriptionSignature,
  createOrder,
  verifyPaymentSignature,
  getPublicKey,
  isConfigured,
} = require('../config/razorpay');
const { calculateSubscriptionPeriod } = require('../utils/subscriptionPeriod');

// Helper: Resolve tenant ID
function resolveOrgId(req) {
  if (req.tenant?.isSuperAdmin) {
    return req.body.organizationId || req.query.organizationId || req.tenant.organizationId || null;
  }
  return req.tenant?.organizationId || req.user?.activeOrganizationId || null;
}

/**
 * @desc    Get all active Q2 SaaS subscription plans
 * @route   GET /api/billing/plans
 * @access  Public / Authenticated
 */
const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ priceMonthly: 1 }).lean();
    return res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    console.error('[Billing:getPlans] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription plans',
      requestId: req.requestId,
    });
  }
};

/**
 * @desc    Get current organization subscription status & plan entitlements
 * @route   GET /api/billing/subscription
 * @access  Private (Organization Admin / Super Admin ONLY — Students strictly blocked)
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    // 1. Strict RBAC barrier: Students must NOT access SaaS billing
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied: Students are not authorized to view or manage SaaS billing',
        },
        message: 'Access denied: Students are not authorized to view or manage SaaS billing',
        requestId: req.requestId,
      });
    }

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization tenant context is required',
        requestId: req.requestId,
      });
    }

    let subscription = await Subscription.findOne({ organizationId }).populate('planId');

    // If subscription exists, check if active plan has reached period end without renewal -> transition to EXPIRED
    if (subscription && subscription.status === 'ACTIVE' && subscription.currentPeriodEnd) {
      if (new Date(subscription.currentPeriodEnd) < new Date()) {
        subscription.status = 'EXPIRED';
        await subscription.save();
      }
    }

    // If no subscription exists, safely find or create default subscription
    if (!subscription) {
      const org = await Organization.findById(organizationId).lean();
      let defaultPlan = null;
      if (org && org.subscriptionId) {
        const existingSub = await Subscription.findById(org.subscriptionId).populate('planId');
        if (existingSub && existingSub.planId) {
          subscription = existingSub;
        }
      }

      if (!subscription) {
        defaultPlan = (await Plan.findOne({ code: 'STARTER' }).lean()) ||
          (await Plan.findOne({ code: 'GROWTH' }).lean()) ||
          (await Plan.findOne({ code: 'PROFESSIONAL' }).lean()) ||
          (await Plan.findOne().lean());

        const now = new Date();
        const period = calculateSubscriptionPeriod({
          activationDate: now,
          billingCycle: 'MONTHLY',
          durationCycles: 1,
        });

        subscription = {
          organizationId,
          planId: defaultPlan,
          status: 'ACTIVE',
          renewalMode: 'MANUAL',
          autoRenew: false,
          billingCycle: 'MONTHLY',
          amount: defaultPlan?.priceMonthly || 1999,
          currency: 'INR',
          currentPeriodStart: period.periodStart,
          currentPeriodEnd: period.periodEnd,
          usage: { studentCount: 0, roomCount: 0, hostelCount: 0, staffCount: 0 },
        };
      }
    } else if (!subscription.planId) {
      // Guard against stale plan reference
      const fallbackPlan = (await Plan.findOne({ code: 'STARTER' })) || (await Plan.findOne());
      subscription.planId = fallbackPlan;
    }

    const subData = subscription.toObject ? subscription.toObject() : { ...subscription };
    subData.renewalMode = subData.renewalMode || 'MANUAL';
    subData.autoRenew = Boolean(subData.autoRenew);

    return res.status(200).json({
      success: true,
      data: subData,
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:getSubscriptionStatus] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription status',
      requestId: req.requestId,
    });
  }
};

/**
 * @desc    Create a One-Time Razorpay Order for Manual SaaS Subscription Renewal / Activation
 * @route   POST /api/billing/subscriptions/create
 * @access  Private (Organization Admin / Super Admin ONLY — Students strictly blocked)
 */
const createSubscription = async (req, res) => {
  try {
    // 1. Strict RBAC barrier
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied: Students cannot purchase SaaS subscriptions',
        },
        message: 'Access denied: Students cannot purchase SaaS subscriptions',
        requestId: req.requestId,
      });
    }

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context is required',
        requestId: req.requestId,
      });
    }

    const { planId, billingCycle = 'MONTHLY' } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: 'Selected plan is inactive or not found' });
    }

    // 2. Authoritative pricing calculation (client cannot manufacture amount)
    const isYearly = billingCycle.toUpperCase() === 'YEARLY';
    const amountRupees = isYearly ? plan.priceYearly : plan.priceMonthly;
    const amountPaise = Math.round(amountRupees * 100);

    // 3. Gateway Configuration Guard:
    // If Razorpay credentials are missing and not running in test mode, return 503
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_PAYMENTS === 'true';
    if (!isConfigured() && !isTestEnv) {
      return res.status(503).json({
        success: false,
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message: 'Online payment gateway is not configured yet. Please activate using an eligible subscription voucher or contact administrator.',
        data: {
          planId: plan._id,
          planName: plan.name,
          amountRupees,
          billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        },
        requestId: req.requestId,
      });
    }

    // 4. Create One-Time Razorpay Order (No automated recurring deduction)
    const receipt = `rcpt_saas_${organizationId.toString().slice(-6)}_${Date.now()}`;
    const rzpOrder = await createOrder({
      amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        organizationId: organizationId.toString(),
        q2PlanId: plan._id.toString(),
        planCode: plan.code,
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        type: 'SAAS_MANUAL_RENEWAL',
      },
    });

    // 5. Durably Upsert local Subscription in PENDING state for this order
    const existingSubscription = await Subscription.findOne({ organizationId });
    const period = calculateSubscriptionPeriod({
      activationDate: new Date(),
      billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
      existingSubscription,
      durationCycles: 1,
    });

    const subscriptionDoc = await Subscription.findOneAndUpdate(
      { organizationId },
      {
        planId: plan._id,
        orderId: rzpOrder.id,
        status: existingSubscription?.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
        renewalMode: 'MANUAL',
        autoRenew: false,
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        amountPaise,
        amount: amountRupees,
        currency: 'INR',
        currentPeriodStart: period.periodStart,
        currentPeriodEnd: period.periodEnd,
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      success: true,
      data: {
        orderId: rzpOrder.id,
        subscriptionId: rzpOrder.id, // Provided for client compatibility
        localSubscriptionId: subscriptionDoc._id,
        keyId: getPublicKey(),
        amountPaise,
        amountRupees,
        currency: 'INR',
        planName: plan.name,
        planCode: plan.code,
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        renewalMode: 'MANUAL',
        autoRenew: false,
      },
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:createSubscription] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to initialize SaaS subscription checkout',
      requestId: req.requestId,
    });
  }
};

/**
 * @desc    Verify Razorpay Subscription cryptographic signature & activate SaaS subscription
 * @route   POST /api/billing/subscriptions/verify
 * @access  Private (Organization Admin / Super Admin ONLY — Students strictly blocked)
 */
const verifySubscription = async (req, res) => {
  try {
    // 1. Strict RBAC barrier
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied: Students cannot verify SaaS subscriptions',
        },
        message: 'Access denied: Students cannot verify SaaS subscriptions',
        requestId: req.requestId,
      });
    }

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_subscription_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_payment_id || !razorpay_signature || (!razorpay_order_id && !razorpay_subscription_id)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: razorpay_payment_id, razorpay_signature, and either razorpay_order_id or razorpay_subscription_id are required',
      });
    }

    // 2. Cryptographic signature verification
    let isValidSignature = false;
    if (razorpay_order_id) {
      // One-time payment formula: HMAC-SHA256(order_id + "|" + payment_id, secret)
      isValidSignature = verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
    } else if (razorpay_subscription_id) {
      // Legacy recurring subscription formula: HMAC-SHA256(payment_id + "|" + subscription_id, secret)
      isValidSignature = verifySubscriptionSignature({
        subscriptionId: razorpay_subscription_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
    }

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_VERIFICATION_FAILED',
          message: 'Payment signature verification failed: signature mismatch',
        },
        message: 'Payment signature verification failed: signature mismatch',
        requestId: req.requestId,
      });
    }

    const organizationId = resolveOrgId(req);
    let subscription = null;

    if (razorpay_order_id) {
      subscription = await Subscription.findOne({ orderId: razorpay_order_id }).populate('planId');
    }
    if (!subscription && razorpay_subscription_id) {
      subscription = await Subscription.findOne({ razorpaySubscriptionId: razorpay_subscription_id }).populate('planId');
    }
    if (!subscription && organizationId) {
      subscription = await Subscription.findOne({ organizationId }).populate('planId');
    }

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription record not found in Q2 database',
        requestId: req.requestId,
      });
    }

    // 3. Tenant authorization check
    if (
      !req.tenant?.isSuperAdmin &&
      subscription.organizationId.toString() !== organizationId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Cross-tenant subscription access violation',
        requestId: req.requestId,
      });
    }

    // 4. Idempotency guard: If already captured, prevent duplicate period extension
    const existingPayment = await Payment.findOne({
      paymentId: razorpay_payment_id,
      status: 'CAPTURED',
    });

    if (existingPayment) {
      const existingInvoice = await Invoice.findOne({ paymentId: existingPayment._id });
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: {
          orderId: razorpay_order_id || subscription.orderId,
          subscriptionId: subscription.razorpaySubscriptionId || subscription.orderId,
          paymentId: existingPayment.paymentId,
          status: subscription.status,
          invoiceNumber: existingInvoice?.invoiceNumber,
          invoiceId: existingInvoice?._id,
          currentPeriodEnd: subscription.currentPeriodEnd,
          renewalMode: subscription.renewalMode || 'MANUAL',
          autoRenew: false,
        },
        message: 'Payment already verified and subscription is active',
        requestId: req.requestId,
      });
    }

    // 5. Authoritative Period Calculation (supports calendar month-end and early extension)
    const now = new Date();
    const period = calculateSubscriptionPeriod({
      activationDate: now,
      billingCycle: subscription.billingCycle,
      existingSubscription: subscription,
      durationCycles: 1,
    });

    subscription.status = 'ACTIVE';
    subscription.renewalMode = 'MANUAL';
    subscription.autoRenew = false;
    subscription.startedAt = subscription.startedAt || now;
    subscription.currentPeriodStart = period.periodStart;
    subscription.currentPeriodEnd = period.periodEnd;
    subscription.paidCount = (subscription.paidCount || 0) + 1;
    if (razorpay_order_id) subscription.orderId = razorpay_order_id;
    await subscription.save();

    // 6. Update Organization's active subscription reference
    await Organization.findByIdAndUpdate(subscription.organizationId, {
      subscriptionId: subscription._id,
      status: 'ACTIVE',
    });

    // 7. Create Payment record for SaaS transaction
    const payment = await Payment.create({
      organizationId: subscription.organizationId,
      billingDomain: 'SAAS',
      subscriptionId: subscription._id,
      planId: subscription.planId._id,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId || undefined,
      orderId: razorpay_order_id || subscription.orderId || `order_${Date.now()}`,
      amountPaise: subscription.amountPaise || Math.round((subscription.amount || 0) * 100),
      amountRupees: subscription.amount || 0,
      currency: subscription.currency || 'INR',
      provider: 'RAZORPAY',
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      status: 'CAPTURED',
      paymentMethod: razorpay_order_id ? 'one_time_online' : 'subscription_online',
      capturedAt: now,
    });

    // 8. Generate sequential invoice number Q2-INV-YYYY-NNNNNN
    const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber(subscription.organizationId);

    const invoice = await Invoice.create({
      organizationId: subscription.organizationId,
      paymentId: payment._id,
      subscriptionId: subscription._id,
      invoiceNumber,
      invoiceType: 'SAAS_INVOICE',
      subtotalRupees: subscription.amount || 0,
      taxRupees: 0,
      totalRupees: subscription.amount || 0,
      currency: subscription.currency || 'INR',
      status: 'PAID',
      issuedAt: now,
      paidAt: now,
    });

    // Link invoiceId back to payment
    payment.invoiceId = invoice._id;
    await payment.save();

    // 9. Append immutable LedgerEntry (CREDIT / SAAS_SUBSCRIPTION)
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
      externalReference: razorpay_payment_id,
      description: `Q2 SaaS Manual Plan Renewal - ${subscription.planId.name} (${subscription.billingCycle})`,
    });

    // 10. Audit Log
    try {
      await AuditLog.create({
        organizationId: subscription.organizationId,
        actorId: req.user._id,
        actorName: req.user.name || req.user.username || 'Admin',
        actorEmail: req.user.email,
        action: 'SAAS_SUBSCRIPTION_ACTIVATED',
        entityType: 'Subscription',
        entityId: subscription._id.toString(),
        newValue: {
          orderId: razorpay_order_id || subscription.orderId,
          planId: subscription.planId._id,
          invoiceNumber,
          amountRupees: subscription.amount,
          currentPeriodEnd: period.periodEnd,
          renewalMode: 'MANUAL',
        },
      });
    } catch (auditErr) {
      console.error('[Billing:verifySubscription] Audit notice:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: razorpay_order_id || subscription.orderId,
        subscriptionId: subscription.razorpaySubscriptionId || subscription.orderId,
        paymentId: payment.paymentId,
        status: subscription.status,
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice._id,
        currentPeriodEnd: period.periodEnd,
        renewalMode: 'MANUAL',
        autoRenew: false,
      },
      message: 'SaaS subscription successfully renewed and verified',
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:verifySubscription] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Subscription verification encountered an internal error',
      requestId: req.requestId,
    });
  }
};

/**
 * @desc    Cancel an Organization's SaaS Subscription
 * @route   POST /api/billing/subscriptions/cancel
 * @access  Private (Organization Admin / Super Admin ONLY — Students strictly blocked)
 */
const cancelSubscription = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied: Students cannot cancel SaaS subscriptions',
        },
        message: 'Access denied: Students cannot cancel SaaS subscriptions',
        requestId: req.requestId,
      });
    }

    const organizationId = resolveOrgId(req);
    const subscription = await Subscription.findOne({ organizationId });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No active subscription found to cancel' });
    }

    if (subscription.razorpaySubscriptionId) {
      await rzpCancelSubscription({ subscriptionId: subscription.razorpaySubscriptionId });
    }

    subscription.status = 'CANCELLED';
    subscription.cancelledAt = new Date();
    await subscription.save();

    return res.status(200).json({
      success: true,
      data: subscription,
      message: 'Subscription has been successfully cancelled',
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:cancelSubscription] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to cancel subscription',
      requestId: req.requestId,
    });
  }
};

/**
 * @desc    Get Organization SaaS Billing Invoices & Payments History
 * @route   GET /api/billing/history
 * @access  Private (Organization Admin / Super Admin ONLY — Students strictly blocked)
 */
const getBillingHistory = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied: Students cannot view SaaS billing history',
        },
        message: 'Access denied: Students cannot view SaaS billing history',
        requestId: req.requestId,
      });
    }

    const organizationId = resolveOrgId(req);
    const invoices = await Invoice.find({
      organizationId,
      invoiceType: 'SAAS_INVOICE',
    })
      .sort({ createdAt: -1 })
      .lean();

    const payments = await Payment.find({
      organizationId,
      billingDomain: 'SAAS',
    })
      .populate('planId', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        invoices,
        payments,
      },
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:getBillingHistory] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve billing history',
      requestId: req.requestId,
    });
  }
};

module.exports = {
  getPlans,
  getSubscriptionStatus,
  createSubscription,
  verifySubscription,
  cancelSubscription,
  getBillingHistory,
};
