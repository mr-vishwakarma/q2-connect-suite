const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
  hostel: { type: String, trim: true, default: 'Q2', required: true },
  lateFeePerDay: { type: Number, default: 20 },
  gracePeriodDays: { type: Number, default: 5 },
}, { timestamps: true });

// Ensure one settings document per organization + hostel
settingsSchema.index({ organizationId: 1, hostel: 1 });
settingsSchema.index({ hostel: 1 });

module.exports = mongoose.model('Settings', settingsSchema);
