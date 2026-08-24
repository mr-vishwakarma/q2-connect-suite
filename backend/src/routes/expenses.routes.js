const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expenses.controller');
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { requireFeature } = require('../middleware/feature.middleware');

router.use(protect, resolveTenantContext);

router.get('/', expensesController.getExpenses);
router.post('/', requireFeature('expense_management'), expensesController.createExpense);
router.delete('/:id', requireFeature('expense_management'), expensesController.deleteExpense);

module.exports = router;
