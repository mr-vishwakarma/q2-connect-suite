const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: ['core', 'operations', 'finance', 'advanced'], default: 'core' },
    defaultEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feature', featureSchema);
