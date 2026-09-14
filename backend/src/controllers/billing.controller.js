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
  getPublicKey,
} = require('../config/razorpay');

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

    // If no subscription exists, default to active plan on organization or initial trial
    if (!subscription) {
      const org = await Organization.findById(organizationId).populate('currentPlan');
      const defaultPlan = org?.currentPlan || (await Plan.findOne({ code: 'STARTER' })) || (await Plan.findOne());

      subscription = {
        organizationId,
        planId: defaultPlan,
        status: 'TRIAL',
        billingCycle: 'MONTHLY',
        amount: defaultPlan?.priceMonthly || 0,
        currency: 'INR',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 3600 * 1000), // 14-day trial
        usage: { studentCount: 0, roomCount: 0, hostelCount: 0, staffCount: 0 },
      };
    }

    return res.status(200).json({
      success: true,
      data: subscription,
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
 * @desc    Create a Razorpay Subscription for Organization Plan checkout
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

    // 3. Resolve or link Razorpay Plan
    const rzpPlanId = isYearly ? plan.razorpayPlanIdYearly : plan.razorpayPlanIdMonthly;

    // 4. Create Subscription with Razorpay provider
    const rzpSubscription = await rzpCreateSubscription({
      planId: rzpPlanId || `plan_${plan.code.toLowerCase()}_${isYearly ? 'yearly' : 'monthly'}`,
      totalCount: isYearly ? 5 : 12,
      notes: {
        organizationId: organizationId.toString(),
        q2PlanId: plan._id.toString(),
        planCode: plan.code,
        billingCycle,
      },
    });

    // 5. Durably Upsert local Subscription in CREATED state
    const now = new Date();
    const periodEnd = new Date(now.getTime() + (isYearly ? 365 : 30) * 24 * 3600 * 1000);

    const subscriptionDoc = await Subscription.findOneAndUpdate(
      { organizationId },
      {
        planId: plan._id,
        razorpayPlanId: rzpPlanId || `plan_${plan.code.toLowerCase()}`,
        razorpaySubscriptionId: rzpSubscription.id,
        status: 'CREATED',
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        amountPaise,
        amount: amountRupees,
        currency: 'INR',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        totalCount: isYearly ? 5 : 12,
        paidCount: 0,
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      success: true,
      data: {
        subscriptionId: rzpSubscription.id,
        localSubscriptionId: subscriptionDoc._id,
        keyId: getPublicKey(),
        amountPaise,
        amountRupees,
        currency: 'INR',
        planName: plan.name,
        planCode: plan.code,
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
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

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: razorpay_payment_id, razorpay_subscription_id, and razorpay_signature are required',
      });
    }

    // 2. Cryptographic signature verification per Razorpay Subscriptions formula:
    // HMAC-SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret) === razorpay_signature
    const isValidSignature = verifySubscriptionSignature({
      subscriptionId: razorpay_subscription_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_VERIFICATION_FAILED',
          message: 'Subscription signature verification failed: signature mismatch',
        },
        message: 'Subscription signature verification failed: signature mismatch',
        requestId: req.requestId,
      });
    }

    const organizationId = resolveOrgId(req);
    const subscription = await Subscription.findOne({
      razorpaySubscriptionId: razorpay_subscription_id,
    }).populate('planId');

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

    // 4. Idempotency guard: If already active and payment already processed
    const existingPayment = await Payment.findOne({
      paymentId: razorpay_payment_id,
      status: 'CAPTURED',
    });

    if (subscription.status === 'ACTIVE' && existingPayment) {
      const existingInvoice = await Invoice.findOne({ paymentId: existingPayment._id });
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: {
          subscriptionId: subscription.razorpaySubscriptionId,
          paymentId: existingPayment.paymentId,
          status: subscription.status,
          invoiceNumber: existingInvoice?.invoiceNumber,
          invoiceId: existingInvoice?._id,
        },
        message: 'Subscription is already active and verified',
        requestId: req.requestId,
      });
    }

    // 5. Monotonic state transition to ACTIVE
    subscription.status = 'ACTIVE';
    subscription.startedAt = subscription.startedAt || new Date();
    subscription.paidCount = (subscription.paidCount || 0) + 1;
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
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      orderId: `order_sub_${razorpay_payment_id || Date.now()}`,
      amountPaise: subscription.amountPaise || Math.round((subscription.amount || 0) * 100),
      amountRupees: subscription.amount || 0,
      currency: subscription.currency || 'INR',
      provider: 'RAZORPAY',
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      status: 'CAPTURED',
      paymentMethod: 'subscription_online',
      capturedAt: new Date(),
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
      status: 'ISSUED',
      issuedAt: new Date(),
      paidAt: new Date(),
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
      description: `Q2 SaaS Plan Subscription - ${subscription.planId.name} (${subscription.billingCycle})`,
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
          subscriptionId: subscription.razorpaySubscriptionId,
          planId: subscription.planId._id,
          invoiceNumber,
          amountRupees: subscription.amount,
        },
      });
    } catch (auditErr) {
      console.error('[Billing:verifySubscription] Audit notice:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription.razorpaySubscriptionId,
        paymentId: payment.paymentId,
        status: subscription.status,
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice._id,
      },
      message: 'SaaS subscription successfully activated and verified',
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
