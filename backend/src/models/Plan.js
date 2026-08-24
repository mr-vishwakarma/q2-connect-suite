const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    priceMonthly: { type: Number, required: true, default: 0 },
    priceYearly: { type: Number, required: true, default: 0 },
    limits: {
      maxStudents: { type: Number, default: 100 },
      maxRooms: { type: Number, default: 50 },
      maxHostels: { type: Number, default: 1 },
      maxStaff: { type: Number, default: 5 },
      storageGb: { type: Number, default: 5 },
    },
    includedFeatures: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
