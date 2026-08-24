const { expenseService } = require('../services/expense.service');
const { logAuditAction } = require('../middleware/audit.middleware');

const expensesController = {
  async getExpenses(req, res) {
    try {
      const { category, month, hostel } = req.query;
      const expenses = await expenseService.getExpenses({
        organizationId: req.tenant?.organizationId,
        hostelId: req.tenant?.hostelId || hostel,
        category,
        month,
      });
      return res.status(200).json({ success: true, data: expenses });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async createExpense(req, res) {
    try {
      const expense = await expenseService.createExpense(
        req.body,
        req.user._id,
        req.tenant?.organizationId,
        req.tenant?.hostelId
      );

      await logAuditAction({
        req,
        action: 'CREATE_EXPENSE',
        entityType: 'Expense',
        entityId: expense._id,
        newValue: expense,
      });

      return res.status(201).json({ success: true, data: expense });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  async deleteExpense(req, res) {
    try {
      await expenseService.deleteExpense(req.params.id, req.tenant?.organizationId);
      await logAuditAction({
        req,
        action: 'DELETE_EXPENSE',
        entityType: 'Expense',
        entityId: req.params.id,
      });
      return res.status(200).json({ success: true, message: 'Expense deleted' });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },
};

module.exports = expensesController;
