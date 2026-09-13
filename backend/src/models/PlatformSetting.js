const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    category: {
      type: String,
      enum: ['general', 'security', 'notifications', 'billing', 'features', 'maintenance'],
      default: 'general',
      required: true,
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, trim: true },
    isPublic: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

platformSettingSchema.index({ category: 1 });

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
