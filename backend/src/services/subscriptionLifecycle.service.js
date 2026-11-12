const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const OrganizationFeature = require('../models/OrganizationFeature');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const InvoiceSequence = require('../models/InvoiceSequence');
const LedgerEntry = require('../models/LedgerEntry');
const AuditLog = require('../models/AuditLog');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const Membership = require('../models/Membership');
const { DEFAULT_FEATURES } = require('./feature.service');
const { platformSettingsService } = require('./platformSettings.service');
const { calculateSubscriptionPeriod } = require('../utils/subscriptionPeriod');

const CORE_FEATURE_KEYS = ['student_management', 'room_management', 'fee_management', 'reports'];
const txSupportCache = new Map();

function createHttpError(message, statusCode = 400, code = 'BAD_REQUEST', details = null) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  if (details) err.details = details;
  return err;
}

function normalizeBillingCycle(cycle, { strict = true, defaultCycle = 'MONTHLY' } = {}) {
  if (cycle === undefined || cycle === null || String(cycle).trim() === '') {
    return defaultCycle;
  }
  const upper = String(cycle).toUpperCase().trim();
  if (upper === 'MONTHLY') return 'MONTHLY';
  if (upper === 'YEARLY' || upper === 'ANNUAL') return 'YEARLY';

  if (strict) {
    throw createHttpError(
      `Unsupported billing frequency '${cycle}'. Allowed billing frequencies are MONTHLY and YEARLY.`,
      400,
      'INVALID_BILLING_CYCLE'
    );
  }
  return defaultCycle;
}

async function getPublishedPlanOrFail({ planId, planCode }, { requirePublished = true, session = null } = {}) {
  if (!planId && !planCode) {
    throw createHttpError(
      'An explicit planId or planCode from the active plan catalog is required.',
      400,
      'PLAN_SELECTION_REQUIRED'
    );
  }

  let plan = null;
  if (planId) {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      throw createHttpError('Invalid planId provided.', 400, 'INVALID_PLAN_ID');
    }
    const q = Plan.findById(planId);
    if (session) q.session(session);
    plan = await q;
  } else if (planCode) {
    const q = Plan.findOne({ code: String(planCode).toUpperCase().trim() });
    if (session) q.session(session);
    plan = await q;
  }

  if (!plan) {
    throw createHttpError('Selected subscription plan was not found.', 404, 'PLAN_NOT_FOUND');
  }

  if (requirePublished && (!plan.isActive || plan.status !== 'ACTIVE')) {
    throw createHttpError(
      `Selected plan '${plan.name}' is currently inactive or archived and cannot be assigned to new subscriptions.`,
      400,
      'PLAN_NOT_ACTIVE'
    );
  }

  return plan;
}

function validatePlanAndCycle({ plan, billingCycle }) {
  const normalizedCycle = normalizeBillingCycle(billingCycle, { strict: true });
  const allowed =
    Array.isArray(plan.allowedBillingCycles) && plan.allowedBillingCycles.length > 0
      ? plan.allowedBillingCycles
      : ['MONTHLY', 'YEARLY'];

  if (!allowed.includes(normalizedCycle)) {
    throw createHttpError(
      `Billing frequency '${normalizedCycle}' is not enabled for plan '${plan.name}'. Allowed frequencies: ${allowed.join(', ')}.`,
      400,
      'BILLING_CYCLE_NOT_SUPPORTED'
    );
  }

  return normalizedCycle;
}

function getPlanPriceForCycle(plan, billingCycle) {
  const norm = normalizeBillingCycle(billingCycle, { strict: false });
  return norm === 'YEARLY' ? Number(plan.priceYearly || 0) : Number(plan.priceMonthly || 0);
}

function buildPricingSnapshot({
  plan,
  billingCycle,
  agreedPriceRupees = null,
  finalPayableRupees = null,
  source = 'CATALOG',
}) {
  const normCycle = normalizeBillingCycle(billingCycle, { strict: false });
  const catalogPrice = getPlanPriceForCycle(plan, normCycle);
  const resolvedAgreed =
    agreedPriceRupees !== null && agreedPriceRupees !== undefined
      ? Number(agreedPriceRupees)
      : catalogPrice;
  const resolvedPayable =
    finalPayableRupees !== null && finalPayableRupees !== undefined
      ? Number(finalPayableRupees)
      : resolvedAgreed;

  const rawLimits = plan.limits?.toObject ? plan.limits.toObject() : plan.limits || {};

  return {
    planId: plan._id,
    planCode: plan.code,
    planName: plan.name,
    planDescription: plan.description || '',
    planVersion: Number(plan.version) || 1,
    billingCycle: normCycle,
    agreedPriceRupees: resolvedAgreed,
    agreedPricePaise: Math.round(resolvedAgreed * 100),
    finalPayableRupees: resolvedPayable,
    monthlyPriceAtPurchase: Number(plan.priceMonthly || 0),
    yearlyPriceAtPurchase: Number(plan.priceYearly || 0),
    currency: (plan.currency || 'INR').toUpperCase(),
    taxRatePercent: 0,
    taxAmountRupees: 0,
    trialEligible: plan.trialEligible !== false,
    trialDays: plan.trialEligible !== false ? Number(plan.trialDays ?? 14) : 0,
    limits: {
      maxStudents: Number(rawLimits.maxStudents ?? 0),
      maxRooms: Number(rawLimits.maxRooms ?? 50),
      maxHostels: Number(rawLimits.maxHostels ?? 1),
      maxStaff: Number(rawLimits.maxStaff ?? 5),
      storageGb: Number(rawLimits.storageGb ?? 5),
    },
    includedFeatures: Array.isArray(plan.includedFeatures) ? [...plan.includedFeatures] : [],
    capturedAt: new Date(),
    source,
  };
}

