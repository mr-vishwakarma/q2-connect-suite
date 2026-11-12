/**
 * Billing Controller
 *
 * Manages Hosteliq SaaS Subscriptions & Billing Lifecycle for Organizations:
 * - Authoritative published SaaS plan catalog from Plan collection
 * - Subscription status retrieval without synthetic Starter overrides
 * - Online Razorpay checkout creation (preserving active/trial state in pendingCheckout until verified)
 * - Cryptographic signature verification & transactional subscription activation
 * - Payment failure recording without corrupting entitlements
 * - Free trial activation gated by plan eligibility
 * - Upgrade quote preview (proration) & next-cycle scheduled downgrade with capacity checks
 * - Strict RBAC & tenant isolation (Students unconditionally denied 403)
 */

const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const OrganizationFeature = require('../models/OrganizationFeature');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const {
  cancelSubscription: rzpCancelSubscription,
  verifySubscriptionSignature,
  createOrder,
  verifyPaymentSignature,
  getPublicKey,
  isConfigured,
} = require('../config/razorpay');
const { planService } = require('../services/plan.service');
const {
  getPublishedPlanOrFail,
  validatePlanAndCycle,
  getPlanPriceForCycle,
  buildPricingSnapshot,
  computeOrganizationUsage,
  getNearExpiryThresholdDays,
  evaluateNearExpiry,
  buildHistoryEntry,
  applyMaturedScheduledDowngrade,
  calculateUpgradeQuote,
  finalizeOnlinePaymentActivation,
  recordOnlinePaymentFailure,
  startTrialForOrganization,
  scheduleDowngradeForOrganization,
  cancelScheduledDowngradeForOrganization,
} = require('../services/subscriptionLifecycle.service');
const { calculateSubscriptionPeriod } = require('../utils/subscriptionPeriod');

// Helper: Resolve tenant ID
function resolveOrgId(req) {
  if (req.tenant?.isSuperAdmin) {
    return (
      req.params?.id ||
      req.body.organizationId ||
      req.query.organizationId ||
      req.tenant.organizationId ||
      null
    );
  }
  return req.tenant?.organizationId || req.user?.activeOrganizationId || null;
}

