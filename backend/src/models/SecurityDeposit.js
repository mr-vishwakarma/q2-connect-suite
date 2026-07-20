const mongoose = require('mongoose');

const securityDepositSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'], required: true },
    amount: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank'] },
    status: { type: String, enum: ['held', 'refunded', 'forfeited'], default: 'held' },
    collectedDate: { type: Date },
    refundDate: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SecurityDeposit', securityDepositSchema);
