const mongoose = require('mongoose');

const feePaymentSchema = new mongoose.Schema(
  {
    feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminName: { type: String },
    hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'], required: true },
    month: { type: String, required: true },
    amount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank'], required: true },
    paymentDate: { type: Date, default: Date.now },
    receiptNo: { type: String, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeePayment', feePaymentSchema);
