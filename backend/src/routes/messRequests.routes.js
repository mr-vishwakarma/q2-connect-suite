const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly, adminOrWarden } = require('../middleware/admin.middleware');
const { getMessRequests, createMessRequest, updateMessRequest } = require('../controllers/messRequests.controller');

router.use(protect);
router.get('/', getMessRequests);
router.post('/', createMessRequest);       // students create
router.put('/:id', adminOrWarden, updateMessRequest); // admin or warden approves/rejects

module.exports = router;
