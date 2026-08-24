const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', default: null },
    hostel: { type: String, trim: true },
    category: {
      type: String,
      enum: ['ELECTRICITY', 'WATER', 'FOOD', 'MAINTENANCE', 'SALARY', 'INTERNET', 'CLEANING', 'OTHER'],
      required: true,
    },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    vendor: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    receiptUrl: { type: String },
    paymentMode: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD'],
      default: 'UPI',
    },
    status: { type: String, enum: ['PAID', 'PENDING'], default: 'PAID' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

expenseSchema.index({ organizationId: 1, date: -1 });
expenseSchema.index({ organizationId: 1, hostelId: 1, date: -1 });
expenseSchema.index({ organizationId: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
