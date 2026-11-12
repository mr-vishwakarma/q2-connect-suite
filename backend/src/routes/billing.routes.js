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
  recordPaymentFailed,
  startTrial,
  previewUpgrade,
  requestDowngrade,
  cancelScheduledDowngrade,
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
router.post('/subscriptions/payment-failed', billingLimiter, recordPaymentFailed);
router.post('/subscriptions/cancel', billingLimiter, cancelSubscription);
router.post('/subscription/trial', billingLimiter, startTrial);
router.post('/subscription/upgrade/preview', billingLimiter, previewUpgrade);
router.post('/subscription/downgrade', billingLimiter, requestDowngrade);
router.delete('/subscription/downgrade', billingLimiter, cancelScheduledDowngrade);
router.get('/history', getBillingHistory);

module.exports = router;
