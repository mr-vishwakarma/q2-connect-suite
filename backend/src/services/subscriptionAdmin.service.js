const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Plan = require('../models/Plan');

const subscriptionAdminService = {
  async getAllSubscriptions(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.billingCycle && query.billingCycle !== 'all') {
      filter.billingCycle = query.billingCycle;
    }

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate('organizationId', 'name slug contactEmail status')
        .populate('planId', 'name code priceMonthly priceYearly limits')
        .sort({ currentPeriodEnd: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subscription.countDocuments(filter),
    ]);

    return {
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async updateSubscription(id, data) {
    const sub = await Subscription.findById(id);
    if (!sub) throw new Error('Subscription not found');

    if (data.status) sub.status = data.status;
    if (data.billingCycle) sub.billingCycle = data.billingCycle;
    if (data.currentPeriodEnd) sub.currentPeriodEnd = new Date(data.currentPeriodEnd);
    if (data.planId) sub.planId = data.planId;

    await sub.save();
    return sub.populate(['organizationId', 'planId']);
  },

  async extendTrial(id, additionalDays = 14) {
    const sub = await Subscription.findById(id);
    if (!sub) throw new Error('Subscription not found');

    const days = Number(additionalDays) || 14;
    const baseDate = sub.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date();
    const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    sub.trialEndsAt = newEnd;
    sub.currentPeriodEnd = newEnd;
    sub.status = 'TRIAL';
    await sub.save();

    // Update organization status if trial extended
    await Organization.findByIdAndUpdate(sub.organizationId, { status: 'TRIAL' });

    return sub.populate(['organizationId', 'planId']);
  },
};

module.exports = { subscriptionAdminService };
