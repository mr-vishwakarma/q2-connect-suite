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
    // Authoritative Razorpay Subscription State Machine
    status: {
      type: String,
      enum: [
        'CREATED',
        'AUTHENTICATED',
        'ACTIVE',
        'PENDING',
        'HALTED',
        'PAUSED',
        'CANCELLED',
        'COMPLETED',
        'EXPIRED',
        'TRIAL',
        'PAST_DUE',
      ],
      default: 'TRIAL',
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      default: 'MONTHLY',
    },
    // Subscription recurring amount in minor units (paise) and major units (rupees)
    amountPaise: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    // Subscription billing lifecycle timestamps
    startedAt: {
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
    trialEndsAt: {
      type: Date,
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
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
