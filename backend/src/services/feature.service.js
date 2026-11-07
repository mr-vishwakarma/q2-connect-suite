const Feature = require('../models/Feature');
const OrganizationFeature = require('../models/OrganizationFeature');

const DEFAULT_FEATURES = [
  { key: 'student_management', name: 'Student Management', description: 'Student onboarding, profiles, room assignment & KYC documents', category: 'core', defaultEnabled: true },
  { key: 'room_management', name: 'Room & Bed Management', description: 'Building, floor, room allocation & live occupancy tracking', category: 'core', defaultEnabled: true },
  { key: 'fee_management', name: 'Fee Collection & Matrix', description: 'Interactive student fee matrix, receipts, grace period & late fees', category: 'finance', defaultEnabled: true },
  { key: 'security_deposit', name: 'Security Deposits', description: 'Deposit ledgers, adjustments, refunds & tracking', category: 'finance', defaultEnabled: true },
  { key: 'expense_management', name: 'Expense Tracker', description: 'Hostel utility bills, vendor payments, maintenance expenses & cashflow', category: 'finance', defaultEnabled: true },
  { key: 'attendance', name: 'Attendance & Gate Passes', description: 'Student entry/exit pass approval and daily attendance', category: 'operations', defaultEnabled: true },
  { key: 'mess_management', name: 'Mess & Leave Requests', description: 'Mess-off rebate leaves, food rating widget & menu schedule', category: 'operations', defaultEnabled: true },
  { key: 'laundry', name: 'Laundry Booking', description: 'Time-slot booking system for washing machines', category: 'operations', defaultEnabled: true },
  { key: 'complaints', name: 'Complaints & Suggestions', description: 'Student ticketing system with resolution statuses', category: 'operations', defaultEnabled: true },
  { key: 'reports', name: 'Financial & Occupancy Reports', description: 'Exportable Excel & PDF financial ledgers', category: 'advanced', defaultEnabled: true },
  { key: 'advanced_analytics', name: 'Advanced Analytics & AI', description: 'Cohort analytics, forecasting & smart chatbot', category: 'advanced', defaultEnabled: false },
  { key: 'custom_branding', name: 'White-label & Custom Branding', description: 'Custom tenant logos, domain & receipt branding', category: 'advanced', defaultEnabled: false },
  { key: 'biometric_integration', name: 'Biometric Attendance Hardware', description: 'Hardware integration with gate access scanners', category: 'advanced', defaultEnabled: false },
  { key: 'api_access', name: 'External API & Webhooks', description: 'REST APIs and webhook triggers for third-party integrations', category: 'advanced', defaultEnabled: false },
];

const featureService = {
  async getFeatureCatalog() {
    let features = await Feature.find().sort({ category: 1, name: 1 });
    if (!features || features.length === 0) {
      await this.seedDefaultFeatures();
      features = await Feature.find().sort({ category: 1, name: 1 });
    }
    return features;
  },

  async seedDefaultFeatures() {
    const operations = DEFAULT_FEATURES.map((feat) => ({
      updateOne: {
        filter: { key: feat.key },
        update: { $set: feat },
        upsert: true,
      },
    }));
    await Feature.bulkWrite(operations);
    return Feature.find().sort({ category: 1, name: 1 });
  },

  async createFeature(data) {
    const existing = await Feature.findOne({ key: data.key.toLowerCase().trim() });
    if (existing) {
      throw new Error(`Feature with key '${data.key}' already exists`);
    }
    const feature = await Feature.create({
      ...data,
      key: data.key.toLowerCase().trim(),
    });
    return feature;
  },

  async updateFeature(id, data) {
    const feature = await Feature.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!feature) throw new Error('Feature not found');
    return feature;
  },

  async toggleFeatureDefault(id, defaultEnabled) {
    const feature = await Feature.findByIdAndUpdate(id, { defaultEnabled }, { new: true });
    if (!feature) throw new Error('Feature not found');
    return feature;
  },

  async deleteFeature(id) {
    const feature = await Feature.findByIdAndDelete(id);
    if (!feature) throw new Error('Feature not found');
    return feature;
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

module.exports = { featureService, DEFAULT_FEATURES };
