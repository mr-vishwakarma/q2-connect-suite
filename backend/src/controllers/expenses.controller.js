const mongoose = require('mongoose');
const { expenseService } = require('../services/expense.service');
const { logAuditAction } = require('../middleware/audit.middleware');

const expensesController = {
  async getExpenses(req, res) {
    try {
      const { category, month, hostel, page = 1, limit = 20 } = req.query;
      const orgId = req.organizationId || req.tenant?.organizationId;
      const isSuperAdmin = req.tenant?.isSuperAdmin;

      if (!isSuperAdmin && !orgId) {
        return res.status(403).json({ success: false, message: 'Organization context is required' });
      }

      const result = await expenseService.getExpenses({
        organizationId: isSuperAdmin ? orgId : (orgId || new mongoose.Types.ObjectId()),
        hostelId: req.tenant?.hostelId || hostel,
        category,
        month,
        page,
        limit,
      });
      return res.status(200).json({ 
        success: true, 
        count: result.expenses.length,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit: result.limit,
        data: result.expenses 
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  async createExpense(req, res) {
    try {
      const orgId = req.organizationId || req.tenant?.organizationId;
      const isSuperAdmin = req.tenant?.isSuperAdmin;

      if (!isSuperAdmin && !orgId) {
        return res.status(403).json({ success: false, message: 'Organization context is required' });
      }

      const expense = await expenseService.createExpense(
        req.body,
        req.user._id,
        orgId,
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
      const orgId = req.organizationId || req.tenant?.organizationId;
      const isSuperAdmin = req.tenant?.isSuperAdmin;

      if (!isSuperAdmin && !orgId) {
        return res.status(403).json({ success: false, message: 'Organization context is required' });
      }

      await expenseService.deleteExpense(
        req.params.id,
        isSuperAdmin ? orgId : (orgId || new mongoose.Types.ObjectId())
      );

      await logAuditAction({
        req,
        action: 'DELETE_EXPENSE',
        entityType: 'Expense',
        entityId: req.params.id,
      });
      return res.status(200).json({ success: true, message: 'Expense deleted' });
    } catch (error) {
      return res.status(404).json({ success: false, message: error.message });
    }
  },
};

module.exports = expensesController;

