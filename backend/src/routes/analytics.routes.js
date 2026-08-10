const express = require('express');
const router = express.Router();
const { getAnalytics } = require('../controllers/analytics.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.use(protect, adminOnly);
router.get('/', getAnalytics);

module.exports = router;
