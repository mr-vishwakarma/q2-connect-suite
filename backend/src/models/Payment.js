const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    feeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fee',
      required: true,
      index: true,
    },
    // Exact monetary representation in integer minor-unit (paise) to prevent floating point inaccuracies
    amountPaise: {
      type: Number,
      required: true,
    },
    // Human-readable amount in Rupees
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
    provider: {
      type: String,
      enum: ['RAZORPAY', 'MANUAL'],
      default: 'RAZORPAY',
      index: true,
    },
    // Provider Order Identifier (e.g. order_Q2_xyz)
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    // Provider Payment Identifier (e.g. pay_xyz)
    paymentId: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      index: true,
    },
    signature: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'],
      default: 'CREATED',
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: 'online',
    },
    notes: {
      type: String,
      trim: true,
    },
    failureCode: {
      type: String,
      trim: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    receiptNo: {
      type: String,
      trim: true,
    },
    capturedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    refundId: {
      type: String,
      trim: true,
    },
    refundedAmountPaise: {
      type: Number,
      default: 0,
    },
    refundedAmountRupees: {
      type: Number,
      default: 0,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for tenant isolation, reporting, and reconciliation
paymentSchema.index({ organizationId: 1, createdAt: -1 });
paymentSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ studentId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ feeId: 1, status: 1 });
paymentSchema.index({ provider: 1, orderId: 1 });
paymentSchema.index({ provider: 1, paymentId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
