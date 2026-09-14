const mongoose = require('mongoose');

/**
 * Refund Model
 * Tracks administrative and automated payment refunds, reason codes, and provider identifiers.
 */
const refundSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    feeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fee',
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    amountPaise: {
      type: Number,
      required: true,
    },
    amountRupees: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    providerRefundId: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['REFUND_REQUESTED', 'REFUNDED', 'REFUND_FAILED'],
      default: 'REFUND_REQUESTED',
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    adminName: {
      type: String,
    },
    failureReason: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

refundSchema.index({ organizationId: 1, createdAt: -1 });
refundSchema.index({ paymentId: 1, status: 1 });

module.exports = mongoose.model('Refund', refundSchema);
