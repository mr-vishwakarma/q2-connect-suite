/**
 * Phase 13 — Safe Subscription & Plan Data Reconciliation Script
 *
 * Audits all Organizations, Subscriptions, Plans, Payments, Invoices, VoucherRedemptions,
 * and AuditLogs for:
 *   1. Selected onboarding / payment plan differing from saved Subscription.planId
 *   2. Missing or dangling Plan references on Subscription
 *   3. Unexpected default Starter assignment contradicting payment/voucher/onboarding evidence
 *   4. Missing pricingSnapshot or wrong agreedPriceRupees relative to verified evidence
 *   5. Billing frequency mismatches (e.g. legacy 'ANNUAL' or contradicting payment cycle)
 *   6. Inconsistent dates/status (e.g. ACTIVE/TRIAL past expiry, or missing org subscriptionId backref)
 *
 * Usage:
 *   node backend/src/scripts/reconcile_subscriptions_and_plans.js --dry-run   (default; read-only)
 *   node backend/src/scripts/reconcile_subscriptions_and_plans.js --apply     (applies safe repairs)
 *   node backend/src/scripts/reconcile_subscriptions_and_plans.js --json      (prints JSON report)
 *
 * Safety Guarantees:
 *   - NEVER mutates or deletes Payment, Invoice, LedgerEntry, VoucherRedemption, or Student records.
 *   - Preserves historical agreed pricing snapshots when catalog prices changed later.
 *   - Appends an immutable 'MIGRATION_RECONCILED' audit entry to Subscription.history.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const VoucherRedemption = require('../models/VoucherRedemption');
const AuditLog = require('../models/AuditLog');
const {
  buildPricingSnapshot,
  buildHistoryEntry,
  getPlanPriceForCycle,
  normalizeBillingCycle,
  syncOrganizationFeatures,
} = require('../services/subscriptionLifecycle.service');

function redactMongoUri(uri) {
  if (!uri) return 'unset';
  try {
    const clean = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    return clean;
  } catch {
    return 'configured';
  }
}

function findPlanMatchingAmount(plans, amountRupees, preferredCycle = null) {
  if (!amountRupees || amountRupees <= 0) return null;
  const target = Number(amountRupees);
  const matches = [];
  for (const p of plans) {
    if (Number(p.priceMonthly) === target && (!preferredCycle || preferredCycle === 'MONTHLY')) {
      matches.push({ plan: p, cycle: 'MONTHLY' });
    }
    if (Number(p.priceYearly) === target && (!preferredCycle || preferredCycle === 'YEARLY')) {
      matches.push({ plan: p, cycle: 'YEARLY' });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

async function runReconciliation({ dryRun = true, quiet = false } = {}) {
  const now = new Date();
  const [plans, organizations, subscriptions] = await Promise.all([
    Plan.find().lean(),
    Organization.find({ isDeleted: { $ne: true } }).lean(),
    Subscription.find().lean(),
  ]);

  const planById = new Map(plans.map((p) => [String(p._id), p]));
  const planByCode = new Map(plans.map((p) => [String(p.code || '').toUpperCase(), p]));
  const subByOrgId = new Map(subscriptions.map((s) => [String(s.organizationId), s]));

  const report = {
    mode: dryRun ? 'DRY_RUN' : 'APPLY',
    executedAt: now.toISOString(),
    summary: {
      totalOrganizations: organizations.length,
      totalSubscriptions: subscriptions.length,
      totalPlans: plans.length,
      healthySubscriptions: 0,
      anomaliesDetected: 0,
      orphanOrgsWithoutSubscription: 0,
      reconciledSubscriptions: 0,
      reconciledBackrefs: 0,
      manualReviewRequired: 0,
    },
    anomalies: [],
    appliedChanges: [],
  };

  // Preload financial & audit evidence keyed by organizationId
  const [capturedPayments, completedRedemptions, relevantAudits] = await Promise.all([
    Payment.find({ billingDomain: 'SAAS', status: 'CAPTURED' })
      .sort({ capturedAt: -1, createdAt: -1 })
      .lean(),
    VoucherRedemption.find({ status: 'COMPLETED' })
      .sort({ redeemedAt: -1, createdAt: -1 })
      .lean(),
    AuditLog.find({
      action: {
        $in: [
          'CREATE_ORGANIZATION',
          'SAAS_SUBSCRIPTION_ACTIVATED',
          'SAAS_SUBSCRIPTION_UPGRADED',
          'VOUCHER_REDEEMED_ZERO_PAYABLE',
          'VOUCHER_REDEEMED_PARTIAL',
          'VOUCHER_REDEEMED_TRIAL',
          'SUBSCRIPTION_TRIAL_STARTED',
        ],
      },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const paymentsByOrg = new Map();
  for (const p of capturedPayments) {
    const k = String(p.organizationId);
    if (!paymentsByOrg.has(k)) paymentsByOrg.set(k, []);
    paymentsByOrg.get(k).push(p);
  }

  const redemptionsByOrg = new Map();
  for (const r of completedRedemptions) {
    const k = String(r.organizationId);
    if (!redemptionsByOrg.has(k)) redemptionsByOrg.set(k, []);
    redemptionsByOrg.get(k).push(r);
  }

  const auditsByOrg = new Map();
  for (const a of relevantAudits) {
    if (!a.organizationId) continue;
    const k = String(a.organizationId);
    if (!auditsByOrg.has(k)) auditsByOrg.set(k, []);
    auditsByOrg.get(k).push(a);
  }

  for (const org of organizations) {
    const orgIdStr = String(org._id);
    const sub = subByOrgId.get(orgIdStr);

    if (!sub) {
      report.summary.orphanOrgsWithoutSubscription++;
      report.summary.manualReviewRequired++;
      report.anomalies.push({
        organizationId: orgIdStr,
        organizationName: org.name,
        subscriptionId: null,
        categories: ['ORPHAN_ORG_WITHOUT_SUBSCRIPTION'],
        details: 'Organization has no Subscription document. Refusing to guess Starter; assign an explicit plan via Super Admin.',
        canAutoReconcile: false,
      });
      continue;
    }

    const categories = [];
    const proposedPatch = {};
    const evidenceNotes = [];

    const currentPlan = sub.planId ? planById.get(String(sub.planId)) : null;
    const orgPayments = paymentsByOrg.get(orgIdStr) || [];
    const orgRedemptions = redemptionsByOrg.get(orgIdStr) || [];
    const orgAudits = auditsByOrg.get(orgIdStr) || [];

    const latestPayment = orgPayments[0] || null;
    const latestRedemption = orgRedemptions[0] || null;

    // 1. Check Organization.subscriptionId backref
    if (!org.subscriptionId || String(org.subscriptionId) !== String(sub._id)) {
      categories.push('MISSING_ORG_SUBSCRIPTION_BACKREF');
      proposedPatch.orgBackrefId = sub._id;
      evidenceNotes.push(`Organization.subscriptionId (${org.subscriptionId || 'null'}) != Subscription (${sub._id})`);
    }

    // 2. Check missing Plan reference
    if (!currentPlan) {
      categories.push('MISSING_PLAN_REFERENCE');
    }

    // 3. Gather authoritative evidence for plan, billingCycle & agreed price
    let evidencedPlan = null;
    let evidencedCycle = null;
    let evidencedAgreedPrice = null;
    let evidencedSource = null;

    // Combine latest authoritative lifecycle event (CAPTURED Payment vs COMPLETED VoucherRedemption vs newer post-payment Subscription.history transition such as applied scheduled downgrade)
    const latestPayDate = latestPayment ? new Date(latestPayment.capturedAt || latestPayment.createdAt).getTime() : 0;
    const latestRedDate = latestRedemption ? new Date(latestRedemption.redeemedAt || latestRedemption.createdAt).getTime() : 0;

    const AUTHORITATIVE_HIST_EVENTS = new Set([
      'SCHEDULED_DOWNGRADE_APPLIED',
      'PLAN_CHANGED',
      'UPGRADED',
      'VOUCHER_REDEEMED',
      'TRIAL_STARTED',
      'ACTIVATED',
      'MIGRATION_RECONCILED',
    ]);
    let latestHistEvt = null;
    let latestHistDate = 0;
    if (Array.isArray(sub.history) && sub.history.length > 0) {
      const revHistory = [...sub.history].reverse();
      latestHistEvt = revHistory.find(
        (h) => AUTHORITATIVE_HIST_EVENTS.has(h.eventType) && h.toPlanId && planById.get(String(h.toPlanId))
      ) || null;
      if (latestHistEvt) {
        latestHistDate = new Date(latestHistEvt.occurredAt || latestHistEvt.createdAt || 0).getTime();
      }
    }

    const latestFinancialTs = Math.max(latestPayDate, latestRedDate);
    if (latestHistEvt && latestHistDate > latestFinancialTs) {
      evidencedPlan = planById.get(String(latestHistEvt.toPlanId));
      evidencedCycle = latestHistEvt.billingCycle || null;
      evidencedAgreedPrice =
        latestHistEvt.amountRupees !== undefined && latestHistEvt.amountRupees !== null
          ? Number(latestHistEvt.amountRupees)
          : getPlanPriceForCycle(evidencedPlan, evidencedCycle || sub.billingCycle || 'MONTHLY');
      evidencedSource = `SubscriptionHistory:${latestHistEvt.eventType}`;
    } else if (latestPayDate >= latestRedDate && latestPayment) {
      const pPlan = latestPayment.planId ? planById.get(String(latestPayment.planId)) : null;
      if (pPlan) {
        evidencedPlan = pPlan;
        evidencedCycle = latestPayment.billingCycle || latestPayment.planSnapshot?.billingCycle || null;
        evidencedAgreedPrice =
          latestPayment.planSnapshot?.agreedPriceRupees ??
          (latestPayment.discountRupees > 0
            ? latestPayment.amountRupees + latestPayment.discountRupees
            : latestPayment.amountRupees);
        evidencedSource = `Payment:${latestPayment.paymentId || latestPayment.orderId}`;
      } else if (latestPayment.amountRupees > 0) {
        const matched = findPlanMatchingAmount(plans, latestPayment.amountRupees, latestPayment.billingCycle);
        if (matched) {
          evidencedPlan = matched.plan;
          evidencedCycle = matched.cycle;
          evidencedAgreedPrice = latestPayment.amountRupees;
          evidencedSource = `PaymentAmountMatch:₹${latestPayment.amountRupees}`;
        }
      }
    } else if (latestRedemption) {
      const rPlan = latestRedemption.planId ? planById.get(String(latestRedemption.planId)) : null;
      if (rPlan) {
        evidencedPlan = rPlan;
        evidencedCycle = latestRedemption.billingCycle || null;
        evidencedAgreedPrice = latestRedemption.originalAmountRupees;
        evidencedSource = `VoucherRedemption:${latestRedemption._id}`;
      }
    }

    // Fallback evidence from Subscription.history or AuditLog or pricingSnapshot (e.g. pending/trial onboarding)
    if (!evidencedPlan && Array.isArray(sub.history) && sub.history.length > 0) {
      const revHistory = [...sub.history].reverse();
      const latestPlanEvt = revHistory.find((h) => h.toPlanId && planById.get(String(h.toPlanId)));
      if (latestPlanEvt) {
        evidencedPlan = planById.get(String(latestPlanEvt.toPlanId));
        evidencedCycle = latestPlanEvt.billingCycle || null;
        evidencedAgreedPrice =
          latestPlanEvt.amountRupees > 0
            ? latestPlanEvt.amountRupees
            : getPlanPriceForCycle(evidencedPlan, evidencedCycle || sub.billingCycle || 'MONTHLY');
        evidencedSource = `SubscriptionHistory:${latestPlanEvt.eventType}`;
      }
    }

    if (!evidencedPlan && orgAudits.length > 0) {
      for (const a of orgAudits) {
        const candidatePlanId = a.newValue?.planId;
        const candidatePlanCode = a.newValue?.planCode;
        const matchedPlan =
          (candidatePlanId && planById.get(String(candidatePlanId))) ||
          (candidatePlanCode && planByCode.get(String(candidatePlanCode).toUpperCase()));
        if (matchedPlan) {
          evidencedPlan = matchedPlan;
          evidencedCycle = a.newValue?.billingCycle || null;
          evidencedAgreedPrice =
            a.newValue?.agreedPriceRupees ?? a.newValue?.amountRupees ?? getPlanPriceForCycle(matchedPlan, evidencedCycle || 'MONTHLY');
          evidencedSource = `AuditLog:${a.action}`;
          break;
        }
      }
    }

    if (!evidencedPlan && sub.pricingSnapshot?.planCode) {
      const snapPlan =
        (sub.pricingSnapshot.planId && planById.get(String(sub.pricingSnapshot.planId))) ||
        planByCode.get(String(sub.pricingSnapshot.planCode).toUpperCase());
      if (snapPlan) {
        evidencedPlan = snapPlan;
        evidencedCycle = sub.pricingSnapshot.billingCycle || null;
        evidencedAgreedPrice = sub.pricingSnapshot.agreedPriceRupees;
        evidencedSource = 'PricingSnapshot';
      }
    }

    // Check Plan mismatch / Unexpected Starter
    if (evidencedPlan && (!currentPlan || String(evidencedPlan._id) !== String(currentPlan._id))) {
      if (currentPlan?.code === 'STARTER' && evidencedPlan.code !== 'STARTER') {
        categories.push('UNEXPECTED_DEFAULT_STARTER');
      } else {
        categories.push('ONBOARDING_PLAN_MISMATCH');
      }
      proposedPatch.planId = evidencedPlan._id;
      proposedPatch.repairedPlan = evidencedPlan;
      evidenceNotes.push(
        `${evidencedSource} indicates plan '${evidencedPlan.name}' (${evidencedPlan.code}), but Subscription references '${currentPlan?.name || 'MISSING'}'`
      );
    }

    // Detect payment amount mismatch even if planId had been guessed Starter
    if (
      latestPayment &&
      latestPayment.amountRupees > 0 &&
      latestPayment.discountRupees === 0 &&
      latestPayment.intent !== 'UPGRADE' &&
      !evidencedPlan &&
      currentPlan
    ) {
      const expectedForCycle = getPlanPriceForCycle(currentPlan, sub.billingCycle || 'MONTHLY');
      if (latestPayment.amountRupees !== expectedForCycle) {
        const matched = findPlanMatchingAmount(plans, latestPayment.amountRupees);
        if (matched) {
          categories.push(currentPlan.code === 'STARTER' ? 'UNEXPECTED_DEFAULT_STARTER' : 'ONBOARDING_PLAN_MISMATCH');
          proposedPatch.planId = matched.plan._id;
          proposedPatch.repairedPlan = matched.plan;
          proposedPatch.billingCycle = matched.cycle;
          evidencedAgreedPrice = latestPayment.amountRupees;
          evidenceNotes.push(
            `Captured payment of ₹${latestPayment.amountRupees} uniquely matches '${matched.plan.name}' (${matched.cycle})`
          );
        }
      }
    }

    // 4. Billing cycle check (including legacy 'ANNUAL')
    const rawCycle = String(sub.billingCycle || '').toUpperCase().trim();
    const targetCycle = normalizeBillingCycle(evidencedCycle || rawCycle || 'MONTHLY', { strict: false });
    if (rawCycle === 'ANNUAL' || !rawCycle || (evidencedCycle && normalizeBillingCycle(evidencedCycle, { strict: false }) !== rawCycle)) {
      categories.push('BILLING_CYCLE_MISMATCH');
      proposedPatch.billingCycle = targetCycle;
      evidenceNotes.push(`Billing cycle '${sub.billingCycle || 'unset'}' -> '${targetCycle}'`);
    }

    const effectivePlan = proposedPatch.repairedPlan || currentPlan || evidencedPlan;

    // 5. Agreed price & pricingSnapshot check
    // Note: Preserve historical agreedPriceRupees when snapshot already agrees cleanly (never overwrite grandfathered prices with new catalog prices!)
    const targetCatalogPrice = effectivePlan ? getPlanPriceForCycle(effectivePlan, targetCycle) : null;
    const expectedAgreed =
      proposedPatch.planId
        ? evidencedAgreedPrice ?? targetCatalogPrice
        : sub.pricingSnapshot?.agreedPriceRupees ??
          evidencedAgreedPrice ??
          sub.agreedPriceRupees ??
          targetCatalogPrice;

    if (!sub.pricingSnapshot || !sub.pricingSnapshot.planName) {
      categories.push('PRICE_OR_SNAPSHOT_MISMATCH');
      proposedPatch.rebuildSnapshot = true;
      proposedPatch.agreedPriceRupees = expectedAgreed;
      evidenceNotes.push('Missing pricingSnapshot; will backfill from historical plan & price evidence.');
    } else if (
      proposedPatch.planId ||
      sub.agreedPriceRupees === undefined ||
      sub.agreedPriceRupees === null ||
      (sub.pricingSnapshot?.agreedPriceRupees !== undefined &&
        sub.agreedPriceRupees !== sub.pricingSnapshot.agreedPriceRupees)
    ) {
      categories.push('PRICE_OR_SNAPSHOT_MISMATCH');
      proposedPatch.rebuildSnapshot = true;
      proposedPatch.agreedPriceRupees = expectedAgreed;
      evidenceNotes.push(
        `agreedPriceRupees (${sub.agreedPriceRupees ?? 'unset'}) / snapshot synced to ₹${expectedAgreed}`
      );
    } else if (
      !(latestHistEvt && latestHistDate > latestFinancialTs) &&
      latestPayment &&
      latestPayment.status === 'CAPTURED' &&
      !latestPayment.discountRupees &&
      latestPayment.intent !== 'UPGRADE' &&
      latestPayment.intent !== 'PARTIAL_VOUCHER' &&
      latestPayment.amountRupees > 0 &&
      Number(sub.pricingSnapshot.agreedPriceRupees) !== Number(latestPayment.amountRupees) &&
      Number(latestPayment.amountRupees) === Number(targetCatalogPrice)
    ) {
      categories.push('PRICE_OR_SNAPSHOT_MISMATCH');
      proposedPatch.rebuildSnapshot = true;
      proposedPatch.agreedPriceRupees = Number(latestPayment.amountRupees);
      evidenceNotes.push(
        `Displayed price mismatch: snapshot shows ₹${sub.pricingSnapshot.agreedPriceRupees} while non-discounted payment was ₹${latestPayment.amountRupees}`
      );
    }

    // 6. Dates & Status consistency
    const expiryDate =
      sub.status === 'TRIAL' && sub.trialEndsAt
        ? new Date(sub.trialEndsAt)
        : sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd)
        : null;

    if ((sub.status === 'ACTIVE' || sub.status === 'TRIAL') && expiryDate && expiryDate < now) {
      categories.push('INCONSISTENT_DATES_OR_STATUS');
      proposedPatch.markExpired = true;
      evidenceNotes.push(`Subscription status is '${sub.status}' despite expiry at ${expiryDate.toISOString()}`);
    } else if (
      sub.currentPeriodStart &&
      sub.currentPeriodEnd &&
      new Date(sub.currentPeriodStart) > new Date(sub.currentPeriodEnd)
    ) {
      categories.push('INCONSISTENT_DATES_OR_STATUS');
      evidenceNotes.push('currentPeriodStart is later than currentPeriodEnd; manual review recommended.');
    }

    if (categories.length === 0) {
      report.summary.healthySubscriptions++;
      continue;
    }

    report.summary.anomaliesDetected++;
    const canAutoReconcile = Boolean(effectivePlan) && Object.keys(proposedPatch).length > 0;
    if (!canAutoReconcile) {
      report.summary.manualReviewRequired++;
    }

    report.anomalies.push({
      organizationId: orgIdStr,
      organizationName: org.name,
      subscriptionId: String(sub._id),
      currentStatus: sub.status,
      currentPlan: currentPlan ? { id: String(currentPlan._id), name: currentPlan.name, code: currentPlan.code } : null,
      currentAgreedPriceRupees: sub.agreedPriceRupees ?? sub.pricingSnapshot?.agreedPriceRupees ?? sub.amount ?? null,
      categories: [...new Set(categories)],
      evidenceNotes,
      proposedReconciliation: canAutoReconcile
        ? {
            planId: proposedPatch.planId ? String(proposedPatch.planId) : undefined,
            planName: effectivePlan?.name,
            billingCycle: proposedPatch.billingCycle || targetCycle,
            agreedPriceRupees: proposedPatch.agreedPriceRupees,
            rebuildSnapshot: Boolean(proposedPatch.rebuildSnapshot),
            markExpired: Boolean(proposedPatch.markExpired),
            fixOrgBackref: Boolean(proposedPatch.orgBackrefId),
          }
        : null,
      canAutoReconcile,
    });

    if (!dryRun && canAutoReconcile) {
      const subDoc = await Subscription.findById(sub._id);
      if (!subDoc) continue;

      let subModified = false;
      const fromPlanId = subDoc.planId;
      const fromPlanName = currentPlan?.name || subDoc.pricingSnapshot?.planName || 'Unknown';
      const fromStatus = subDoc.status;

      if (proposedPatch.planId) {
        subDoc.planId = proposedPatch.planId;
        subModified = true;
      }
      if (proposedPatch.billingCycle) {
        subDoc.billingCycle = proposedPatch.billingCycle;
        subModified = true;
      }
      if (proposedPatch.rebuildSnapshot && effectivePlan) {
        const agreedPrice = Number(
          proposedPatch.agreedPriceRupees ?? getPlanPriceForCycle(effectivePlan, targetCycle)
        );
        subDoc.agreedPriceRupees = agreedPrice;
        subDoc.pricingSnapshot = buildPricingSnapshot({
          plan: effectivePlan,
          billingCycle: targetCycle,
          agreedPriceRupees: agreedPrice,
          finalPayableRupees:
            subDoc.status === 'TRIAL'
              ? agreedPrice
              : subDoc.amount !== undefined && subDoc.amount !== null && !proposedPatch.planId
              ? subDoc.amount
              : agreedPrice,
          source: 'MIGRATION_RECONCILIATION',
        });
        // Preserve snapshot capture date as subscription creation date when reconstructing missing snapshot
        if (subDoc.createdAt) {
          subDoc.pricingSnapshot.capturedAt = subDoc.createdAt;
        }
        subModified = true;
      }
      if (proposedPatch.markExpired) {
        subDoc.status = 'EXPIRED';
        subModified = true;
      }

      if (subModified) {
        subDoc.history = subDoc.history || [];
        subDoc.history.push(
          buildHistoryEntry({
            eventType: 'MIGRATION_RECONCILED',
            fromStatus,
            toStatus: subDoc.status,
            fromPlanId,
            fromPlanName,
            toPlanId: subDoc.planId,
            toPlanName: effectivePlan?.name,
            billingCycle: subDoc.billingCycle,
            amountRupees: subDoc.agreedPriceRupees,
            activationMethod: subDoc.activationMethod,
            notes: `Safe reconciliation: ${evidenceNotes.join('; ')}`,
          })
        );
        await subDoc.save();
        report.summary.reconciledSubscriptions++;

        if (proposedPatch.planId && effectivePlan) {
          await syncOrganizationFeatures(org._id, effectivePlan.includedFeatures || [], {
            enabled: ['ACTIVE', 'TRIAL'].includes(subDoc.status),
          });
        }
      }

      const orgUpdates = {};
      if (proposedPatch.orgBackrefId) {
        orgUpdates.subscriptionId = subDoc._id;
        report.summary.reconciledBackrefs++;
      }
      if (proposedPatch.markExpired && org.status !== 'EXPIRED') {
        orgUpdates.status = 'EXPIRED';
      }
      if (Object.keys(orgUpdates).length > 0) {
        await Organization.findByIdAndUpdate(org._id, { $set: orgUpdates });
      }

      report.appliedChanges.push({
        organizationId: orgIdStr,
        organizationName: org.name,
        subscriptionId: String(subDoc._id),
        appliedCategories: [...new Set(categories)],
      });
    }
  }

  if (!quiet) {
    console.log('\n============================================================');
    console.log(`📊 HOSTELIQ SUBSCRIPTION RECONCILIATION REPORT (${report.mode})`);
    console.log('============================================================');
    console.log(`Organizations audited : ${report.summary.totalOrganizations}`);
    console.log(`Subscriptions audited : ${report.summary.totalSubscriptions}`);
    console.log(`Healthy subscriptions : ${report.summary.healthySubscriptions}`);
    console.log(`Anomalies detected    : ${report.summary.anomaliesDetected}`);
    console.log(`Orphan organizations  : ${report.summary.orphanOrgsWithoutSubscription}`);
    console.log(`Manual review needed  : ${report.summary.manualReviewRequired}`);
    if (!dryRun) {
      console.log(`Reconciled subs       : ${report.summary.reconciledSubscriptions}`);
      console.log(`Fixed org backrefs    : ${report.summary.reconciledBackrefs}`);
    }
    if (report.anomalies.length > 0) {
      console.log('\nDetailed Findings:');
      for (const a of report.anomalies) {
        console.log(
          ` - [${a.categories.join(', ')}] ${a.organizationName} (${a.organizationId}): ${a.evidenceNotes?.join(' | ') || a.details}`
        );
      }
    }
    console.log('============================================================\n');
  }

  return report;
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const jsonOnly = args.includes('--json');
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is required.');
      process.exit(1);
    }

    if (!jsonOnly) {
      console.log(`Connecting to MongoDB (${redactMongoUri(mongoUri)})...`);
    }

    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
      const report = await runReconciliation({ dryRun: !apply, quiet: jsonOnly });
      if (jsonOnly) {
        console.log(JSON.stringify(report, null, 2));
      }
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('❌ Reconciliation failed:', err.message);
      try {
        await mongoose.disconnect();
      } catch {}
      process.exit(1);
    }
  })();
}

module.exports = { runReconciliation };
