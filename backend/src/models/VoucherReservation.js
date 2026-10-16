const mongoose = require('mongoose');

/**
 * VoucherReservation Model (Phase H - Super Admin Subscription Vouchers)
 * 
 * Manages short-lived checkout claims during partial-discount payment flows
 * to prevent concurrent over-redemption beyond configured limits.
 */
const voucherReservationSchema = new mongoose.Schema(
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
    checkoutSessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
    status: {
      type: String,
      enum: ['HELD', 'COMMITTED', 'RELEASED', 'EXPIRED'],
      default: 'HELD',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    heldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index to automatically prune stale reservations after expiry
voucherReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
voucherReservationSchema.index({ voucherId: 1, status: 1 });

module.exports = mongoose.model('VoucherReservation', voucherReservationSchema);
