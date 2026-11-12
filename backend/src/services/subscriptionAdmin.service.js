const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const VoucherRedemption = require('../models/VoucherRedemption');
const {
  getPublishedPlanOrFail,
  validatePlanAndCycle,
  getPlanPriceForCycle,
  buildPricingSnapshot,
  syncOrganizationFeatures,
  buildHistoryEntry,
  computeOrganizationUsage,
  evaluateNearExpiry,
  getNearExpiryThresholdDays,
} = require('./subscriptionLifecycle.service');

const subscriptionAdminService = {
  async getAllSubscriptions(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const thresholdDays = await getNearExpiryThresholdDays();
    const now = new Date();
    const filter = {};

    if (query.status && !['all', 'ALL'].includes(query.status)) {
      const st = String(query.status).toUpperCase().trim();
      if (st === 'NEAR_EXPIRY') {
        const horizon = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);
        filter.status = { $in: ['ACTIVE', 'TRIAL'] };
        filter.currentPeriodEnd = { $gt: now, $lte: horizon };
      } else {
        filter.status = st;
      }
    }

    if (query.billingCycle && !['all', 'ALL'].includes(query.billingCycle)) {
      filter.billingCycle = String(query.billingCycle).toUpperCase().trim();
    }

    if (query.activationMethod && !['all', 'ALL'].includes(query.activationMethod)) {
      filter.activationMethod = String(query.activationMethod).toUpperCase().trim();
    }

    if (query.hasScheduledChange === 'true') {
      filter['scheduledPlanChange.status'] = 'SCHEDULED';
    }

    if (query.search && String(query.search).trim()) {
      const searchRegex = { $regex: String(query.search).trim(), $options: 'i' };
      const [matchingOrgs, matchingPlans] = await Promise.all([
        Organization.find({
          $or: [{ name: searchRegex }, { slug: searchRegex }, { contactEmail: searchRegex }],
        })
          .select('_id')
          .lean(),
        Plan.find({ $or: [{ name: searchRegex }, { code: searchRegex }] })
          .select('_id')
          .lean(),
      ]);

      filter.$or = [
        { organizationId: { $in: matchingOrgs.map((o) => o._id) } },
        { planId: { $in: matchingPlans.map((p) => p._id) } },
        { lastVoucherReference: searchRegex },
        { 'pricingSnapshot.planName': searchRegex },
      ];
    }

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate('organizationId', 'name slug contactEmail status')
        .populate('planId', 'name code priceMonthly priceYearly limits trialEligible trialDays')
        .sort({ updatedAt: -1, currentPeriodEnd: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subscription.countDocuments(filter),
    ]);

    const subIds = subscriptions.map((s) => s._id);
    const [payments, redemptions] = subIds.length
      ? await Promise.all([
          Payment.find({ subscriptionId: { $in: subIds }, billingDomain: 'SAAS' })
            .sort({ createdAt: -1 })
            .lean(),
          VoucherRedemption.find({ subscriptionId: { $in: subIds } })
            .populate('voucherId', 'name reference codeMasked voucherType')
            .sort({ redeemedAt: -1 })
            .lean(),
        ])
      : [[], []];

    const latestPaymentBySub = new Map();
    for (const p of payments) {
      const k = String(p.subscriptionId);
      if (!latestPaymentBySub.has(k)) latestPaymentBySub.set(k, p);
    }

    const latestVoucherBySub = new Map();
    for (const r of redemptions) {
      const k = String(r.subscriptionId);
      if (!latestVoucherBySub.has(k)) latestVoucherBySub.set(k, r);
    }

    const enriched = subscriptions.map((sub) => {
      const key = String(sub._id);
      return {
        ...sub,
        nearExpiry: evaluateNearExpiry(sub, thresholdDays, now),
        latestPayment: latestPaymentBySub.get(key) || null,
        latestVoucherRedemption: latestVoucherBySub.get(key) || null,
      };
    });

    return {
      subscriptions: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getSubscriptionDetail(id) {
    const sub = await Subscription.findById(id)
      .populate('organizationId', 'name slug contactEmail phone status')
      .populate('planId')
      .populate('lastVoucherId', 'name reference codeMasked voucherType')
      .lean();
    if (!sub) throw new Error('Subscription not found');

    const [payments, invoices, voucherRedemptions, usage, thresholdDays] = await Promise.all([
      Payment.find({ subscriptionId: sub._id, billingDomain: 'SAAS' })
        .populate('planId', 'name code')
        .sort({ createdAt: -1 })
        .lean(),
      Invoice.find({ subscriptionId: sub._id, invoiceType: 'SAAS_INVOICE' })
        .sort({ createdAt: -1 })
        .lean(),
      VoucherRedemption.find({ subscriptionId: sub._id })
        .populate('voucherId', 'name reference codeMasked voucherType')
        .populate('planId', 'name code')
        .sort({ redeemedAt: -1 })
        .lean(),
      computeOrganizationUsage(sub.organizationId?._id || sub.organizationId),
      getNearExpiryThresholdDays(),
    ]);

    return {
      subscription: {
        ...sub,
        usage,
        nearExpiry: evaluateNearExpiry(sub, thresholdDays),
      },
      payments,
      invoices,
      voucherRedemptions,
    };
  },

  async updateSubscription(id, data, actor = null) {
    const sub = await Subscription.findById(id).populate('planId');
    if (!sub) throw new Error('Subscription not found');

    const prevStatus = sub.status;
    const prevPlanId = sub.planId?._id || sub.planId;
    const prevPlanName = sub.pricingSnapshot?.planName || sub.planId?.name;

    let targetPlan = sub.planId;
    if (data.planId && String(data.planId) !== String(prevPlanId)) {
      targetPlan = await getPublishedPlanOrFail({ planId: data.planId }, { requirePublished: false });
      sub.planId = targetPlan._id;
    }

    const normCycle = data.billingCycle
      ? validatePlanAndCycle({ plan: targetPlan, billingCycle: data.billingCycle })
      : sub.billingCycle || 'MONTHLY';
    sub.billingCycle = normCycle;

    if (data.status) {
      sub.status = String(data.status).toUpperCase().trim();
    }
    if (data.currentPeriodEnd) {
      sub.currentPeriodEnd = new Date(data.currentPeriodEnd);
    }

    if (targetPlan && (data.planId || data.billingCycle)) {
      const agreedPrice = getPlanPriceForCycle(targetPlan, normCycle);
      sub.agreedPriceRupees = agreedPrice;
      if (sub.status === 'ACTIVE' && !data.preserveAmount) {
        sub.amount = agreedPrice;
        sub.amountPaise = Math.round(agreedPrice * 100);
      }
      sub.pricingSnapshot = buildPricingSnapshot({
        plan: targetPlan,
        billingCycle: normCycle,
        agreedPriceRupees: agreedPrice,
        finalPayableRupees: sub.status === 'TRIAL' ? agreedPrice : sub.amount ?? agreedPrice,
        source: 'SUPER_ADMIN_UPDATE',
      });
    }

    sub.history = sub.history || [];
    sub.history.push(
      buildHistoryEntry({
        eventType: 'SUPER_ADMIN_MODIFIED',
        fromStatus: prevStatus,
        toStatus: sub.status,
        fromPlanId: prevPlanId,
        fromPlanName: prevPlanName,
        toPlanId: sub.planId,
        toPlanName: targetPlan?.name,
        billingCycle: normCycle,
        amountRupees: sub.agreedPriceRupees ?? sub.amount,
        activationMethod: sub.activationMethod,
        actor,
        notes: 'Subscription updated via Super Admin control panel',
      })
    );

    await sub.save();

    if (data.planId && targetPlan) {
      await syncOrganizationFeatures(sub.organizationId, targetPlan.includedFeatures || [], {
        enabled: ['ACTIVE', 'TRIAL'].includes(sub.status),
      });
    }

    if (data.status) {
      const orgStatusMap = {
        ACTIVE: 'ACTIVE',
        TRIAL: 'TRIAL',
        EXPIRED: 'EXPIRED',
        PAST_DUE: 'PAST_DUE',
        SUSPENDED: 'SUSPENDED',
        CANCELLED: 'CANCELLED',
        PENDING_PAYMENT: 'PENDING_PAYMENT',
        PAYMENT_FAILED: 'PAYMENT_FAILED',
      };
      if (orgStatusMap[sub.status]) {
        await Organization.findByIdAndUpdate(sub.organizationId, {
          status: orgStatusMap[sub.status],
        });
      }
    }

    return sub.populate(['organizationId', 'planId']);
  },

  async extendTrial(id, additionalDays = 14, actor = null) {
    const sub = await Subscription.findById(id).populate('planId');
    if (!sub) throw new Error('Subscription not found');

    const days = Number(additionalDays) || 14;
    const now = new Date();
    const baseDate = sub.trialEndsAt && sub.trialEndsAt > now ? sub.trialEndsAt : now;
    const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    const prevStatus = sub.status;

    sub.trialStartsAt = sub.trialStartsAt || now;
    sub.trialEndsAt = newEnd;
    sub.currentPeriodEnd = newEnd;
    sub.status = 'TRIAL';
    sub.trialUsed = true;
    sub.activationMethod = sub.activationMethod === 'VOUCHER' ? 'VOUCHER' : 'FREE_TRIAL';
    sub.history = sub.history || [];
    sub.history.push(
      buildHistoryEntry({
        eventType: 'TRIAL_EXTENDED',
        fromStatus: prevStatus,
        toStatus: 'TRIAL',
        toPlanId: sub.planId?._id || sub.planId,
        toPlanName: sub.planId?.name || sub.pricingSnapshot?.planName,
        billingCycle: sub.billingCycle,
        activationMethod: sub.activationMethod,
        actor,
        notes: `Trial extended by ${days} days until ${newEnd.toISOString()}`,
      })
    );
    await sub.save();

    if (sub.planId?.includedFeatures) {
      await syncOrganizationFeatures(sub.organizationId, sub.planId.includedFeatures, {
        enabled: true,
      });
    }

    await Organization.findByIdAndUpdate(sub.organizationId, { status: 'TRIAL' });

    return sub.populate(['organizationId', 'planId']);
  },
};

module.exports = { subscriptionAdminService };
