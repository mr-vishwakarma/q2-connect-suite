const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');

const { getFees, createFee, updateFee, generateMonthlyFees, getFeePayments, getFeeManagementDashboard, collectPayment } = require('../controllers/fees.controller');

router.use(protect);

// Dashboard
router.get('/dashboard', adminOnly, getFeeManagementDashboard);

// Collect payment (atomic operation)
router.post('/collect', adminOnly, collectPayment);

// Fees
router.get('/', getFees);
router.post('/', adminOnly, createFee);
router.put('/:id', adminOnly, updateFee);
router.post('/generate-monthly', adminOnly, generateMonthlyFees);

// Fee Payments
router.get('/payments', getFeePayments);

module.exports = router;
