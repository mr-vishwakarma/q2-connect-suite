const mongoose = require('mongoose');

/**
 * VoucherRedemption Model (Phase H - Super Admin Subscription Vouchers)
 * 
 * Immutable record of completed or pending voucher redemptions.
 * Preserves the exact financial state at redemption time so later plan
 * price changes cannot alter historical accounting.
 */
const voucherRedemptionSchema = new mongoose.Schema(
  {
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      required: true,
    },
    // Financial Snapshot at redemption time
    originalAmountRupees: {
      type: Number,
      required: true,
    },
    discountAmountRupees: {
      type: Number,
      required: true,
    },
    finalPayableRupees: {
      type: Number,
      required: true,
    },
    isZeroPayable: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
    // Unique key ensuring atomic idempotency per redemption attempt
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    redeemedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    discountCyclesGranted: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// Compound indexes for tenant queries, per-org limit checks, and reporting
voucherRedemptionSchema.index({ voucherId: 1, organizationId: 1 });
voucherRedemptionSchema.index({ organizationId: 1, createdAt: -1 });
voucherRedemptionSchema.index({ voucherId: 1, status: 1 });
voucherRedemptionSchema.index({ redeemedAt: -1 });

module.exports = mongoose.model('VoucherRedemption', voucherRedemptionSchema);
