const mongoose = require('mongoose');

/**
 * Subscription Domain Model (Phase F/G Reconciliation)
 * 
 * Represents an Organization's recurring SaaS subscription to Q2 Connect Suite.
 * Fully synchronized with the Razorpay Subscriptions state machine.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    // Reference to internal Q2 Plan
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
      index: true,
    },
    // Razorpay Plan Identifier (e.g. plan_NXYZ123)
    razorpayPlanId: {
      type: String,
      trim: true,
      sparse: true,
    },
    // Razorpay Subscription Identifier (e.g. sub_ABC123)
    razorpaySubscriptionId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    // Authoritative Subscription State Machine
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'CREATED',
        'AUTHENTICATED',
        'ACTIVE',
        'PENDING',
        'PAYMENT_FAILED',
        'HALTED',
        'PAUSED',
        'CANCELLED',
        'COMPLETED',
        'EXPIRED',
        'TRIAL',
        'PAST_DUE',
        'SUSPENDED',
      ],
      default: 'TRIAL',
      index: true,
    },
    activationMethod: {
      type: String,
      enum: ['ONLINE_PAYMENT', 'VOUCHER', 'FREE_TRIAL', 'MANUAL_ADMIN', 'PENDING'],
      default: 'PENDING',
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      default: 'MONTHLY',
    },
    // Manual renewal lifecycle (automatic recurring billing disabled by default)
    renewalMode: {
      type: String,
      enum: ['MANUAL', 'AUTOMATIC'],
      default: 'MANUAL',
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    orderId: {
      type: String,
      trim: true,
      sparse: true,
    },
    voucherRedemptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VoucherRedemption',
    },
    lastVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
    },
    lastVoucherReference: {
      type: String,
      trim: true,
    },
    // Subscription plan amount in minor units (paise) and major units (rupees)
    amountPaise: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      default: 0,
    },
    // Authoritative agreed contract price before one-time coupon discounts
    agreedPriceRupees: {
      type: Number,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    // Immutable commercial terms snapshot captured at subscription creation/activation/upgrade
    pricingSnapshot: {
      type: new mongoose.Schema(
        {
          planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
          planCode: { type: String, trim: true, uppercase: true },
          planName: { type: String, trim: true },
          planDescription: { type: String, trim: true },
          planVersion: { type: Number, default: 1 },
          billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'] },
          agreedPriceRupees: { type: Number, default: 0 },
          agreedPricePaise: { type: Number, default: 0 },
          finalPayableRupees: { type: Number, default: 0 },
          monthlyPriceAtPurchase: { type: Number, default: 0 },
          yearlyPriceAtPurchase: { type: Number, default: 0 },
          currency: { type: String, default: 'INR', uppercase: true },
          taxRatePercent: { type: Number, default: 0 },
          taxAmountRupees: { type: Number, default: 0 },
          trialEligible: { type: Boolean, default: true },
          trialDays: { type: Number, default: 14 },
          limits: {
            maxStudents: { type: Number, default: 0 },
            maxRooms: { type: Number, default: 50 },
            maxHostels: { type: Number, default: 1 },
            maxStaff: { type: Number, default: 5 },
            storageGb: { type: Number, default: 5 },
          },
          includedFeatures: [{ type: String }],
          capturedAt: { type: Date, default: Date.now },
          source: { type: String, trim: true },
        },
        { _id: false }
      ),
    },
    // Unverified checkout session state (never alters active plan/dates until verified)
    pendingCheckout: {
      type: new mongoose.Schema(
        {
          orderId: { type: String, trim: true },
          intent: {
            type: String,
            enum: ['ACTIVATION', 'RENEWAL', 'UPGRADE', 'REACTIVATION', 'PARTIAL_VOUCHER'],
            default: 'ACTIVATION',
          },
          targetPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
          targetPlanCode: { type: String, trim: true, uppercase: true },
          targetPlanName: { type: String, trim: true },
          targetBillingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'] },
          originalAmountRupees: { type: Number, default: 0 },
          prorationCreditRupees: { type: Number, default: 0 },
          discountAmountRupees: { type: Number, default: 0 },
          finalPayableRupees: { type: Number, default: 0 },
          voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
          voucherReference: { type: String, trim: true },
          status: {
            type: String,
            enum: ['CREATED', 'FAILED', 'CANCELLED', 'COMPLETED'],
            default: 'CREATED',
          },
          failureCode: { type: String, trim: true },
          failureReason: { type: String, trim: true },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
          expiresAt: { type: Date },
        },
        { _id: false }
      ),
    },
    // Scheduled next-cycle downgrade / plan switch
    scheduledPlanChange: {
      type: new mongoose.Schema(
        {
          targetPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
          targetPlanCode: { type: String, trim: true, uppercase: true },
          targetPlanName: { type: String, trim: true },
          targetBillingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'] },
          targetPriceRupees: { type: Number },
          changeType: {
            type: String,
            enum: ['DOWNGRADE', 'PLAN_SWITCH'],
            default: 'DOWNGRADE',
          },
          effectiveDate: { type: Date },
          scheduledAt: { type: Date },
          scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          capacityWarnings: [{ type: String }],
          acknowledgedCapacityWarning: { type: Boolean, default: false },
          status: {
            type: String,
            enum: ['SCHEDULED', 'APPLIED', 'CANCELLED'],
            default: 'SCHEDULED',
          },
        },
        { _id: false }
      ),
    },
    // Subscription billing lifecycle timestamps
    startedAt: {
      type: Date,
    },
    activatedAt: {
      type: Date,
    },
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    nextChargeAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    pausedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    trialStartsAt: {
      type: Date,
    },
    trialEndsAt: {
      type: Date,
    },
    trialUsed: {
      type: Boolean,
      default: false,
    },
    // Cycle counters
    totalCount: {
      type: Number,
      default: 12, // default 12 billing cycles
    },
    paidCount: {
      type: Number,
      default: 0,
    },
    remainingCount: {
      type: Number,
      default: 12,
    },
    // Tenant capacity utilization
    usage: {
      studentCount: { type: Number, default: 0 },
      roomCount: { type: Number, default: 0 },
      hostelCount: { type: Number, default: 0 },
      staffCount: { type: Number, default: 0 },
    },
    // Audit-ready lifecycle history inside subscription document
    history: [
      new mongoose.Schema(
        {
          eventType: { type: String, required: true, trim: true },
          fromStatus: { type: String, trim: true },
          toStatus: { type: String, trim: true },
          fromPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
          fromPlanName: { type: String, trim: true },
          toPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
          toPlanName: { type: String, trim: true },
          billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'] },
          amountRupees: { type: Number },
          activationMethod: { type: String, trim: true },
          paymentId: { type: String, trim: true },
          invoiceNumber: { type: String, trim: true },
          voucherReference: { type: String, trim: true },
          actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          actorEmail: { type: String, trim: true },
          notes: { type: String, trim: true },
          occurredAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
    ],
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ organizationId: 1, status: 1 });
subscriptionSchema.index({ 'pendingCheckout.orderId': 1 }, { sparse: true });
subscriptionSchema.index({ activationMethod: 1, status: 1 });
subscriptionSchema.index(
  { 'scheduledPlanChange.status': 1, 'scheduledPlanChange.effectiveDate': 1 },
  { sparse: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
