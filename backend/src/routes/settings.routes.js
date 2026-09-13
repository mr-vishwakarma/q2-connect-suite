const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');

router.use(protect, resolveTenantContext);

router.get('/:hostel', getSettings);
router.put('/:hostel', adminOnly, updateSettings);

module.exports = router;

