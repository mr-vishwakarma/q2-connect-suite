const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const {
  createPaymentOrder,
  verifyPayment,
  getPaymentById,
  getMyPayments,
  getPayments,
  refundPayment,
} = require('../controllers/payment.controller');

// Rate limiting for payment financial operations (30 attempts per minute)
const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many payment requests, please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All payment routes require authentication and tenant resolution
router.use(protect);
router.use(resolveTenantContext);

// Student / Resident Endpoints (with canonical + aliases)
router.post('/create-order', paymentRateLimiter, createPaymentOrder);
router.post('/razorpay/create-order', paymentRateLimiter, createPaymentOrder);

router.post('/verify', paymentRateLimiter, verifyPayment);
router.post('/razorpay/verify', paymentRateLimiter, verifyPayment);

router.get('/my-payments', getMyPayments);
router.get('/student', getMyPayments);

// Admin Management & Refund Endpoints
router.get('/', adminOnly, getPayments);
router.post('/:id/refund', adminOnly, refundPayment);
router.post('/:id/refunds', adminOnly, refundPayment);
router.get('/:id', getPaymentById);

module.exports = router;
