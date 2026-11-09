const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { submitEnquiry } = require('../controllers/enquiry.controller');

// Dedicated rate limiter for public enquiries to prevent automated spam/abuse
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 submissions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many enquiry submissions from this IP. Please wait a few minutes before trying again.',
  },
});

router.post('/', enquiryLimiter, submitEnquiry);

module.exports = router;
