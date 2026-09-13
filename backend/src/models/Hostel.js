const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, trim: true },
    capacity: { type: Number, default: 0 },
    floors: { type: Number, default: 1 },
    totalRooms: { type: Number, default: 10 },
    genderType: { type: String, enum: ['GIRLS', 'BOYS', 'COED'], default: 'GIRLS' },
    amenities: [{ type: String }],
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    wardenName: { type: String, trim: true },
    wardenPhone: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
    settings: {
      lateFeePerDay: { type: Number, default: 20 },
      gracePeriodDays: { type: Number, default: 5 },
      laundrySlotsPerDay: { type: Number, default: 1 },
      monthlyRentDueDay: { type: Number, default: 5 },
      securityDeposit: { type: Number, default: 5000 },
      hasMess: { type: Boolean, default: true },
      messOffNoticeHours: { type: Number, default: 24 },
      messRebatePerDay: { type: Number, default: 120 },
      laundrySlotsPerWeek: { type: Number, default: 2 },
      curfewTime: { type: String, default: '21:30' },
      parentConsentRequired: { type: Boolean, default: true },
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hostelSchema.index({ organizationId: 1, code: 1 }, { unique: true });
hostelSchema.index({ organizationId: 1, status: 1 });
hostelSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('Hostel', hostelSchema);
