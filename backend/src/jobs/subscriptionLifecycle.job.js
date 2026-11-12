/**
 * Distributed SaaS Subscription Lifecycle Sweep Job
 *
 * Periodic maintenance sweep (idempotent & cursor-streamed) that:
 * 1. Applies matured next-cycle scheduled downgrades (`scheduledPlanChange.status === 'SCHEDULED'`
 *    with `effectiveDate <= now`).
 * 2. Transitions expired ACTIVE / TRIAL subscriptions past their boundary monotonically to EXPIRED.
 */

const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const {
  applyMaturedScheduledDowngrade,
  buildHistoryEntry,
} = require('../services/subscriptionLifecycle.service');

/**
 * Executes the SaaS subscription lifecycle maintenance sweep.
 * @param {object} [options]
 * @returns {Promise<{ downgradesApplied: number, expiredCount: number, scannedCount: number, durationMs: number }>}
 */
async function runSubscriptionLifecycleSweep(options = {}) {
  const startTime = Date.now();
  const now = options.asOfDate ? new Date(options.asOfDate) : new Date();
  console.log('[Job: SubscriptionLifecycleSweep] Starting distributed lifecycle sweep...');

  let scannedCount = 0;
  let downgradesApplied = 0;
  let expiredCount = 0;

  try {
    const baseOrgFilter = options.organizationId ? { organizationId: options.organizationId } : {};

    // 1. Apply matured scheduled downgrades
    const scheduledCursor = Subscription.find({
      ...baseOrgFilter,
      'scheduledPlanChange.status': 'SCHEDULED',
      'scheduledPlanChange.effectiveDate': { $ne: null, $lte: now },
      status: { $ne: 'CANCELLED' },
    })
      .populate('planId')
      .cursor({ batchSize: 100 });

    for await (const sub of scheduledCursor) {
      scannedCount++;
      try {
        const res = await applyMaturedScheduledDowngrade(sub, now);
        if (res?.applied) {
          downgradesApplied++;
        }
      } catch (err) {
        console.warn(
          `[Job: SubscriptionLifecycleSweep] Failed applying scheduled downgrade for sub ${sub._id}: ${err.message}`
        );
      }
    }

    // 2. Transition expired ACTIVE or TRIAL subscriptions monotonically to EXPIRED
    const expiredCursor = Subscription.find({
      ...baseOrgFilter,
      status: { $in: ['ACTIVE', 'TRIAL'] },
      $or: [
        { status: 'TRIAL', trialEndsAt: { $ne: null, $lt: now } },
        { status: 'ACTIVE', currentPeriodEnd: { $ne: null, $lt: now } },
      ],
    })
      .populate('planId')
      .cursor({ batchSize: 100 });

    for await (const sub of expiredCursor) {
      scannedCount++;
      const expiryRef =
        sub.status === 'TRIAL' && sub.trialEndsAt
          ? new Date(sub.trialEndsAt)
          : sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd)
          : null;

      if (!expiryRef || expiryRef >= now) {
        continue;
      }

      const prevStatus = sub.status;
      sub.status = 'EXPIRED';
      sub.history = sub.history || [];
      sub.history.push(
        buildHistoryEntry({
          eventType: 'SUBSCRIPTION_EXPIRED',
          fromStatus: prevStatus,
          toStatus: 'EXPIRED',
          toPlanId: sub.planId?._id || sub.planId,
          toPlanName: sub.pricingSnapshot?.planName || sub.planId?.name,
          billingCycle: sub.billingCycle,
          notes: `Scheduled background sweep marked subscription expired (ended ${expiryRef.toISOString()})`,
        })
      );
      await sub.save();
      await Organization.findByIdAndUpdate(sub.organizationId, { status: 'EXPIRED' });
      expiredCount++;
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[Job: SubscriptionLifecycleSweep] Completed in ${durationMs}ms (Downgrades applied: ${downgradesApplied}, Expired: ${expiredCount})`
    );
    return { downgradesApplied, expiredCount, scannedCount, durationMs };
  } catch (err) {
    console.error(`[Job: SubscriptionLifecycleSweep] Error: ${err.message}`);
    throw err;
  }
}

module.exports = {
  runSubscriptionLifecycleSweep,
};
