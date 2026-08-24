const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, trim: true },
    capacity: { type: Number, default: 0 },
    genderType: { type: String, enum: ['GIRLS', 'BOYS', 'COED'], default: 'GIRLS' },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    wardenName: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
    settings: {
      lateFeePerDay: { type: Number, default: 20 },
      gracePeriodDays: { type: Number, default: 5 },
      laundrySlotsPerDay: { type: Number, default: 1 },
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hostelSchema.index({ organizationId: 1, code: 1 }, { unique: true });
hostelSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('Hostel', hostelSchema);
