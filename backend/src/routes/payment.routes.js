const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const {
  getPaymentById,
  getPayments,
  refundPayment,
} = require('../controllers/payment.controller');

// Rate limiting for payment financial operations
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

/**
 * STRICT BUSINESS BARRIER:
 * Student online fee payments are disabled platform-wide.
 * Razorpay is reserved strictly for Organization SaaS billing (/api/billing).
 * Any attempt to invoke student online payment endpoints returns HTTP 403 Forbidden.
 */
const blockStudentOnlinePayment = (req, res) => {
  return res.status(403).json({
    success: false,
    error: {
      code: 'STUDENT_ONLINE_PAYMENTS_DISABLED',
      message: 'Student online fee payments are disabled. Hostel fees are collected offline/manually by hostel administration.',
    },
    message: 'Student online fee payments are disabled. Hostel fees are collected offline/manually by hostel administration.',
    requestId: req.requestId,
  });
};

router.post('/create-order', paymentRateLimiter, blockStudentOnlinePayment);
router.post('/razorpay/create-order', paymentRateLimiter, blockStudentOnlinePayment);
router.post('/verify', paymentRateLimiter, blockStudentOnlinePayment);
router.post('/razorpay/verify', paymentRateLimiter, blockStudentOnlinePayment);
router.get('/my-payments', blockStudentOnlinePayment);
router.get('/student', blockStudentOnlinePayment);

// Admin Management & Refund Endpoints (Admin / Super Admin ONLY)
router.get('/', adminOnly, getPayments);
router.post('/:id/refund', adminOnly, refundPayment);
router.post('/:id/refunds', adminOnly, refundPayment);
router.get('/:id', getPaymentById);

module.exports = router;