function sendControllerError(res, req, err, fallbackMessage = 'Operation failed') {
  const status = err.statusCode || 500;
  return res.status(status).json({
    success: false,
    code: err.code || (status === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR'),
    message: err.message || fallbackMessage,
    details: err.details || undefined,
    requestId: req.requestId,
  });
}

function computeAvailableActions(sub, planDoc) {
  if (!sub) return {};
  const st = sub.status;
  const trialEligible = planDoc?.trialEligible !== false;

  return {
    isTrial: st === 'TRIAL',
    isPaidActive: st === 'ACTIVE',
    isPendingPayment: ['PENDING_PAYMENT', 'CREATED', 'PENDING', 'PAYMENT_FAILED'].includes(st),
    isExpired: ['EXPIRED', 'CANCELLED'].includes(st),
    canActivatePlan: [
      'TRIAL',
      'PENDING_PAYMENT',
      'CREATED',
      'PENDING',
      'PAYMENT_FAILED',
      'EXPIRED',
      'CANCELLED',
    ].includes(st),
    canApplyVoucher: [
      'TRIAL',
      'PENDING_PAYMENT',
      'CREATED',
      'PENDING',
      'PAYMENT_FAILED',
      'ACTIVE',
      'EXPIRED',
      'CANCELLED',
    ].includes(st),
    // Trial subscriptions must NEVER present Renew as primary action
    canRenew: st === 'ACTIVE',
    canReactivate: ['EXPIRED', 'CANCELLED'].includes(st),
    canUpgrade: ['ACTIVE', 'TRIAL'].includes(st),
    canDowngrade: st === 'ACTIVE',
    canStartTrial:
      !sub.trialUsed &&
      ['PENDING_PAYMENT', 'CREATED', 'PENDING'].includes(st) &&
      trialEligible,
  };
}

/**
 * @desc    Get all active/published Hosteliq SaaS subscription plans
 * @route   GET /api/billing/plans
 * @access  Public / Authenticated
 */
const getPlans = async (req, res) => {
  try {
    const plans = await planService.getPublishedPlans();
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
 * @desc    Get current organization subscription status, pricing snapshot, usage & plan entitlements
 * @route   GET /api/billing/subscription
 * @access  Private (Organization Admin / Super Admin ONLY — Students strictly blocked)
 */
const getSubscriptionStatus = async (req, res) => {
  try {
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

    if (!subscription) {
      const org = await Organization.findById(organizationId).lean();
      if (org && org.subscriptionId) {
        subscription = await Subscription.findById(org.subscriptionId).populate('planId');
      }
    }

    if (!subscription) {
      return res.status(404).json({
        success: false,
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'No subscription record exists for this organization. Please contact platform administration.',
        requestId: req.requestId,
      });
    }

    const now = new Date();

    // Auto-apply matured scheduled downgrade at billing boundary
    if (
      subscription.scheduledPlanChange?.status === 'SCHEDULED' &&
      subscription.scheduledPlanChange.effectiveDate &&
      new Date(subscription.scheduledPlanChange.effectiveDate) <= now
    ) {
      const matured = await applyMaturedScheduledDowngrade(subscription, now);
      subscription = matured.subscription;
    }

    // Transition expired ACTIVE or TRIAL subscriptions monotonically
    const expiryDate =
      subscription.status === 'TRIAL' && subscription.trialEndsAt
        ? new Date(subscription.trialEndsAt)
        : subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null;

    if (
      (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL') &&
      expiryDate &&
      expiryDate < now
    ) {
      const prevStatus = subscription.status;
      subscription.status = 'EXPIRED';
      subscription.history = subscription.history || [];
      subscription.history.push(
        buildHistoryEntry({
          eventType: 'SUBSCRIPTION_EXPIRED',
          fromStatus: prevStatus,
          toStatus: 'EXPIRED',
          toPlanId: subscription.planId?._id || subscription.planId,
          toPlanName: subscription.pricingSnapshot?.planName || subscription.planId?.name,
          billingCycle: subscription.billingCycle,
          notes: `Subscription reached expiry on ${expiryDate.toISOString()}`,
        })
      );
      await subscription.save();
      await Organization.findByIdAndUpdate(subscription.organizationId, { status: 'EXPIRED' });
    }

    const [usage, thresholdDays, lastPayment, orgFeatures] = await Promise.all([
      computeOrganizationUsage(organizationId),
      getNearExpiryThresholdDays(),
      Payment.findOne({ organizationId, billingDomain: 'SAAS' })
        .sort({ createdAt: -1 })
        .lean(),
      OrganizationFeature.find({ organizationId, enabled: true }).select('featureKey').lean(),
    ]);

    const subData = subscription.toObject ? subscription.toObject() : { ...subscription };
    subData.renewalMode = subData.renewalMode || 'MANUAL';
    subData.autoRenew = Boolean(subData.autoRenew);
    subData.usage = usage;
    subData.nearExpiry = evaluateNearExpiry(subscription, thresholdDays, now);
    subData.lastPayment = lastPayment || null;
    subData.enabledFeatures = orgFeatures.map((f) => f.featureKey);

    // If plan doc was removed externally without leaving a valid reference, surface pricingSnapshot cleanly instead of Starter
    if (!subData.planId && subData.pricingSnapshot) {
      subData.planMissing = true;
      subData.planId = {
        _id: subData.pricingSnapshot.planId,
        name: subData.pricingSnapshot.planName,
        code: subData.pricingSnapshot.planCode,
        description: subData.pricingSnapshot.planDescription,
        priceMonthly: subData.pricingSnapshot.monthlyPriceAtPurchase,
        priceYearly: subData.pricingSnapshot.yearlyPriceAtPurchase,
        limits: subData.pricingSnapshot.limits,
        includedFeatures: subData.pricingSnapshot.includedFeatures,
        trialEligible: subData.pricingSnapshot.trialEligible,
        trialDays: subData.pricingSnapshot.trialDays,
      };
    }

    // Backfill read-only pricingSnapshot in response payload for legacy pre-snapshot subscriptions (without mutating DB)
    if (!subData.pricingSnapshot && subData.planId && typeof subData.planId === 'object') {
      subData.pricingSnapshot = buildPricingSnapshot({
        plan: subData.planId,
        billingCycle: subData.billingCycle || 'MONTHLY',
        agreedPriceRupees: subData.agreedPriceRupees ?? subData.amount,
        finalPayableRupees: subData.amount,
        source: 'DERIVED_LEGACY',
      });
    }

    if (subData.agreedPriceRupees === undefined || subData.agreedPriceRupees === null) {
      subData.agreedPriceRupees = subData.pricingSnapshot?.agreedPriceRupees ?? subData.amount ?? 0;
    }

    subData.availableActions = computeAvailableActions(subData, subData.planId);

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
 * @desc    Create a One-Time Razorpay Order for SaaS Activation, Renewal, Upgrade, or Reactivation
 * @route   POST /api/billing/subscriptions/create
 * @access  Private (Organization Admin / Super Admin ONLY — Students strictly blocked)
 */
const createSubscription = async (req, res) => {
  try {
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

    const { planId, billingCycle = 'MONTHLY', intent: rawIntent } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required' });
    }

    const plan = await getPublishedPlanOrFail({ planId }, { requirePublished: true });
    const normCycle = validatePlanAndCycle({ plan, billingCycle });

    const existingSubscription = await Subscription.findOne({ organizationId }).populate('planId');

    // Determine checkout intent strictly on backend
    let intent = rawIntent ? String(rawIntent).toUpperCase().trim() : null;
    if (!intent) {
      if (!existingSubscription) {
        intent = 'ACTIVATION';
      } else if (existingSubscription.status === 'ACTIVE') {
        const isSamePlanAndCycle =
          String(existingSubscription.planId?._id || existingSubscription.planId) === String(plan._id) &&
          existingSubscription.billingCycle === normCycle;
        intent = isSamePlanAndCycle ? 'RENEWAL' : 'UPGRADE';
      } else if (['EXPIRED', 'CANCELLED'].includes(existingSubscription.status)) {
        intent = 'REACTIVATION';
      } else {
        intent = 'ACTIVATION';
      }
    }

    const catalogPriceRupees = getPlanPriceForCycle(plan, normCycle);
    let prorationCreditRupees = 0;
    let finalPayableRupees = catalogPriceRupees;

    if (intent === 'UPGRADE' && existingSubscription && existingSubscription.status === 'ACTIVE') {
      const quote = await calculateUpgradeQuote({
        subscription: existingSubscription,
        targetPlan: plan,
        billingCycle: normCycle,
      });
      prorationCreditRupees = quote.prorationCreditRupees;
      finalPayableRupees = quote.finalPayableRupees;
    }

    const amountPaise = Math.round(finalPayableRupees * 100);

    // Gateway Configuration Guard
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_PAYMENTS === 'true';
    if (!isConfigured() && !isTestEnv) {
      return res.status(503).json({
        success: false,
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message:
          'Online payment gateway is not configured yet. Please activate using an eligible subscription voucher or contact administrator.',
        data: {
          planId: plan._id,
          planName: plan.name,
          amountRupees: finalPayableRupees,
          catalogPriceRupees,
          prorationCreditRupees,
          billingCycle: normCycle,
        },
        requestId: req.requestId,
      });
    }

    if (amountPaise < 100 && !isTestEnv) {
      return res.status(400).json({
        success: false,
        code: 'ZERO_OR_BELOW_MIN_GATEWAY_AMOUNT',
        message: 'Final payable is below Razorpay minimum threshold.',
        requestId: req.requestId,
      });
    }

    const receipt = `rcpt_saas_${organizationId.toString().slice(-6)}_${Date.now()}`;
    const rzpOrder = await createOrder({
      amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        organizationId: organizationId.toString(),
        q2PlanId: plan._id.toString(),
        planCode: plan.code,
        billingCycle: normCycle,
        intent,
        type: 'SAAS_CHECKOUT',
      },
    });

    const now = new Date();
    const pendingCheckoutObj = {
      orderId: rzpOrder.id,
      intent,
      targetPlanId: plan._id,
      targetPlanCode: plan.code,
      targetPlanName: plan.name,
      targetBillingCycle: normCycle,
      originalAmountRupees: catalogPriceRupees,
      prorationCreditRupees,
      discountAmountRupees: 0,
      finalPayableRupees,
      status: 'CREATED',
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    };

    let subscriptionDoc;
    if (!existingSubscription) {
      // Brand new uninitialized subscription: create in CREATED state (never ACTIVE before verification)
      const period = calculateSubscriptionPeriod({
        activationDate: now,
        billingCycle: normCycle,
        durationCycles: 1,
      });

      subscriptionDoc = await Subscription.create({
        organizationId,
        planId: plan._id,
        orderId: rzpOrder.id,
        status: 'CREATED',
        activationMethod: 'PENDING',
        renewalMode: 'MANUAL',
        autoRenew: false,
        billingCycle: normCycle,
        agreedPriceRupees: catalogPriceRupees,
        amountPaise,
        amount: finalPayableRupees,
        currency: 'INR',
        pricingSnapshot: buildPricingSnapshot({
          plan,
          billingCycle: normCycle,
          agreedPriceRupees: catalogPriceRupees,
          finalPayableRupees,
          source: `CHECKOUT_${intent}`,
        }),
        pendingCheckout: pendingCheckoutObj,
        currentPeriodStart: period.periodStart,
        currentPeriodEnd: period.periodEnd,
      });
    } else {
      // Preserve current plan, dates, and status until gateway payment is verified server-side!
      existingSubscription.orderId = rzpOrder.id;
      existingSubscription.pendingCheckout = pendingCheckoutObj;
      await existingSubscription.save();
      subscriptionDoc = existingSubscription;
    }

    // Track pending order attempt cleanly in Payment history
    await Payment.findOneAndUpdate(
      { orderId: rzpOrder.id },
      {
        $setOnInsert: {
          organizationId,
          billingDomain: 'SAAS',
          subscriptionId: subscriptionDoc._id,
          planId: plan._id,
          orderId: rzpOrder.id,
          amountPaise,
          amountRupees: finalPayableRupees,
          discountRupees: prorationCreditRupees,
          currency: 'INR',
          provider: 'RAZORPAY',
          status: 'CREATED',
          paymentMethod: 'one_time_online',
          intent,
          billingCycle: normCycle,
          planSnapshot: pendingCheckoutObj,
          notes: `Initiated SaaS ${intent.toLowerCase()} checkout for ${plan.name} (${normCycle})`,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      success: true,
      data: {
        orderId: rzpOrder.id,
        subscriptionId: rzpOrder.id,
        localSubscriptionId: subscriptionDoc._id,
        keyId: getPublicKey(),
        amountPaise,
        amountRupees: finalPayableRupees,
        originalAmountRupees: catalogPriceRupees,
        prorationCreditRupees,
        currency: 'INR',
        planId: plan._id,
        planName: plan.name,
        planCode: plan.code,
        billingCycle: normCycle,
        intent,
        renewalMode: 'MANUAL',
        autoRenew: false,
      },
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:createSubscription] Error:', err);
    return sendControllerError(
      res,
      req,
      err,
      err.message || 'Failed to initialize SaaS subscription checkout'
    );
  }
};

/**
 * @desc    Verify Razorpay cryptographic signature & activate/renew/upgrade SaaS subscription
 * @route   POST /api/billing/subscriptions/verify
 * @access  Private (Organization Admin / Super Admin ONLY — Students strictly blocked)
 */
const verifySubscription = async (req, res) => {
  try {
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

    if (
      !razorpay_payment_id ||
      !razorpay_signature ||
      (!razorpay_order_id && !razorpay_subscription_id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required parameters: razorpay_payment_id, razorpay_signature, and either razorpay_order_id or razorpay_subscription_id are required',
      });
    }

    let isValidSignature = false;
    if (razorpay_order_id) {
      isValidSignature = verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
    } else if (razorpay_subscription_id) {
      isValidSignature = verifySubscriptionSignature({
        subscriptionId: razorpay_subscription_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
    }

    if (!isValidSignature) {
      const failureCode =
        !razorpay_order_id && razorpay_subscription_id
          ? 'SUBSCRIPTION_VERIFICATION_FAILED'
          : 'PAYMENT_VERIFICATION_FAILED';
      const failureMsg =
        failureCode === 'SUBSCRIPTION_VERIFICATION_FAILED'
          ? 'Subscription signature verification failed: signature mismatch'
          : 'Payment signature verification failed: signature mismatch';
      return res.status(400).json({
        success: false,
        error: {
          code: failureCode,
          message: failureMsg,
        },
        message: failureMsg,
        requestId: req.requestId,
      });
    }

    const organizationId = resolveOrgId(req);
    let subscription = null;

    if (razorpay_order_id) {
      subscription = await Subscription.findOne({
        $or: [{ 'pendingCheckout.orderId': razorpay_order_id }, { orderId: razorpay_order_id }],
      }).populate('planId');
    }
    if (!subscription && razorpay_subscription_id) {
      subscription = await Subscription.findOne({
        razorpaySubscriptionId: razorpay_subscription_id,
      }).populate('planId');
    }
    if (!subscription && organizationId) {
      subscription = await Subscription.findOne({ organizationId }).populate('planId');
    }

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription record not found in Hosteliq database',
        requestId: req.requestId,
      });
    }

    if (
      !req.tenant?.isSuperAdmin &&
      (!organizationId || subscription.organizationId.toString() !== organizationId.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'Cross-tenant subscription access violation',
        requestId: req.requestId,
      });
    }

    const result = await finalizeOnlinePaymentActivation({
      subscription,
      orderId: razorpay_order_id || subscription.orderId,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      actor: req.user,
      paymentMethod: razorpay_order_id ? 'one_time_online' : 'subscription_online',
    });

    const updatedSub = result.subscription;
    return res.status(200).json({
      success: true,
      idempotent: result.idempotent,
      data: {
        orderId: razorpay_order_id || updatedSub.orderId,
        subscriptionId: updatedSub.razorpaySubscriptionId || updatedSub.orderId,
        paymentId: result.payment?.paymentId || razorpay_payment_id,
        status: updatedSub.status,
        activationMethod: updatedSub.activationMethod,
        planId: updatedSub.planId?._id || updatedSub.planId,
        planName: updatedSub.pricingSnapshot?.planName || updatedSub.planId?.name,
        planCode: updatedSub.pricingSnapshot?.planCode || updatedSub.planId?.code,
        billingCycle: updatedSub.billingCycle,
        agreedPriceRupees: updatedSub.agreedPriceRupees,
        pricingSnapshot: updatedSub.pricingSnapshot,
        invoiceNumber: result.invoice?.invoiceNumber,
        invoiceId: result.invoice?._id,
        currentPeriodEnd: updatedSub.currentPeriodEnd,
        renewalMode: updatedSub.renewalMode || 'MANUAL',
        autoRenew: false,
      },
      message: result.idempotent
        ? 'Payment already verified and subscription is active'
        : 'SaaS subscription successfully activated and verified',
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:verifySubscription] Error:', err);
    return sendControllerError(
      res,
      req,
      err,
      err.message || 'Subscription verification encountered an internal error'
    );
  }
};

/**
 * @desc    Record Razorpay payment failure or dismissal without activating subscription
 * @route   POST /api/billing/subscriptions/payment-failed
 * @access  Private (Organization Admin / Super Admin ONLY)
 */
const recordPaymentFailed = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Students cannot manage SaaS billing',
      });
    }

    const organizationId = resolveOrgId(req);
    const { orderId, code, reason } = req.body;

    if (orderId) {
      const existingOrder = await Payment.findOne({ orderId }).lean();
      if (
        existingOrder &&
        !req.tenant?.isSuperAdmin &&
        organizationId &&
        String(existingOrder.organizationId) !== String(organizationId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Cross-tenant payment record access denied',
        });
      }
    }

    const result = await recordOnlinePaymentFailure({
      organizationId,
      orderId,
      code,
      reason,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment failure recorded; subscription state remains protected',
      data: {
        subscriptionStatus: result.subscription?.status || null,
        pendingCheckoutStatus: result.subscription?.pendingCheckout?.status || 'FAILED',
      },
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:recordPaymentFailed] Error:', err);
    return sendControllerError(res, req, err, 'Failed to record payment failure');
  }
};

