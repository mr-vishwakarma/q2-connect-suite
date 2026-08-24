const Feature = require('../models/Feature');
const OrganizationFeature = require('../models/OrganizationFeature');

const featureService = {
  async getFeatureCatalog() {
    return Feature.find().sort({ category: 1, name: 1 });
  },

  async getOrgFeatures(organizationId) {
    return OrganizationFeature.find({ organizationId });
  },

  async toggleOrgFeature(organizationId, featureKey, enabled, configuration = {}) {
    const feature = await OrganizationFeature.findOneAndUpdate(
      { organizationId, featureKey },
      { enabled, configuration },
      { upsert: true, new: true }
    );
    return feature;
  },
};

module.exports = { featureService };