async function supportsTransactions() {
  const conn = mongoose.connection;
  if (!conn || conn.readyState !== 1 || !conn.db) return false;

  const cacheKey = `${conn.host || 'local'}:${conn.port || ''}:${conn.name || ''}`;
  if (txSupportCache.has(cacheKey)) {
    return txSupportCache.get(cacheKey);
  }

  let supported = false;
  try {
    const info = await conn.db.admin().command({ hello: 1 });
    supported = Boolean(info.setName || info.msg === 'isdbgrid');
  } catch {
    supported = false;
  }
  txSupportCache.set(cacheKey, supported);
  return supported;
}

async function runInTransaction(fn) {
  const canUseTx = await supportsTransactions();
  if (!canUseTx) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    // Graceful fallback if MongoDB refuses transaction numbers on single-node server
    if (
      err &&
      (err.code === 20 ||
        String(err.message || '').includes('Transaction numbers are only allowed'))
    ) {
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

async function syncOrganizationFeatures(
  organizationId,
  includedFeatures = [],
  { enabled = true, session = null } = {}
) {
  const includedSet = new Set(Array.isArray(includedFeatures) ? includedFeatures : []);
  const canonicalKeys = new Set(DEFAULT_FEATURES.map((f) => f.key));
  includedSet.forEach((k) => canonicalKeys.add(k));

  const existingQuery = OrganizationFeature.find({ organizationId });
  if (session) existingQuery.session(session);
  const existingDocs = await existingQuery.lean();
  existingDocs.forEach((d) => canonicalKeys.add(d.featureKey));

  const operations = [];
  for (const key of canonicalKeys) {
    // Core features remain accessible when account is pending activation; premium features require enabled && included
    const shouldEnable = enabled
      ? includedSet.has(key) || CORE_FEATURE_KEYS.includes(key)
      : CORE_FEATURE_KEYS.includes(key);

    operations.push({
      updateOne: {
        filter: { organizationId, featureKey: key },
        update: { $set: { enabled: shouldEnable } },
        upsert: true,
      },
    });
  }

  if (operations.length > 0) {
    await OrganizationFeature.bulkWrite(operations, session ? { session } : undefined);
  }
}

async function computeOrganizationUsage(organizationId) {
  const [studentCount, roomCount, hostelCount, staffCount] = await Promise.all([
    Student.countDocuments({ organizationId, isActive: true }),
    Room.countDocuments({ organizationId }),
    Hostel.countDocuments({ organizationId, isDeleted: false }),
    Membership.countDocuments({
      organizationId,
      status: 'ACTIVE',
      role: { $nin: ['STUDENT', 'SUPER_ADMIN'] },
    }),
  ]);

  return {
    studentCount,
    roomCount,
    hostelCount,
    staffCount,
  };
}

async function getNearExpiryThresholdDays() {
  try {
    const settings = await platformSettingsService.getSettings();
    const configured = Number(settings?.trial?.notifyExpiringDaysBefore);
    if (!Number.isNaN(configured) && configured > 0) {
      return configured;
    }
  } catch {
    // Ignore settings lookup errors cleanly
  }
  return 7;
}

function evaluateNearExpiry(subscription, thresholdDays = 7, now = new Date()) {
  if (!subscription) {
    return { isNearExpiry: false, daysRemaining: null, thresholdDays };
  }

  const endRef =
    subscription.status === 'TRIAL' && subscription.trialEndsAt
      ? new Date(subscription.trialEndsAt)
      : subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;

  if (!endRef || Number.isNaN(endRef.getTime())) {
    return { isNearExpiry: false, daysRemaining: null, thresholdDays };
  }

  const diffMs = endRef.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  const eligibleStatus = ['ACTIVE', 'TRIAL'].includes(subscription.status);
  const isNearExpiry = eligibleStatus && diffMs > 0 && daysRemaining <= thresholdDays;

  return {
    isNearExpiry,
    daysRemaining,
    thresholdDays,
    expiresAt: endRef,
  };
}

function buildHistoryEntry({
  eventType,
  fromStatus = null,
  toStatus = null,
  fromPlanId = null,
  fromPlanName = null,
  toPlanId = null,
  toPlanName = null,
  billingCycle = null,
  amountRupees = null,
  activationMethod = null,
  paymentId = null,
  invoiceNumber = null,
  voucherReference = null,
  actor = null,
  notes = '',
}) {
  return {
    eventType,
    fromStatus: fromStatus || undefined,
    toStatus: toStatus || undefined,
    fromPlanId: fromPlanId || undefined,
    fromPlanName: fromPlanName || undefined,
    toPlanId: toPlanId || undefined,
    toPlanName: toPlanName || undefined,
    billingCycle: billingCycle || undefined,
    amountRupees: amountRupees !== null && amountRupees !== undefined ? Number(amountRupees) : undefined,
    activationMethod: activationMethod || undefined,
    paymentId: paymentId || undefined,
    invoiceNumber: invoiceNumber || undefined,
    voucherReference: voucherReference || undefined,
    actorId: actor?._id || actor?.id || undefined,
    actorEmail: actor?.email || undefined,
    notes: notes || undefined,
    occurredAt: new Date(),
  };
}

async function applyMaturedScheduledDowngrade(subscription, now = new Date()) {
  if (
    !subscription ||
    !subscription.scheduledPlanChange ||
    subscription.scheduledPlanChange.status !== 'SCHEDULED' ||
    !subscription.scheduledPlanChange.effectiveDate
  ) {
    return { applied: false, subscription };
  }

  const effectiveDate = new Date(subscription.scheduledPlanChange.effectiveDate);
  if (effectiveDate > now) {
    return { applied: false, subscription };
  }

  // Only auto-apply if subscription hasn't been cancelled
  if (subscription.status === 'CANCELLED') {
    return { applied: false, subscription };
  }

  const targetPlan = await Plan.findById(subscription.scheduledPlanChange.targetPlanId);
  if (!targetPlan) {
    return { applied: false, subscription };
  }

  const prevPlanId = subscription.planId?._id || subscription.planId;
  const prevPlanName = subscription.pricingSnapshot?.planName || subscription.planId?.name;
  const prevStatus = subscription.status;
  const targetCycle = subscription.scheduledPlanChange.targetBillingCycle || subscription.billingCycle || 'MONTHLY';
  const targetPrice = getPlanPriceForCycle(targetPlan, targetCycle);

  const period = calculateSubscriptionPeriod({
    activationDate: effectiveDate,
    billingCycle: targetCycle,
    existingSubscription: { status: 'EXPIRED' },
    durationCycles: 1,
  });

  const snapshot = buildPricingSnapshot({
    plan: targetPlan,
    billingCycle: targetCycle,
    agreedPriceRupees: targetPrice,
    finalPayableRupees: targetPrice,
    source: 'SCHEDULED_DOWNGRADE',
  });

  subscription.planId = targetPlan._id;
  subscription.billingCycle = targetCycle;
  subscription.agreedPriceRupees = targetPrice;
  subscription.amount = targetPrice;
  subscription.amountPaise = Math.round(targetPrice * 100);
  subscription.pricingSnapshot = snapshot;
  subscription.currentPeriodStart = period.periodStart;
  subscription.currentPeriodEnd = period.periodEnd;
  subscription.scheduledPlanChange.status = 'APPLIED';
  subscription.history = subscription.history || [];
  subscription.history.push(
    buildHistoryEntry({
      eventType: 'SCHEDULED_DOWNGRADE_APPLIED',
      fromStatus: prevStatus,
      toStatus: subscription.status,
      fromPlanId: prevPlanId,
      fromPlanName: prevPlanName,
      toPlanId: targetPlan._id,
      toPlanName: targetPlan.name,
      billingCycle: targetCycle,
      amountRupees: targetPrice,
      activationMethod: subscription.activationMethod,
      notes: `Scheduled downgrade applied on effective date ${effectiveDate.toISOString()}`,
    })
  );

  await subscription.save();
  await syncOrganizationFeatures(subscription.organizationId, targetPlan.includedFeatures || [], {
    enabled: true,
  });

  await AuditLog.create({
    organizationId: subscription.organizationId,
    action: 'SUBSCRIPTION_DOWNGRADE_APPLIED',
    entityType: 'Subscription',
    entityId: subscription._id.toString(),
    oldValue: { planId: prevPlanId, planName: prevPlanName },
    newValue: { planId: targetPlan._id, planName: targetPlan.name, billingCycle: targetCycle, price: targetPrice },
  }).catch(() => {});

  await subscription.populate('planId');
  return { applied: true, subscription };
}

function getEffectiveCurrentPlanPrice(subscription, currentPlan) {
  if (subscription?.pricingSnapshot?.agreedPriceRupees !== undefined) {
    return Number(subscription.pricingSnapshot.agreedPriceRupees);
  }
  if (subscription?.agreedPriceRupees !== undefined && subscription.agreedPriceRupees !== null) {
    return Number(subscription.agreedPriceRupees);
  }
  if (currentPlan) {
    return getPlanPriceForCycle(currentPlan, subscription?.billingCycle || 'MONTHLY');
  }
  return Number(subscription?.amount || 0);
}

async function calculateUpgradeQuote({ subscription, targetPlan, billingCycle }) {
  if (!subscription) {
    throw createHttpError('Subscription not found for upgrade quote', 404, 'SUBSCRIPTION_NOT_FOUND');
  }

  const normCycle = validatePlanAndCycle({ plan: targetPlan, billingCycle });
  const currentPlan =
    subscription.planId && typeof subscription.planId === 'object' && subscription.planId._id
      ? subscription.planId
      : await Plan.findById(subscription.planId);

  const targetPriceRupees = getPlanPriceForCycle(targetPlan, normCycle);
  const currentAgreedPriceRupees = getEffectiveCurrentPlanPrice(subscription, currentPlan);
  const currentFeatures = new Set(
    subscription.pricingSnapshot?.includedFeatures?.length
      ? subscription.pricingSnapshot.includedFeatures
      : currentPlan?.includedFeatures || []
  );
  const targetFeatures = new Set(targetPlan.includedFeatures || []);

  const addedFeatures = [...targetFeatures].filter((f) => !currentFeatures.has(f));
  const removedFeatures = [...currentFeatures].filter((f) => !targetFeatures.has(f));

  const now = new Date();
  let prorationCreditRupees = 0;

  // Apply transparent remaining-cycle proration credit ONLY on active paid subscriptions switching plans
  const isSamePlanSameCycle =
    currentPlan &&
    String(currentPlan._id) === String(targetPlan._id) &&
    subscription.billingCycle === normCycle;

  if (
    !isSamePlanSameCycle &&
    subscription.status === 'ACTIVE' &&
    subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) > now
  ) {
    // Base credit on actual cash paid (never grant cash credit for ₹0 trial or ₹0 100% promo)
    const cashPaid =
      subscription.pricingSnapshot?.finalPayableRupees !== undefined
        ? Number(subscription.pricingSnapshot.finalPayableRupees)
        : Number(subscription.amount || 0);

    if (cashPaid > 0) {
      const startMs = new Date(
        subscription.currentPeriodStart || subscription.activatedAt || subscription.createdAt || now
      ).getTime();
      const endMs = new Date(subscription.currentPeriodEnd).getTime();
      const totalMs = Math.max(1, endMs - startMs);
      const remainingMs = Math.max(0, endMs - now.getTime());
      const ratio = Math.min(1, remainingMs / totalMs);
      const rawCredit = Math.round(cashPaid * ratio);
      prorationCreditRupees = Math.min(targetPriceRupees, Math.max(0, rawCredit));
    }
  }

  const finalPayableRupees = Math.max(0, targetPriceRupees - prorationCreditRupees);

  const isHigherPrice = targetPriceRupees > currentAgreedPriceRupees;
  const isUpgrade =
    isHigherPrice ||
    subscription.status === 'TRIAL' ||
    subscription.status === 'EXPIRED' ||
    subscription.status === 'PENDING_PAYMENT' ||
    subscription.status === 'PAYMENT_FAILED';

  return {
    currentStatus: subscription.status,
    currentPlan,
    targetPlan,
    billingCycle: normCycle,
    currentAgreedPriceRupees,
    targetPriceRupees,
    prorationCreditRupees,
    finalPayableRupees,
    isUpgrade,
    isDowngrade: subscription.status === 'ACTIVE' && targetPriceRupees < currentAgreedPriceRupees,
    addedFeatures,
    removedFeatures,
    limitComparison: {
      current: currentPlan?.limits || subscription.pricingSnapshot?.limits || {},
      target: targetPlan.limits || {},
    },
    effectiveDate: now,
  };
}

async function finalizeOnlinePaymentActivation({
  subscriptionId = null,
  subscription: initialSub = null,
  orderId = null,
  paymentId,
  signature = null,
  targetPlanId = null,
  targetBillingCycle = null,
  intent = null,
  actor = null,
  paymentMethod = 'one_time_online',
}) {
  if (!paymentId) {
    throw createHttpError('paymentId is required for online payment finalization', 400, 'PAYMENT_ID_REQUIRED');
  }

  // Fast idempotency check outside transaction
  const preExistingPayment = await Payment.findOne({
    paymentId,
    status: 'CAPTURED',
  }).lean();

  if (preExistingPayment) {
    const existingSub =
      (preExistingPayment.subscriptionId
        ? await Subscription.findById(preExistingPayment.subscriptionId).populate('planId')
        : null) || initialSub;
    const existingInvoice = preExistingPayment.invoiceId
      ? await Invoice.findById(preExistingPayment.invoiceId).lean()
      : await Invoice.findOne({ paymentId: preExistingPayment._id }).lean();

    return {
      idempotent: true,
      subscription: existingSub,
      payment: preExistingPayment,
      invoice: existingInvoice,
    };
  }

  return runInTransaction(async (session) => {
    const findOpts = session ? { session } : {};

    // Re-check idempotency inside transaction
    const txExistingPayment = await Payment.findOne(
      { paymentId, status: 'CAPTURED' },
      null,
      findOpts
    );

    if (txExistingPayment) {
      const existingSub = await Subscription.findById(
        txExistingPayment.subscriptionId,
        null,
        findOpts
      ).populate('planId');
      const existingInvoice = await Invoice.findOne(
        { paymentId: txExistingPayment._id },
        null,
        findOpts
      );
      return {
        idempotent: true,
        subscription: existingSub,
        payment: txExistingPayment,
        invoice: existingInvoice,
      };
    }

    let sub = null;
    if (initialSub?._id) {
      sub = await Subscription.findById(initialSub._id, null, findOpts).populate('planId');
    } else if (subscriptionId) {
      sub = await Subscription.findById(subscriptionId, null, findOpts).populate('planId');
    } else if (orderId) {
      sub = await Subscription.findOne(
        { $or: [{ 'pendingCheckout.orderId': orderId }, { orderId }] },
        null,
        findOpts
      ).populate('planId');
    }

    if (!sub) {
      throw createHttpError('Subscription record not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    const matchingPending =
      sub.pendingCheckout && orderId && sub.pendingCheckout.orderId === orderId
        ? sub.pendingCheckout
        : null;

    const resolvedIntent =
      intent ||
      matchingPending?.intent ||
      (sub.status === 'ACTIVE' ? 'RENEWAL' : sub.status === 'EXPIRED' ? 'REACTIVATION' : 'ACTIVATION');

    const resolvedPlanId =
      targetPlanId ||
      matchingPending?.targetPlanId ||
      sub.planId?._id ||
      sub.planId;

    const plan = await getPublishedPlanOrFail(
      { planId: resolvedPlanId },
      { requirePublished: false, session }
    );

    const resolvedCycle = normalizeBillingCycle(
      targetBillingCycle || matchingPending?.targetBillingCycle || sub.billingCycle || 'MONTHLY',
      { strict: false }
    );

    const now = new Date();
    const prevStatus = sub.status;
    const prevPlanId = sub.planId?._id || sub.planId;
    const prevPlanName = sub.pricingSnapshot?.planName || sub.planId?.name;

    const catalogPrice = getPlanPriceForCycle(plan, resolvedCycle);
    const prorationCreditRupees = Number(matchingPending?.prorationCreditRupees || 0);
    const discountAmountRupees = Number(matchingPending?.discountAmountRupees || 0);

    const existingPaymentDoc = orderId
      ? await Payment.findOne({ orderId, organizationId: sub.organizationId }, null, findOpts)
      : null;

    const finalPayableRupees =
      matchingPending?.finalPayableRupees !== undefined
        ? Number(matchingPending.finalPayableRupees)
        : existingPaymentDoc?.amountRupees !== undefined && existingPaymentDoc.amountRupees > 0
        ? Number(existingPaymentDoc.amountRupees)
        : Math.max(0, catalogPrice - prorationCreditRupees - discountAmountRupees);

    const finalPayablePaise = Math.round(finalPayableRupees * 100);

    // For upgrades, start a new billing cycle from now; for ACTIVE renewals, extend from currentPeriodEnd
    const period = calculateSubscriptionPeriod({
      activationDate: now,
      billingCycle: resolvedCycle,
      existingSubscription:
        resolvedIntent === 'UPGRADE' ? { ...sub.toObject(), status: 'EXPIRED' } : sub,
      durationCycles: 1,
    });

    const snapshot = buildPricingSnapshot({
      plan,
      billingCycle: resolvedCycle,
      agreedPriceRupees: catalogPrice,
      finalPayableRupees,
      source: `ONLINE_${resolvedIntent}`,
    });

    sub.planId = plan._id;
    sub.billingCycle = resolvedCycle;
    sub.status = 'ACTIVE';
    sub.activationMethod = 'ONLINE_PAYMENT';
    sub.renewalMode = 'MANUAL';
    sub.autoRenew = false;
    sub.agreedPriceRupees = catalogPrice;
    sub.amount = finalPayableRupees;
    sub.amountPaise = finalPayablePaise;
    sub.currency = (plan.currency || 'INR').toUpperCase();
    sub.pricingSnapshot = snapshot;
    sub.startedAt = sub.startedAt || now;
    sub.activatedAt = sub.activatedAt || now;
    sub.currentPeriodStart = period.periodStart;
    sub.currentPeriodEnd = period.periodEnd;
    sub.paidCount = (sub.paidCount || 0) + 1;
    if (orderId) sub.orderId = orderId;

    if (sub.pendingCheckout) {
      sub.pendingCheckout.status = 'COMPLETED';
      sub.pendingCheckout.updatedAt = now;
    }

    // Clear pending scheduled downgrade if admin just upgraded or renewed manually
    if (
      sub.scheduledPlanChange &&
      sub.scheduledPlanChange.status === 'SCHEDULED' &&
      (resolvedIntent === 'UPGRADE' || resolvedIntent === 'RENEWAL')
    ) {
      sub.scheduledPlanChange.status = 'CANCELLED';
    }

    const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber(
      sub.organizationId,
      'Q2-INV',
      now.getFullYear(),
      session
    );

    let payment = existingPaymentDoc;
    if (payment && payment.status !== 'CAPTURED') {
      payment.planId = plan._id;
      payment.paymentId = paymentId;
      payment.signature = signature || payment.signature;
      payment.amountPaise = finalPayablePaise;
      payment.amountRupees = finalPayableRupees;
      payment.status = 'CAPTURED';
      payment.paymentMethod = paymentMethod || payment.paymentMethod || 'one_time_online';
      payment.capturedAt = now;
      payment.intent = resolvedIntent;
      payment.billingCycle = resolvedCycle;
      payment.planSnapshot = snapshot;
      await payment.save(findOpts);
    } else if (!payment) {
      const createdPayments = await Payment.create(
        [
          {
            organizationId: sub.organizationId,
            billingDomain: 'SAAS',
            subscriptionId: sub._id,
            planId: plan._id,
            razorpaySubscriptionId: sub.razorpaySubscriptionId || undefined,
            orderId: orderId || sub.orderId || `order_${Date.now()}`,
            amountPaise: finalPayablePaise,
            amountRupees: finalPayableRupees,
            discountRupees: discountAmountRupees,
            currency: sub.currency || 'INR',
            provider: 'RAZORPAY',
            paymentId,
            signature: signature || undefined,
            status: 'CAPTURED',
            paymentMethod,
            intent: resolvedIntent,
            billingCycle: resolvedCycle,
            planSnapshot: snapshot,
            capturedAt: now,
          },
        ],
        findOpts
      );
      payment = createdPayments[0];
    }

    const createdInvoices = await Invoice.create(
      [
        {
          organizationId: sub.organizationId,
          paymentId: payment._id,
          subscriptionId: sub._id,
          invoiceNumber,
          invoiceType: 'SAAS_INVOICE',
          subtotalRupees: catalogPrice,
          taxRupees: 0,
          discountRupees: prorationCreditRupees + discountAmountRupees,
          originalAmountRupees: catalogPrice,
          totalRupees: finalPayableRupees,
          currency: sub.currency || 'INR',
          status: 'PAID',
          issuedAt: now,
          paidAt: now,
          notes:
            prorationCreditRupees > 0
              ? `Plan ${resolvedIntent.toLowerCase()} to ${plan.name} (${resolvedCycle}) with ₹${prorationCreditRupees} proration credit`
              : `SaaS ${resolvedIntent.toLowerCase()} - ${plan.name} (${resolvedCycle})`,
        },
      ],
      findOpts
    );
    const invoice = createdInvoices[0];

    payment.invoiceId = invoice._id;
    await payment.save(findOpts);

    await LedgerEntry.create(
      [
        {
          organizationId: sub.organizationId,
          subscriptionId: sub._id,
          paymentId: payment._id,
          invoiceId: invoice._id,
          amountPaise: payment.amountPaise,
          amountRupees: payment.amountRupees,
          currency: payment.currency,
          type: 'CREDIT',
          source: 'SAAS_SUBSCRIPTION',
          externalReference: paymentId,
          description: `Hosteliq SaaS ${resolvedIntent} - ${plan.name} (${resolvedCycle}) [${invoiceNumber}]`,
        },
      ],
      findOpts
    );

    sub.history = sub.history || [];
    sub.history.push(
      buildHistoryEntry({
        eventType:
          resolvedIntent === 'UPGRADE'
            ? 'SUBSCRIPTION_UPGRADED'
            : resolvedIntent === 'RENEWAL'
            ? 'SUBSCRIPTION_RENEWED'
            : resolvedIntent === 'REACTIVATION'
            ? 'SUBSCRIPTION_REACTIVATED'
            : 'SUBSCRIPTION_ACTIVATED',
        fromStatus: prevStatus,
        toStatus: 'ACTIVE',
        fromPlanId: prevPlanId,
        fromPlanName: prevPlanName,
        toPlanId: plan._id,
        toPlanName: plan.name,
        billingCycle: resolvedCycle,
        amountRupees: finalPayableRupees,
        activationMethod: 'ONLINE_PAYMENT',
        paymentId,
        invoiceNumber,
        actor,
        notes: `Verified online payment (${paymentId}) for ${plan.name} (${resolvedCycle})`,
      })
    );

    await sub.save(findOpts);

    await Organization.findByIdAndUpdate(
      sub.organizationId,
      { subscriptionId: sub._id, status: 'ACTIVE' },
      findOpts
    );

    await syncOrganizationFeatures(sub.organizationId, plan.includedFeatures || [], {
      enabled: true,
      session,
    });

    await AuditLog.create(
      [
        {
          organizationId: sub.organizationId,
          actorId: actor?._id,
          actorName: actor?.name || actor?.username || 'System / Webhook',
          actorEmail: actor?.email,
          action:
            resolvedIntent === 'UPGRADE'
              ? 'SAAS_SUBSCRIPTION_UPGRADED'
              : 'SAAS_SUBSCRIPTION_ACTIVATED',
          entityType: 'Subscription',
          entityId: sub._id.toString(),
          oldValue: { status: prevStatus, planId: prevPlanId, planName: prevPlanName },
          newValue: {
            orderId: payment.orderId,
            paymentId,
            planId: plan._id,
            planName: plan.name,
            billingCycle: resolvedCycle,
            agreedPriceRupees: catalogPrice,
            finalPayableRupees,
            invoiceNumber,
            currentPeriodEnd: period.periodEnd,
            activationMethod: 'ONLINE_PAYMENT',
          },
        },
      ],
      findOpts
    ).catch((auditErr) => {
      console.error('[SubscriptionLifecycle:Audit] Notice:', auditErr.message);
    });

    await sub.populate('planId');

    return {
      idempotent: false,
      subscription: sub,
      payment,
      invoice,
    };
  });
}

async function recordOnlinePaymentFailure({
  organizationId = null,
  orderId = null,
  code = 'PAYMENT_FAILED',
  reason = 'Payment was cancelled or failed at the gateway',
  actor = null,
}) {
  const now = new Date();
  let payment = null;
  if (orderId) {
    payment = await Payment.findOne({ orderId });
    if (payment && payment.status !== 'CAPTURED') {
      payment.status = 'FAILED';
      payment.failedAt = now;
      payment.failureCode = String(code || 'PAYMENT_FAILED');
      payment.failureReason = String(reason || 'Payment failed');
      await payment.save();
    }
  }

  let sub = null;
  if (orderId) {
    sub = await Subscription.findOne({
      $or: [{ 'pendingCheckout.orderId': orderId }, { orderId }],
    });
  }
  if (!sub && organizationId) {
    sub = await Subscription.findOne({ organizationId });
  }

  if (sub) {
    const prevStatus = sub.status;
    if (sub.pendingCheckout && (!orderId || sub.pendingCheckout.orderId === orderId)) {
      sub.pendingCheckout.status = 'FAILED';
      sub.pendingCheckout.failureCode = String(code || 'PAYMENT_FAILED');
      sub.pendingCheckout.failureReason = String(reason || 'Payment failed');
      sub.pendingCheckout.updatedAt = now;
    }

    // Do NOT alter an already ACTIVE or TRIAL subscription's entitlements or dates on upgrade/renewal failure
    if (['PENDING_PAYMENT', 'CREATED', 'PENDING'].includes(sub.status)) {
      sub.status = 'PAYMENT_FAILED';
    }

    sub.history = sub.history || [];
    sub.history.push(
      buildHistoryEntry({
        eventType: 'PAYMENT_FAILED',
        fromStatus: prevStatus,
        toStatus: sub.status,
        toPlanId: sub.pendingCheckout?.targetPlanId || sub.planId,
        toPlanName: sub.pendingCheckout?.targetPlanName || sub.pricingSnapshot?.planName,
        billingCycle: sub.pendingCheckout?.targetBillingCycle || sub.billingCycle,
        amountRupees: sub.pendingCheckout?.finalPayableRupees ?? sub.amount,
        activationMethod: 'ONLINE_PAYMENT',
        actor,
        notes: `${code}: ${reason}`,
      })
    );

    await sub.save();

    await AuditLog.create({
      organizationId: sub.organizationId,
      actorId: actor?._id,
      actorName: actor?.name || actor?.username || 'Admin',
      actorEmail: actor?.email,
      action: 'SAAS_PAYMENT_FAILED',
      entityType: 'Subscription',
      entityId: sub._id.toString(),
      newValue: { orderId, code, reason },
    }).catch(() => {});
  }

  return { payment, subscription: sub };
}

async function startTrialForOrganization({
  organizationId,
  planId = null,
  planCode = null,
  billingCycle = null,
  trialDaysOverride = null,
  actor = null,
}) {
  if (!organizationId) {
    throw createHttpError('Organization ID is required', 400, 'ORGANIZATION_REQUIRED');
  }

  const org = await Organization.findById(organizationId);
  if (!org) {
    throw createHttpError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }

  const existingSub = await Subscription.findOne({ organizationId }).populate('planId');

  // Resolve target plan: explicit selection takes precedence, else existing pending subscription's plan
  const plan = await getPublishedPlanOrFail(
    {
      planId: planId || existingSub?.planId?._id || existingSub?.planId,
      planCode: planId ? null : planCode,
    },
    { requirePublished: true }
  );

  if (plan.trialEligible === false) {
    throw createHttpError(
      `Free trial is not available for '${plan.name}'. Please activate via Online Payment or Voucher.`,
      400,
      'TRIAL_NOT_ELIGIBLE'
    );
  }

  let effectiveTrialDays =
    trialDaysOverride !== null && trialDaysOverride !== undefined && Number(trialDaysOverride) > 0
      ? Number(trialDaysOverride)
      : Number(plan.trialDays ?? 0);

  if (effectiveTrialDays <= 0) {
    try {
      const settings = await platformSettingsService.getSettings();
      effectiveTrialDays = Number(settings?.trial?.defaultTrialDays || 14);
    } catch {
      effectiveTrialDays = 14;
    }
  }

  if (effectiveTrialDays <= 0) {
    throw createHttpError(
      `Plan '${plan.name}' does not have a positive trial duration configured.`,
      400,
      'TRIAL_NOT_ELIGIBLE'
    );
  }

  if (existingSub) {
    if (existingSub.status === 'ACTIVE' && existingSub.paidCount > 0) {
      throw createHttpError(
        'Cannot start a free trial while a paid subscription is active.',
        400,
        'SUBSCRIPTION_ALREADY_ACTIVE'
      );
    }
    if (existingSub.trialUsed && existingSub.status !== 'PENDING_PAYMENT') {
      throw createHttpError(
        'This organization has already utilized its free trial eligibility.',
        400,
        'TRIAL_ALREADY_USED'
      );
    }
    if (existingSub.status === 'TRIAL') {
      throw createHttpError(
        'A free trial is already active for this organization.',
        400,
        'TRIAL_ALREADY_ACTIVE'
      );
    }
  }

  const normCycle = validatePlanAndCycle({
    plan,
    billingCycle: billingCycle || existingSub?.billingCycle || 'MONTHLY',
  });

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + effectiveTrialDays * 24 * 60 * 60 * 1000);
  const catalogPrice = getPlanPriceForCycle(plan, normCycle);

  const snapshot = buildPricingSnapshot({
    plan,
    billingCycle: normCycle,
    agreedPriceRupees: catalogPrice,
    finalPayableRupees: catalogPrice,
    source: 'FREE_TRIAL',
  });

  const prevStatus = existingSub?.status || null;
  const prevPlanId = existingSub?.planId?._id || existingSub?.planId || null;

  let subscription = existingSub;
  if (!subscription) {
    subscription = new Subscription({ organizationId });
  }

  subscription.planId = plan._id;
  subscription.billingCycle = normCycle;
  subscription.status = 'TRIAL';
  subscription.activationMethod = 'FREE_TRIAL';
  subscription.renewalMode = 'MANUAL';
  subscription.autoRenew = false;
  subscription.agreedPriceRupees = catalogPrice;
  subscription.amount = 0; // Trial does NOT record money received
  subscription.amountPaise = 0;
  subscription.currency = (plan.currency || 'INR').toUpperCase();
  subscription.pricingSnapshot = snapshot;
  subscription.startedAt = subscription.startedAt || now;
  subscription.trialStartsAt = now;
  subscription.trialEndsAt = trialEndsAt;
  subscription.trialUsed = true;
  subscription.currentPeriodStart = now;
  subscription.currentPeriodEnd = trialEndsAt;
  subscription.history = subscription.history || [];
  subscription.history.push(
    buildHistoryEntry({
      eventType: 'TRIAL_STARTED',
      fromStatus: prevStatus,
      toStatus: 'TRIAL',
      fromPlanId: prevPlanId,
      toPlanId: plan._id,
      toPlanName: plan.name,
      billingCycle: normCycle,
      amountRupees: 0,
      activationMethod: 'FREE_TRIAL',
      actor,
      notes: `${effectiveTrialDays}-day free trial activated on ${plan.name} (${normCycle})`,
    })
  );

  await subscription.save();

  org.subscriptionId = subscription._id;
  org.status = 'TRIAL';
  await org.save();

  await syncOrganizationFeatures(organizationId, plan.includedFeatures || [], { enabled: true });

  await AuditLog.create({
    organizationId,
    actorId: actor?._id,
    actorName: actor?.name || actor?.username || 'Admin',
    actorEmail: actor?.email,
    action: 'SUBSCRIPTION_TRIAL_STARTED',
    entityType: 'Subscription',
    entityId: subscription._id.toString(),
    newValue: {
      planId: plan._id,
      planName: plan.name,
      billingCycle: normCycle,
      agreedPriceRupees: catalogPrice,
      trialDays: effectiveTrialDays,
      trialStartsAt: now,
      trialEndsAt,
    },
  }).catch(() => {});

  await subscription.populate('planId');
  return subscription;
}

async function scheduleDowngradeForOrganization({
  organizationId,
  targetPlanId,
  billingCycle = null,
  confirmOverCapacity = false,
  actor = null,
}) {
  const subscription = await Subscription.findOne({ organizationId }).populate('planId');
  if (!subscription) {
    throw createHttpError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
  }

  if (subscription.status !== 'ACTIVE') {
    throw createHttpError(
      'Only active paid subscriptions can schedule a next-cycle downgrade. Trial or expired accounts should activate or choose a plan directly.',
      400,
      'DOWNGRADE_REQUIRES_ACTIVE_SUBSCRIPTION'
    );
  }

  const targetPlan = await getPublishedPlanOrFail({ planId: targetPlanId }, { requirePublished: true });
  const normCycle = validatePlanAndCycle({
    plan: targetPlan,
    billingCycle: billingCycle || subscription.billingCycle || 'MONTHLY',
  });

  const currentPlan = subscription.planId;
  if (
    currentPlan &&
    String(currentPlan._id) === String(targetPlan._id) &&
    subscription.billingCycle === normCycle
  ) {
    throw createHttpError('Organization is already on this exact plan and billing cycle.', 400, 'SAME_PLAN');
  }

  const currentPrice = getEffectiveCurrentPlanPrice(subscription, currentPlan);
  const targetPrice = getPlanPriceForCycle(targetPlan, normCycle);

  // Guard: If target plan/cycle is more expensive AND higher tier, guide caller to Upgrade flow
  if (targetPrice > currentPrice && String(currentPlan?._id) !== String(targetPlan._id)) {
    throw createHttpError(
      'Selected plan is higher priced than your current plan. Use Upgrade Plan instead.',
      400,
      'USE_UPGRADE_WORKFLOW'
    );
  }

  const usage = await computeOrganizationUsage(organizationId);
  const targetLimits = targetPlan.limits?.toObject ? targetPlan.limits.toObject() : targetPlan.limits || {};
  const capacityWarnings = [];

  if (targetLimits.maxStudents > 0 && usage.studentCount > targetLimits.maxStudents) {
    capacityWarnings.push(
      `Active students (${usage.studentCount}) exceed ${targetPlan.name} limit (${targetLimits.maxStudents}).`
    );
  }
  if (targetLimits.maxRooms > 0 && usage.roomCount > targetLimits.maxRooms) {
    capacityWarnings.push(
      `Configured rooms (${usage.roomCount}) exceed ${targetPlan.name} limit (${targetLimits.maxRooms}).`
    );
  }
  if (targetLimits.maxHostels > 0 && usage.hostelCount > targetLimits.maxHostels) {
    capacityWarnings.push(
      `Hostel branches (${usage.hostelCount}) exceed ${targetPlan.name} limit (${targetLimits.maxHostels}).`
    );
  }
  if (targetLimits.maxStaff > 0 && usage.staffCount > targetLimits.maxStaff) {
    capacityWarnings.push(
      `Active staff (${usage.staffCount}) exceed ${targetPlan.name} limit (${targetLimits.maxStaff}).`
    );
  }

  const currentFeatures = new Set(
    subscription.pricingSnapshot?.includedFeatures?.length
      ? subscription.pricingSnapshot.includedFeatures
      : currentPlan?.includedFeatures || []
  );
  const targetFeatures = new Set(targetPlan.includedFeatures || []);
  const removedFeatures = [...currentFeatures].filter((f) => !targetFeatures.has(f));

  const effectiveDate = subscription.currentPeriodEnd || new Date();

  if (capacityWarnings.length > 0 && !confirmOverCapacity) {
    return {
      requiresConfirmation: true,
      scheduled: false,
      effectiveDate,
      capacityWarnings,
      removedFeatures,
      usage,
      targetLimits,
      targetPlan,
      targetPriceRupees: targetPrice,
      billingCycle: normCycle,
    };
  }

  const now = new Date();
  subscription.scheduledPlanChange = {
    targetPlanId: targetPlan._id,
    targetPlanCode: targetPlan.code,
    targetPlanName: targetPlan.name,
    targetBillingCycle: normCycle,
    targetPriceRupees: targetPrice,
    changeType: 'DOWNGRADE',
    effectiveDate,
    scheduledAt: now,
    scheduledBy: actor?._id || actor?.id,
    capacityWarnings,
    acknowledgedCapacityWarning: Boolean(confirmOverCapacity),
    status: 'SCHEDULED',
  };

  subscription.history = subscription.history || [];
  subscription.history.push(
    buildHistoryEntry({
      eventType: 'DOWNGRADE_SCHEDULED',
      fromStatus: subscription.status,
      toStatus: subscription.status,
      fromPlanId: currentPlan?._id,
      fromPlanName: currentPlan?.name || subscription.pricingSnapshot?.planName,
      toPlanId: targetPlan._id,
      toPlanName: targetPlan.name,
      billingCycle: normCycle,
      amountRupees: targetPrice,
      activationMethod: subscription.activationMethod,
      actor,
      notes: `Downgrade scheduled for next billing cycle (${new Date(effectiveDate).toISOString()})`,
    })
  );

  await subscription.save();

  await AuditLog.create({
    organizationId,
    actorId: actor?._id,
    actorName: actor?.name || actor?.username || 'Admin',
    actorEmail: actor?.email,
    action: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
    entityType: 'Subscription',
    entityId: subscription._id.toString(),
    oldValue: {
      planId: currentPlan?._id,
      planName: currentPlan?.name,
      billingCycle: subscription.billingCycle,
    },
    newValue: {
      targetPlanId: targetPlan._id,
      targetPlanName: targetPlan.name,
      targetBillingCycle: normCycle,
      targetPriceRupees: targetPrice,
      effectiveDate,
      capacityWarnings,
    },
  }).catch(() => {});

  return {
    requiresConfirmation: false,
    scheduled: true,
    effectiveDate,
    capacityWarnings,
    removedFeatures,
    usage,
    targetLimits,
    scheduledPlanChange: subscription.scheduledPlanChange,
    subscription,
  };
}

async function cancelScheduledDowngradeForOrganization({ organizationId, actor = null }) {
  const subscription = await Subscription.findOne({ organizationId }).populate('planId');
  if (!subscription) {
    throw createHttpError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
  }
  if (!subscription.scheduledPlanChange || subscription.scheduledPlanChange.status !== 'SCHEDULED') {
    throw createHttpError('No scheduled plan change exists to cancel', 404, 'NO_SCHEDULED_CHANGE');
  }

  const prevTargetName = subscription.scheduledPlanChange.targetPlanName;
  subscription.scheduledPlanChange.status = 'CANCELLED';
  subscription.history = subscription.history || [];
  subscription.history.push(
    buildHistoryEntry({
      eventType: 'SCHEDULED_DOWNGRADE_CANCELLED',
      fromStatus: subscription.status,
      toStatus: subscription.status,
      toPlanId: subscription.planId?._id,
      toPlanName: subscription.planId?.name,
      actor,
      notes: `Cancelled scheduled downgrade to ${prevTargetName}`,
    })
  );

  await subscription.save();

  await AuditLog.create({
    organizationId,
    actorId: actor?._id,
    actorName: actor?.name || actor?.username || 'Admin',
    actorEmail: actor?.email,
    action: 'SUBSCRIPTION_DOWNGRADE_CANCELLED',
    entityType: 'Subscription',
    entityId: subscription._id.toString(),
    oldValue: { targetPlanName: prevTargetName },
  }).catch(() => {});

  return subscription;
}

module.exports = {
  CORE_FEATURE_KEYS,
  createHttpError,
  normalizeBillingCycle,
  getPublishedPlanOrFail,
  validatePlanAndCycle,
  getPlanPriceForCycle,
  buildPricingSnapshot,
  runInTransaction,
  syncOrganizationFeatures,
  computeOrganizationUsage,
  getNearExpiryThresholdDays,
  evaluateNearExpiry,
  buildHistoryEntry,
  applyMaturedScheduledDowngrade,
  getEffectiveCurrentPlanPrice,
  calculateUpgradeQuote,
  finalizeOnlinePaymentActivation,
  recordOnlinePaymentFailure,
  startTrialForOrganization,
  scheduleDowngradeForOrganization,
  cancelScheduledDowngradeForOrganization,
};