/**
 * @desc    Activate free trial on eligible configured plan
 * @route   POST /api/billing/subscription/trial
 * @access  Private (Organization Admin / Super Admin ONLY)
 */
const startTrial = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Students cannot manage SaaS trials',
      });
    }

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context is required' });
    }

    const { planId, planCode, billingCycle, trialDays } = req.body;
    const subscription = await startTrialForOrganization({
      organizationId,
      planId,
      planCode,
      billingCycle,
      trialDaysOverride: trialDays,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: 'Free trial activated successfully',
      data: subscription,
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:startTrial] Error:', err);
    return sendControllerError(res, req, err, 'Failed to start free trial');
  }
};

/**
 * @desc    Preview Upgrade Quote with server-calculated proration & entitlement diff
 * @route   POST /api/billing/subscription/upgrade/preview
 * @access  Private (Organization Admin / Super Admin ONLY)
 */
const previewUpgrade = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Students cannot manage SaaS subscriptions',
      });
    }

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context is required' });
    }

    const { targetPlanId, planId, billingCycle = 'MONTHLY' } = req.body;
    const resolvedTargetId = targetPlanId || planId;
    if (!resolvedTargetId) {
      return res.status(400).json({ success: false, message: 'targetPlanId is required' });
    }

    const [subscription, targetPlan] = await Promise.all([
      Subscription.findOne({ organizationId }).populate('planId'),
      getPublishedPlanOrFail({ planId: resolvedTargetId }, { requirePublished: true }),
    ]);

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const quote = await calculateUpgradeQuote({
      subscription,
      targetPlan,
      billingCycle,
    });

    return res.status(200).json({
      success: true,
      data: quote,
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:previewUpgrade] Error:', err);
    return sendControllerError(res, req, err, 'Failed to calculate upgrade preview');
  }
};

