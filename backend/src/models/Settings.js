const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'], required: true },
  lateFeePerDay: { type: Number, default: 20 },
  gracePeriodDays: { type: Number, default: 5 },
}, { timestamps: true });

// Ensure one settings document per hostel
settingsSchema.index({ hostel: 1 }, { unique: true });

module.exports = mongoose.model('Settings', settingsSchema);
