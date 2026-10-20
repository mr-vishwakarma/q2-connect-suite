const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');

const {
  getFees,
  createFee,
  updateFee,
  generateMonthlyFees,
  getFeePayments,
  getSecurityDeposits,
  getFeeManagementDashboard,
  collectPayment,
  calculatePayableFeeEndpoint,
  sendFeeReminderEmail,
} = require('../controllers/fees.controller');

router.use(protect, resolveTenantContext);

// Dashboard & Calculations
router.get('/dashboard', adminOnly, getFeeManagementDashboard);
router.get('/calculate', adminOnly, calculatePayableFeeEndpoint);

// Collect payment (atomic operation)
router.post('/collect', adminOnly, collectPayment);

// Send fee statement/reminder email
router.post('/send-reminder/:studentId', adminOnly, sendFeeReminderEmail);

// Fees
router.get('/', getFees);
router.post('/', adminOnly, createFee);
router.put('/:id', adminOnly, updateFee);
router.post('/generate-monthly', adminOnly, generateMonthlyFees);

// Fee Payments & Security Deposits
router.get('/payments', getFeePayments);
router.get('/deposits', getSecurityDeposits);

module.exports = router;
