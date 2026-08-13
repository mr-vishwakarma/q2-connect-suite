const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');

router.use(protect);

router.get('/:hostel', getSettings);
router.put('/:hostel', adminOnly, updateSettings);

module.exports = router;
