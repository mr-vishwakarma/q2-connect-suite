const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');
const { adminOnly, adminOrWarden } = require('../middleware/admin.middleware');


router.get('/admin', protect, adminOrWarden, dashboardController.getAdminDashboard);
router.get('/student', protect, dashboardController.getStudentDashboard);

module.exports = router;
