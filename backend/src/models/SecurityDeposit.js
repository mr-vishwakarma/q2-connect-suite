const mongoose = require('mongoose');

const securityDepositSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    hostel: { type: String, trim: true, default: 'Q2', required: true },
    amount: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank'] },
    status: { type: String, enum: ['held', 'refunded', 'forfeited'], default: 'held' },
    collectedDate: { type: Date },
    refundDate: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

securityDepositSchema.index({ organizationId: 1, studentId: 1 });
securityDepositSchema.index({ organizationId: 1, status: 1 });
securityDepositSchema.index({ studentId: 1 });

module.exports = mongoose.model('SecurityDeposit', securityDepositSchema);
