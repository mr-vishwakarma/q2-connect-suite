const { organizationService } = require('../services/organization.service');
const { planService } = require('../services/plan.service');
const { featureService } = require('../services/feature.service');
const { platformAnalyticsService } = require('../services/platformAnalytics.service');
const { impersonationService } = require('../services/impersonation.service');
const AuditLog = require('../models/AuditLog');
const Hostel = require('../models/Hostel');
const User = require('../models/User');
const { logAuditAction } = require('../middleware/audit.middleware');

const superAdminController = {
  // --- Analytics ---
  async getDashboardStats(req, res) {
    try {
      const stats = await platformAnalyticsService.getPlatformStats();
      return res.status(200).json({ success: true, data: stats });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // --- Organizations ---
  async getOrganizations(req, res) {
    try {
      const orgs = await organizationService.getAllOrganizations(req.query);
      return res.status(200).json({ success: true, data: orgs });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async getOrganization(req, res) {
    try {
      const org = await organizationService.getOrganizationById(req.params.id);
      return res.status(200).json({ success: true, data: org });
    } catch (error) {
      return res.status(404).json({ success: false, message: error.message });
    }
  },

  async createOrganization(req, res) {
    try {
      const result = await organizationService.createOrganization(req.body, req.user._id);
      await logAuditAction({
        req,
        action: 'CREATE_ORGANIZATION',
        entityType: 'Organization',
        entityId: result.organization._id,
        newValue: result.organization,
      });
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async updateOrganization(req, res) {
    try {
      const org = await organizationService.updateOrganization(req.params.id, req.body);
      await logAuditAction({
        req,
        action: 'UPDATE_ORGANIZATION',
        entityType: 'Organization',
        entityId: org._id,
        newValue: req.body,
      });
      return res.status(200).json({ success: true, data: org });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async suspendOrganization(req, res) {
    try {
      const { isSuspended } = req.body;
      const org = await organizationService.suspendOrganization(req.params.id, isSuspended);
      await logAuditAction({
        req,
        action: isSuspended ? 'SUSPEND_ORGANIZATION' : 'ACTIVATE_ORGANIZATION',
        entityType: 'Organization',
        entityId: org._id,
      });
      return res.status(200).json({ success: true, data: org });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  // --- Hostels / Branches ---
  async getAllHostels(req, res) {
    try {
      const filter = { isDeleted: false };
      if (req.query.organizationId) filter.organizationId = req.query.organizationId;
      const hostels = await Hostel.find(filter).populate('organizationId', 'name slug').sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: hostels });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async createHostel(req, res) {
    try {
      const hostel = await Hostel.create(req.body);
      await logAuditAction({
        req,
        action: 'CREATE_HOSTEL_BRANCH',
        entityType: 'Hostel',
        entityId: hostel._id,
        newValue: hostel,
      });
      return res.status(201).json({ success: true, data: hostel });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  // --- Plans ---
  async getPlans(req, res) {
    try {
      const plans = await planService.getAllPlans();
      return res.status(200).json({ success: true, data: plans });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async createPlan(req, res) {
    try {
      const plan = await planService.createPlan(req.body);
      return res.status(201).json({ success: true, data: plan });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async updatePlan(req, res) {
    try {
      const plan = await planService.updatePlan(req.params.id, req.body);
      return res.status(200).json({ success: true, data: plan });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  // --- Features ---
  async getFeatures(req, res) {
    try {
      const features = await featureService.getFeatureCatalog();
      return res.status(200).json({ success: true, data: features });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async toggleOrgFeature(req, res) {
    try {
      const { organizationId, featureKey, enabled, configuration } = req.body;
      const feature = await featureService.toggleOrgFeature(organizationId, featureKey, enabled, configuration);
      await logAuditAction({
        req,
        action: enabled ? 'ENABLE_FEATURE' : 'DISABLE_FEATURE',
        entityType: 'OrganizationFeature',
        entityId: feature._id,
        newValue: { featureKey, enabled, configuration },
      });
      return res.status(200).json({ success: true, data: feature });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  // --- Audit Logs ---
  async getAuditLogs(req, res) {
    try {
      const filter = {};
      if (req.query.organizationId) filter.organizationId = req.query.organizationId;
      if (req.query.action) filter.action = req.query.action;

      const logs = await AuditLog.find(filter)
        .populate('organizationId', 'name')
        .sort({ createdAt: -1 })
        .limit(100);

      return res.status(200).json({ success: true, data: logs });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // --- Impersonation ---
  async startImpersonation(req, res) {
    try {
      const { targetUserId, organizationId, reason } = req.body;
      const result = await impersonationService.startImpersonationSession({
        superAdminId: req.user._id,
        targetUserId,
        organizationId,
        reason: reason || 'Super Admin Troubleshooting Session',
      });

      await logAuditAction({
        req,
        action: 'START_IMPERSONATION',
        entityType: 'ImpersonationSession',
        entityId: result.session._id,
        newValue: { targetUserId, organizationId, reason },
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },
};

module.exports = superAdminController;
