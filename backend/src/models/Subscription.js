const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: {
      type: String,
      enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'],
      default: 'TRIAL',
    },
    billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date, required: true },
    trialEndsAt: { type: Date },
    usage: {
      studentCount: { type: Number, default: 0 },
      roomCount: { type: Number, default: 0 },
      hostelCount: { type: Number, default: 0 },
      staffCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ organizationId: 1 });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
