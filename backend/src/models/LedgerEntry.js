const mongoose = require('mongoose');

/**
 * Immutable Financial Ledger Entry
 * Follows double-entry and audit principles.
 * Entries cannot be deleted or mutated after creation; corrections require reversing entries.
 */
const ledgerEntrySchema = new mongoose.Schema(
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
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      index: true,
    },
    feeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fee',
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
    },
    // Exact monetary representation in integer minor-units (paise)
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
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['DEBIT', 'CREDIT'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['ONLINE_PAYMENT', 'MANUAL_PAYMENT', 'REFUND', 'ADJUSTMENT', 'WAIVER', 'REVERSAL', 'SAAS_SUBSCRIPTION'],
      required: true,
      index: true,
    },
    externalReference: {
      type: String,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable: no updatedAt
  }
);

// Compound indexes for high-volume reconciliation and tenant queries
ledgerEntrySchema.index({ organizationId: 1, createdAt: -1 });
ledgerEntrySchema.index({ organizationId: 1, source: 1, createdAt: -1 });
ledgerEntrySchema.index({ paymentId: 1, type: 1 });
ledgerEntrySchema.index({ feeId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
