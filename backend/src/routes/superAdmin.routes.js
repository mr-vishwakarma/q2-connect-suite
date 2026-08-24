const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdmin.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireSuperAdmin } = require('../middleware/rbac.middleware');

// All routes here strictly require Super Admin authentication
router.use(protect, requireSuperAdmin);

// Dashboard Analytics
router.get('/analytics/dashboard', superAdminController.getDashboardStats);

// Organizations
router.get('/organizations', superAdminController.getOrganizations);
router.get('/organizations/:id', superAdminController.getOrganization);
router.post('/organizations', superAdminController.createOrganization);
router.put('/organizations/:id', superAdminController.updateOrganization);
router.patch('/organizations/:id/suspend', superAdminController.suspendOrganization);

// Hostels / Branches
router.get('/hostels', superAdminController.getAllHostels);
router.post('/hostels', superAdminController.createHostel);

// Plans & Pricing
router.get('/plans', superAdminController.getPlans);
router.post('/plans', superAdminController.createPlan);
router.put('/plans/:id', superAdminController.updatePlan);

// Feature Catalog & Gating
router.get('/features', superAdminController.getFeatures);
router.post('/features/toggle', superAdminController.toggleOrgFeature);

// Compliance & Audit Logs
router.get('/audit-logs', superAdminController.getAuditLogs);

// Impersonation
router.post('/impersonation/start', superAdminController.startImpersonation);

module.exports = router;
