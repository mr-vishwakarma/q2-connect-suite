const mongoose = require('mongoose');

const feePaymentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
    feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminName: { type: String },
    hostel: { type: String, trim: true, default: 'Q2', required: true },
    month: { type: String, required: true },
    amount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank'], required: true },
    paymentDate: { type: Date, default: Date.now },
    receiptNo: { type: String, required: true },
    receiptUrl: { type: String },
    notes: { type: String },
    idempotencyKey: { type: String, sparse: true, index: true },
  },
  { timestamps: true }
);

feePaymentSchema.index({ organizationId: 1, receiptNo: 1 });
feePaymentSchema.index({ organizationId: 1, paymentDate: -1 });
feePaymentSchema.index({ organizationId: 1, studentId: 1 });
feePaymentSchema.index({ studentId: 1 });
feePaymentSchema.index({ hostel: 1 });
feePaymentSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('FeePayment', feePaymentSchema);
