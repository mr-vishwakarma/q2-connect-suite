const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const {
  getPlans,
  getSubscriptionStatus,
  createSubscription,
  verifySubscription,
  cancelSubscription,
  getBillingHistory,
} = require('../controllers/billing.controller');

// Rate limiting for billing mutations
const billingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many billing requests, please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public / Authenticated plan catalog
router.get('/plans', getPlans);

// Organization SaaS Billing & Subscription Endpoints (strictly protected & tenant-scoped)
router.use(protect);
router.use(resolveTenantContext);

router.get('/subscription', getSubscriptionStatus);
router.get('/status', getSubscriptionStatus);
router.post('/subscriptions/create', billingLimiter, createSubscription);
router.post('/subscriptions/verify', billingLimiter, verifySubscription);
router.post('/subscriptions/cancel', billingLimiter, cancelSubscription);
router.get('/history', getBillingHistory);

module.exports = router;
