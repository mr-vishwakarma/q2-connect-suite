const Expense = require('../models/Expense');

const expenseService = {
  async getExpenses({ organizationId, hostelId, category, month }) {
    const filter = {};
    if (organizationId) filter.organizationId = organizationId;
    if (hostelId) filter.hostelId = hostelId;
    if (category) filter.category = category;

    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const start = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      const end = new Date(Number(yearStr), Number(monthStr), 0, 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });
    return expenses;
  },

  async createExpense(data, userId, organizationId, hostelId) {
    const expense = await Expense.create({
      ...data,
      createdBy: userId,
      organizationId: organizationId || data.organizationId,
      hostelId: hostelId || data.hostelId,
    });
    return expense;
  },

  async deleteExpense(id, organizationId) {
    const filter = { _id: id };
    if (organizationId) filter.organizationId = organizationId;
    const expense = await Expense.findOneAndDelete(filter);
    if (!expense) throw new Error('Expense not found');
    return expense;
  },
};

module.exports = { expenseService };
