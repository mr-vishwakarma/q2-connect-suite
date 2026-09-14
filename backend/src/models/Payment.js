const mongoose = require('mongoose');

/**
 * Payment Model (Phase F/G Architectural Reconciliation)
 * 
 * Tracks financial transactions with explicit domain separation:
 * - SAAS: Organization SaaS subscription charges, renewals, and plan upgrades
 * - STUDENT_LEGACY: Historical resident fee online records (read-compatibility only)
 */
const paymentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // Domain separation: SAAS billing vs legacy resident records
    billingDomain: {
      type: String,
      enum: ['SAAS', 'STUDENT_LEGACY'],
      default: 'SAAS',
      index: true,
    },
    // SaaS Subscription References
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
    },
    razorpaySubscriptionId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    // Legacy / Hostel Resident References (optional for SaaS)
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
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
    // Provider Order Identifier (e.g. order_Q2_xyz) or Subscription Charge Reference
    orderId: {
      type: String,
      trim: true,
      sparse: true,
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
paymentSchema.index({ organizationId: 1, billingDomain: 1, createdAt: -1 });
paymentSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ subscriptionId: 1, status: 1 });
paymentSchema.index({ studentId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ feeId: 1, status: 1 });
paymentSchema.index({ provider: 1, orderId: 1 });
paymentSchema.index({ provider: 1, paymentId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
