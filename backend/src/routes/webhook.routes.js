const express = require('express');
const router = express.Router();
const { handleRazorpayWebhook } = require('../controllers/webhook.controller');
const { handleResendWebhook } = require('../controllers/resendWebhook.controller');

// Razorpay Webhook endpoint - Cryptographically guarded by HMAC-SHA256 signature
router.post('/razorpay', handleRazorpayWebhook);

// Resend Webhook endpoint - Delivery, bounce, complaint, open, and click tracking
router.post('/resend', handleResendWebhook);

module.exports = router;
