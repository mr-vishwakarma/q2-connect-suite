const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const {
  getReceiptDetails,
  verifyReceiptPublic,
} = require('../controllers/receipt.controller');

// Public verification endpoint (accessible by QR scanners)
router.get('/verify/:receiptNo', verifyReceiptPublic);

// Authenticated receipt retrieval (Admin or Student)
router.get('/:receiptNo', protect, resolveTenantContext, getReceiptDetails);

module.exports = router;
