const express = require('express');
const router = express.Router();
const { submitRating, getAnalytics } = require('../controllers/rating.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

router.use(protect);

// Student submits rating
router.post('/submit', authorize('student'), submitRating);

// Admin fetches analytics
router.get('/analytics', authorize('admin'), getAnalytics);

module.exports = router;