/**
 * @desc    Schedule Plan Downgrade for next billing cycle with capacity validation
 * @route   POST /api/billing/subscription/downgrade
 * @access  Private (Organization Admin / Super Admin ONLY)
 */
const requestDowngrade = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Students cannot manage SaaS subscriptions',
      });
    }

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context is required' });
    }

    const { targetPlanId, planId, billingCycle, confirmOverCapacity = false } = req.body;
    const resolvedTargetId = targetPlanId || planId;
    if (!resolvedTargetId) {
      return res.status(400).json({ success: false, message: 'targetPlanId is required' });
    }

    const result = await scheduleDowngradeForOrganization({
      organizationId,
      targetPlanId: resolvedTargetId,
      billingCycle,
      confirmOverCapacity: Boolean(confirmOverCapacity),
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: result.requiresConfirmation
        ? 'Capacity exceeds target plan limits. Confirm to schedule downgrade for next billing cycle.'
        : 'Plan downgrade scheduled for your next billing cycle. Existing entitlements remain active until then.',
      data: result,
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:requestDowngrade] Error:', err);
    return sendControllerError(res, req, err, 'Failed to process downgrade request');
  }
};

/**
 * @desc    Cancel a previously scheduled next-cycle downgrade
 * @route   DELETE /api/billing/subscription/downgrade
 * @access  Private (Organization Admin / Super Admin ONLY)
 */
