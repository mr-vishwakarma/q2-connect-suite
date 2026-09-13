const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdmin.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireSuperAdmin } = require('../middleware/rbac.middleware');

// All routes here strictly require Super Admin authentication
router.use(protect, requireSuperAdmin);

// 1. Dashboard & Analytics
router.get('/analytics/dashboard', superAdminController.getDashboardStats);
router.get('/analytics/detailed', superAdminController.getDetailedAnalytics);

// 2. Organizations
router.get('/organizations', superAdminController.getOrganizations);
router.get('/organizations/:id', superAdminController.getOrganization);
router.post('/organizations', superAdminController.createOrganization);
router.put('/organizations/:id', superAdminController.updateOrganization);
router.patch('/organizations/:id/suspend', superAdminController.suspendOrganization);

// 3. Hostels / Branches
router.get('/hostels', superAdminController.getAllHostels);
router.get('/hostels/metrics', superAdminController.getHostelMetrics);
router.post('/hostels', superAdminController.createHostel);

// 4. Global User Management
router.get('/users', superAdminController.getUsers);
router.get('/users/:id', superAdminController.getUser);
router.patch('/users/:id/status', superAdminController.updateUserStatus);
router.post('/users/:id/revoke-sessions', superAdminController.revokeUserSessions);
router.post('/users/:id/unlock', superAdminController.unlockUserAccount);
router.patch('/users/:id/role', superAdminController.updateUserRole);

// 5. Plans & Pricing
router.get('/plans', superAdminController.getPlans);
router.post('/plans', superAdminController.createPlan);
router.put('/plans/:id', superAdminController.updatePlan);

// 6. Subscriptions
router.get('/subscriptions', superAdminController.getSubscriptions);
router.put('/subscriptions/:id', superAdminController.updateSubscription);
router.post('/subscriptions/:id/extend-trial', superAdminController.extendSubscriptionTrial);

// 7. Feature Catalog & Gating
router.get('/features', superAdminController.getFeatures);
router.post('/features/toggle', superAdminController.toggleOrgFeature);

// 8. Compliance & Audit Logs
router.get('/audit-logs', superAdminController.getAuditLogs);

// 9. Security Center
router.get('/security/overview', superAdminController.getSecurityCenter);
router.post('/security/unlock/:id', superAdminController.unlockSecurityUser);

// 10. Controlled Impersonation
router.post('/impersonation/start', superAdminController.startImpersonation);

// 11. System Health
router.get('/system-health', superAdminController.getSystemHealth);

// 12. Reports (Streaming CSV)
router.get('/reports/:type/export', superAdminController.exportReport);

// 13. Platform Settings
router.get('/settings', superAdminController.getPlatformSettings);
router.put('/settings', superAdminController.updatePlatformSettings);

module.exports = router;
