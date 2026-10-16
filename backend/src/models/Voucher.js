const mongoose = require('mongoose');

/**
 * Voucher Model (Phase H - Super Admin Subscription Vouchers)
 * 
 * Rules & Security:
 * - Code lookup via HMAC-SHA256 digest with dedicated VOUCHER_LOOKUP_SECRET
 * - Raw code is NEVER stored in database
 * - Masked code format (e.g. Q2M7-****-****-R6TZ) stored for administrative reference
 * - PIN verifier stored as scrypt hash with cryptographic salt and server pepper
 * - Raw PIN is NEVER stored, logged, or recoverable
 * - Database-enforced uniqueness on codeDigest and reference
 * - Strict lifecycle: DRAFT, ACTIVE, SUSPENDED, EXPIRED, EXHAUSTED, REVOKED
 */
const voucherSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Keyed HMAC-SHA256 digest of normalized 16-character code
    codeDigest: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Safe masked representation for Super Admin UI display (e.g. Q2M7-****-****-R6TZ)
    codeMasked: {
      type: String,
      required: true,
    },
    // Salted scrypt verifier for 6-digit PIN
    pinVerifier: {
      type: String,
      required: true,
    },
    pinSalt: {
      type: String,
      required: true,
    },
    // Fixed discount in INR
    discountAmountRupees: {
      type: Number,
      required: true,
      min: [1, 'Discount amount must be at least 1 INR'],
    },
    // Eligible SaaS Plans (empty array means all active plans are eligible)
    eligiblePlans: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
      },
    ],
    // Eligible Billing Intervals (empty means both MONTHLY and YEARLY)
    eligibleBillingIntervals: [
      {
        type: String,
        enum: ['MONTHLY', 'YEARLY'],
      },
    ],
    validFrom: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    // Global redemption limit across all organizations
    globalRedemptionLimit: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'Global redemption limit must be at least 1'],
    },
    // Number of completed redemptions
    currentRedemptionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Maximum redemptions per organization (business default = 1)
    maxRedemptionsPerOrg: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'Maximum redemptions per organization must be at least 1'],
    },
    // Organization targeting scope
    scope: {
      type: String,
      enum: ['GLOBAL', 'SPECIFIC_ORGANIZATION', 'SELECTED_ORGANIZATIONS'],
      default: 'GLOBAL',
      index: true,
    },
    restrictedToOrgIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
      },
    ],
    // Subscription eligibility: ALL, NEW_SUBSCRIPTIONS_ONLY, EXISTING_SUBSCRIPTIONS_ONLY
    subscriptionEligibility: {
      type: String,
      enum: ['ALL', 'NEW_SUBSCRIPTIONS_ONLY', 'EXISTING_SUBSCRIPTIONS_ONLY'],
      default: 'ALL',
    },
    // Number of billing cycles discount applies to (default: 1)
    discountDurationCycles: {
      type: Number,
      default: 1,
      min: 1,
    },
    // Optional minimum eligible subscription amount
    minSubscriptionAmountRupees: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Authoritative status lifecycle
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'EXHAUSTED', 'REVOKED'],
      default: 'ACTIVE',
      index: true,
    },
    internalNotes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Anti-Brute-Force & PIN rate limiting
    failedPinAttempts: {
      type: Number,
      default: 0,
    },
    pinLockedUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Effective status calculator taking time and redemption count into account
voucherSchema.methods.getEffectiveStatus = function (now = new Date()) {
  if (this.status === 'REVOKED') return 'REVOKED';
  if (this.status === 'SUSPENDED') return 'SUSPENDED';
  if (this.status === 'DRAFT') return 'DRAFT';
  if (this.expiresAt && now > this.expiresAt) return 'EXPIRED';
  if (this.currentRedemptionCount >= this.globalRedemptionLimit) return 'EXHAUSTED';
  return this.status;
};

// Check if voucher is eligible for validation/redemption
voucherSchema.methods.isEligibleForRedemption = function (now = new Date()) {
  const effectiveStatus = this.getEffectiveStatus(now);
  if (effectiveStatus !== 'ACTIVE') {
    return {
      eligible: false,
      reason: `Voucher is currently ${effectiveStatus.toLowerCase()}`,
    };
  }
  if (this.validFrom && now < this.validFrom) {
    return {
      eligible: false,
      reason: 'Voucher validity period has not started yet',
    };
  }
  if (this.pinLockedUntil && now < this.pinLockedUntil) {
    return {
      eligible: false,
      reason: 'Voucher is temporarily locked due to excessive failed attempts',
    };
  }
  return { eligible: true };
};

// Compound indexes for administrative queries and status filtering
voucherSchema.index({ status: 1, expiresAt: 1 });
voucherSchema.index({ scope: 1, restrictedToOrgIds: 1 });
voucherSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Voucher', voucherSchema);
