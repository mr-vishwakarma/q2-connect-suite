const express = require('express');
const router = express.Router();
const { handleRazorpayWebhook } = require('../controllers/webhook.controller');

// Razorpay Webhook endpoint - Cryptographically guarded by HMAC-SHA256 signature
router.post('/razorpay', handleRazorpayWebhook);

module.exports = router;
