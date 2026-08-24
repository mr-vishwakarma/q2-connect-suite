const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Hostel = require('../models/Hostel');

const expenseService = {
  async getExpenses({ organizationId, hostelId, category, month }) {
    const filter = {};
    if (organizationId) filter.organizationId = organizationId;

    if (hostelId && hostelId !== 'All') {
      if (mongoose.Types.ObjectId.isValid(hostelId)) {
        filter.$or = [{ hostelId }, { hostel: hostelId }];
      } else {
        const hostelDoc = await Hostel.findOne({ code: hostelId });
        if (hostelDoc) {
          filter.$or = [{ hostelId: hostelDoc._id }, { hostel: hostelId }];
        } else {
          filter.hostel = hostelId;
        }
      }
    }

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
    let resolvedHostelId = null;
    const hostelCode = data.hostel || data.hostelId || hostelId || null;

    if (mongoose.Types.ObjectId.isValid(hostelId)) {
      resolvedHostelId = hostelId;
    } else if (mongoose.Types.ObjectId.isValid(data.hostelId)) {
      resolvedHostelId = data.hostelId;
    } else if (hostelCode && hostelCode !== 'All') {
      const query = { code: hostelCode };
      if (organizationId) query.organizationId = organizationId;
      const hostelDoc = await Hostel.findOne(query);
      if (hostelDoc) {
        resolvedHostelId = hostelDoc._id;
      }
    }

    const expense = await Expense.create({
      ...data,
      createdBy: userId,
      organizationId: organizationId || data.organizationId,
      hostelId: resolvedHostelId,
      hostel: hostelCode !== 'All' ? hostelCode : null,
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
