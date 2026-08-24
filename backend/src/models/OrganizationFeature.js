const mongoose = require('mongoose');

const organizationFeatureSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    featureKey: { type: String, required: true, trim: true, lowercase: true },
    enabled: { type: Boolean, default: true },
    configuration: { type: mongoose.Schema.Types.Mixed, default: {} },
    limits: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

organizationFeatureSchema.index({ organizationId: 1, featureKey: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationFeature', organizationFeatureSchema);
