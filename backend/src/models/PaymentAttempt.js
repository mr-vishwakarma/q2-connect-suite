const mongoose = require('mongoose');

/**
 * Payment Attempt Model
 * Tracks individual checkout attempts, modal openings, errors, and cancellations
 * without creating duplicate parent Payment records.
 */
const paymentAttemptSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    providerOrderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    providerPaymentId: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['INITIATED', 'CHECKOUT_OPENED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'],
      default: 'INITIATED',
      index: true,
    },
    failureCode: {
      type: String,
      trim: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

paymentAttemptSchema.index({ paymentId: 1, createdAt: -1 });
paymentAttemptSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('PaymentAttempt', paymentAttemptSchema);
