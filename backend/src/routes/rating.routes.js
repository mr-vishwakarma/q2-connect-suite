const express = require('express');
const router = express.Router();
const { submitRating, getAnalytics } = require('../controllers/rating.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');

router.use(protect, resolveTenantContext);


// Student submits rating
router.post('/submit', authorize('student'), submitRating);

// Admin fetches analytics
router.get('/analytics', authorize('admin'), getAnalytics);

module.exports = router;
