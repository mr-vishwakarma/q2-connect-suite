const { organizationService } = require('../services/organization.service');
const { planService } = require('../services/plan.service');
const { featureService } = require('../services/feature.service');
const { platformAnalyticsService } = require('../services/platformAnalytics.service');
const { impersonationService } = require('../services/impersonation.service');
const { userService } = require('../services/userService');
const { hostelAdminService } = require('../services/hostelAdmin.service');
const { subscriptionAdminService } = require('../services/subscriptionAdmin.service');
const { securityCenterService } = require('../services/securityCenter.service');
const { systemHealthService } = require('../services/systemHealth.service');
const { reportExportService } = require('../services/reportExport.service');
const { platformSettingsService } = require('../services/platformSettings.service');
const AuditLog = require('../models/AuditLog');
const Hostel = require('../models/Hostel');
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

  async getDetailedAnalytics(req, res) {
    try {
      const analytics = await platformAnalyticsService.getDetailedPlatformAnalytics();
      return res.status(200).json({ success: true, data: analytics });
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
      const result = await hostelAdminService.getAllHostelsPaginated(req.query);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async getHostelMetrics(req, res) {
    try {
      const metrics = await hostelAdminService.getHostelGlobalMetrics();
      return res.status(200).json({ success: true, data: metrics });
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

  // --- Global User Management ---
  async getUsers(req, res) {
    try {
      const usersData = await userService.getAllUsers(req.query);
      return res.status(200).json({ success: true, data: usersData });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async getUser(req, res) {
    try {
      const user = await userService.getUserById(req.params.id);
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      return res.status(404).json({ success: false, message: error.message });
    }
  },

  async updateUserStatus(req, res) {
    try {
      const { isActive, reason } = req.body;
      const user = await userService.updateUserStatus(req.params.id, isActive, reason);
      await logAuditAction({
        req,
        action: isActive ? 'ACTIVATE_USER' : 'SUSPEND_USER',
        entityType: 'User',
        entityId: user._id,
        newValue: { isActive, reason },
      });
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async revokeUserSessions(req, res) {
    try {
      const result = await userService.revokeUserSessions(req.params.id);
      await logAuditAction({
        req,
        action: 'REVOKE_USER_SESSIONS',
        entityType: 'User',
        entityId: req.params.id,
      });
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async unlockUserAccount(req, res) {
    try {
      const user = await userService.unlockUserAccount(req.params.id);
      await logAuditAction({
        req,
        action: 'UNLOCK_USER_ACCOUNT',
        entityType: 'User',
        entityId: user._id,
      });
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async updateUserRole(req, res) {
    try {
      const { role } = req.body;
      const user = await userService.updateUserRole(req.params.id, role, req.user);
      await logAuditAction({
        req,
        action: 'CHANGE_USER_ROLE',
        entityType: 'User',
        entityId: user._id,
        newValue: { role },
      });
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  // --- Plans & Pricing ---
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

  // --- Subscriptions ---
  async getSubscriptions(req, res) {
    try {
      const data = await subscriptionAdminService.getAllSubscriptions(req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateSubscription(req, res) {
    try {
      const sub = await subscriptionAdminService.updateSubscription(req.params.id, req.body);
      await logAuditAction({
        req,
        action: 'UPDATE_SUBSCRIPTION',
        entityType: 'Subscription',
        entityId: sub._id,
        newValue: req.body,
      });
      return res.status(200).json({ success: true, data: sub });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async extendSubscriptionTrial(req, res) {
    try {
      const days = parseInt(req.body.days, 10) || 14;
      const sub = await subscriptionAdminService.extendTrial(req.params.id, days);
      await logAuditAction({
        req,
        action: 'EXTEND_SUBSCRIPTION_TRIAL',
        entityType: 'Subscription',
        entityId: sub._id,
        newValue: { days },
      });
      return res.status(200).json({ success: true, data: sub });
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

  // --- Compliance & Audit Logs ---
  async getAuditLogs(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.organizationId) filter.organizationId = req.query.organizationId;
      if (req.query.action) filter.action = req.query.action;
      if (req.query.entityType) filter.entityType = req.query.entityType;
      if (req.query.search) {
        filter.$or = [
          { actorName: { $regex: req.query.search, $options: 'i' } },
          { action: { $regex: req.query.search, $options: 'i' } },
          { entityType: { $regex: req.query.search, $options: 'i' } },
        ];
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .populate('organizationId', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // --- Security Center ---
  async getSecurityCenter(req, res) {
    try {
      const data = await securityCenterService.getSecurityOverview();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async unlockSecurityUser(req, res) {
    try {
      const user = await securityCenterService.unlockUser(req.params.id);
      await logAuditAction({
        req,
        action: 'UNLOCK_USER_SECURITY',
        entityType: 'User',
        entityId: user._id,
      });
      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  // --- Controlled Impersonation ---
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

  // --- System Health ---
  async getSystemHealth(req, res) {
    try {
      const health = await systemHealthService.getSystemHealth();
      return res.status(200).json({ success: true, data: health });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // --- Reports (Streaming CSV) ---
  async exportReport(req, res) {
    try {
      const { type } = req.params;
      await logAuditAction({
        req,
        action: 'EXPORT_PLATFORM_REPORT',
        entityType: 'Report',
        newValue: { type, query: req.query },
      });
      return await reportExportService.streamReportToCsv(type, req.query, res);
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // --- Platform Settings ---
  async getPlatformSettings(req, res) {
    try {
      const settings = await platformSettingsService.getSettings();
      return res.status(200).json({ success: true, data: settings });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async updatePlatformSettings(req, res) {
    try {
      const settings = await platformSettingsService.updateSettings(req.body, req.user._id);
      await logAuditAction({
        req,
        action: 'UPDATE_PLATFORM_SETTINGS',
        entityType: 'PlatformSetting',
        entityId: settings._id,
        newValue: req.body,
      });
      return res.status(200).json({ success: true, data: settings });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },
};

module.exports = superAdminController;
