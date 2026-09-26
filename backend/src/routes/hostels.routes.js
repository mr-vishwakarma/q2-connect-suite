const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const hostelController = require('../controllers/hostel.controller');

// Require authentication and resolve tenant context
router.use(protect, resolveTenantContext);

// Public to authenticated tenant users (students, staff, admins)
router.get('/', hostelController.getHostels);
router.get('/:id', hostelController.getHostelById);

// Admin-only branch management
router.post('/', adminOnly, hostelController.createHostel);
router.put('/:id', adminOnly, hostelController.updateHostel);
router.patch('/:id/status', adminOnly, hostelController.updateHostelStatus);
router.delete('/:id', adminOnly, hostelController.deleteHostel);

module.exports = router;
