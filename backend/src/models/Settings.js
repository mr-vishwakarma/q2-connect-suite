const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
  hostel: { type: String, trim: true, default: 'Q2', required: true },
  lateFeePerDay: { type: Number, default: 20 },
  gracePeriodDays: { type: Number, default: 5 },
  monthlyRentDueDay: { type: Number, default: 5, min: 1, max: 31 },
}, { timestamps: true });

// Ensure unique settings document per organization + hostel
settingsSchema.index({ organizationId: 1, hostel: 1 }, { unique: true });

module.exports = mongoose.model('Settings', settingsSchema);

