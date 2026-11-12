const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    priceMonthly: { type: Number, required: true, default: 0 },
    priceYearly: { type: Number, required: true, default: 0 },
    limits: {
      maxStudents: { type: Number, default: 0 }, // 0 or null denotes unlimited students
      maxRooms: { type: Number, default: 50 },
      maxHostels: { type: Number, default: 1 },
      maxStaff: { type: Number, default: 5 },
      storageGb: { type: Number, default: 5 },
    },
    includedFeatures: [{ type: String }],
    allowedBillingCycles: {
      type: [{ type: String, enum: ['MONTHLY', 'YEARLY'] }],
      default: ['MONTHLY', 'YEARLY'],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'At least one billing frequency (MONTHLY or YEARLY) must be enabled for a plan',
      },
    },
    trialEligible: { type: Boolean, default: true },
    trialDays: { type: Number, default: 14, min: 0 },
    sortOrder: { type: Number, default: 0 },
    version: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    currency: { type: String, default: 'INR', uppercase: true },
    razorpayPlanIdMonthly: { type: String, trim: true, sparse: true },
    razorpayPlanIdYearly: { type: String, trim: true, sparse: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

planSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.isActive = this.status === 'ACTIVE';
  } else if (this.isModified('isActive')) {
    if (!this.isActive && this.status === 'ACTIVE') {
      this.status = 'INACTIVE';
    } else if (this.isActive && this.status === 'INACTIVE') {
      this.status = 'ACTIVE';
    }
  }
  next();
});

planSchema.index({ status: 1, isActive: 1, sortOrder: 1, priceMonthly: 1 });

module.exports = mongoose.model('Plan', planSchema);
