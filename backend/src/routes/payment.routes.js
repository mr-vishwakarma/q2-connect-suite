const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const {
  createPaymentOrder,
  verifyPayment,
  getPaymentById,
  getMyPayments,
  getPayments,
} = require('../controllers/payment.controller');

// All payment routes require authentication and tenant resolution
router.use(protect);
router.use(resolveTenantContext);

// Student / Resident Endpoints
router.post('/create-order', createPaymentOrder);
router.post('/verify', verifyPayment);
router.get('/my-payments', getMyPayments);

// Admin Management & Invoicing Endpoints
router.get('/', adminOnly, getPayments);
router.get('/:id', getPaymentById);

module.exports = router;