const cancelScheduledDowngrade = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Students cannot manage SaaS subscriptions',
      });
    }

    const organizationId = resolveOrgId(req);
    const subscription = await cancelScheduledDowngradeForOrganization({
      organizationId,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: 'Scheduled plan change has been cancelled',
      data: subscription,
      requestId: req.requestId,
    });
  } catch (err) {
    console.error('[Billing:cancelScheduledDowngrade] Error:', err);
    return sendControllerError(res, req, err, 'Failed to cancel scheduled downgrade');
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

    const prevStatus = subscription.status;
    subscription.status = 'CANCELLED';
    subscription.cancelledAt = new Date();
    subscription.history = subscription.history || [];
    subscription.history.push(
      buildHistoryEntry({
        eventType: 'SUBSCRIPTION_CANCELLED',
        fromStatus: prevStatus,
        toStatus: 'CANCELLED',
        toPlanId: subscription.planId,
        actor: req.user,
        notes: 'Subscription cancelled by administrator',
      })
    );
    await subscription.save();

    await Organization.findByIdAndUpdate(organizationId, { status: 'CANCELLED' });

    await AuditLog.create({
      organizationId,
      actorId: req.user?._id,
      actorName: req.user?.name || req.user?.username || 'Admin',
      actorEmail: req.user?.email,
      action: 'SAAS_SUBSCRIPTION_CANCELLED',
      entityType: 'Subscription',
      entityId: subscription._id.toString(),
      oldValue: { status: prevStatus },
      newValue: { status: 'CANCELLED' },
    }).catch(() => {});

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
 * @desc    Get Organization SaaS Billing Invoices, Payments & Lifecycle History
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
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization tenant context is required',
        requestId: req.requestId,
      });
    }

    const [invoices, payments, subscription] = await Promise.all([
      Invoice.find({
        organizationId,
        invoiceType: 'SAAS_INVOICE',
      })
        .sort({ createdAt: -1 })
        .lean(),
      Payment.find({
        organizationId,
        billingDomain: 'SAAS',
      })
        .populate('planId', 'name code')
        .sort({ createdAt: -1 })
        .lean(),
      Subscription.findOne({ organizationId }).select('history').lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        invoices,
        payments,
        subscriptionHistory: [...(subscription?.history || [])].reverse(),
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
  recordPaymentFailed,
  startTrial,
  previewUpgrade,
  requestDowngrade,
  cancelScheduledDowngrade,
  cancelSubscription,
  getBillingHistory,
};
