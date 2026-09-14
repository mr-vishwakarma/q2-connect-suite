const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
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
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      unique: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    feeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fee',
      index: true,
    },
    // Human-facing sequential invoice number, e.g. Q2-INV-2026-000001
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    invoiceType: {
      type: String,
      enum: ['FEE_RECEIPT', 'SAAS_INVOICE'],
      default: 'FEE_RECEIPT',
      index: true,
    },
    subtotalRupees: {
      type: Number,
      required: true,
      default: 0,
    },
    taxRupees: {
      type: Number,
      default: 0,
    },
    totalRupees: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['ISSUED', 'PAID', 'VOID', 'REFUNDED'],
      default: 'PAID',
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    pdfUrl: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ organizationId: 1, issuedAt: -1 });
invoiceSchema.index({ studentId: 1, issuedAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
