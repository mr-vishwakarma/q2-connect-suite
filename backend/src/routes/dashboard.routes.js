const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly, adminOrWarden } = require('../middleware/admin.middleware');
const { studentOnly } = require('../middleware/student.middleware');

router.get('/admin', protect, resolveTenantContext, adminOrWarden, dashboardController.getAdminDashboard);
router.get('/student', protect, resolveTenantContext, studentOnly, dashboardController.getStudentDashboard);

module.exports = router;
