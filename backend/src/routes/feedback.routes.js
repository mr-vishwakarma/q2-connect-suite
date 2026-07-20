const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const { getComplaints, createComplaint, updateComplaint } = require('../controllers/complaints.controller');
const { getSuggestions, createSuggestion, updateSuggestion } = require('../controllers/suggestions.controller');

router.use(protect);

// Complaints
router.get('/complaints', getComplaints);
router.post('/complaints', createComplaint);
router.put('/complaints/:id', adminOnly, updateComplaint);

// Suggestions
router.get('/suggestions', getSuggestions);
router.post('/suggestions', createSuggestion);
router.put('/suggestions/:id', adminOnly, updateSuggestion);

module.exports = router;
