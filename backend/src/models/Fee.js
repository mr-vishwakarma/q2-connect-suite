const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'] },
    month: { type: String, required: true }, // e.g., "2024-01"
    amount: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['paid', 'unpaid', 'partial'], default: 'unpaid' },
    dueDate: { type: Date },
    paidDate: { type: Date },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank'], default: null },
    receiptNo: { type: String, trim: true },
    notes: { type: String },
  },
  { timestamps: true }
);

// Unique: one fee record per student per month
feeSchema.index({ studentId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Fee', feeSchema);
