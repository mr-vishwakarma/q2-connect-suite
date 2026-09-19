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
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    currency: { type: String, default: 'INR', uppercase: true },
    razorpayPlanIdMonthly: { type: String, trim: true, sparse: true },
    razorpayPlanIdYearly: { type: String, trim: true, sparse: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
