const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Hostel = require('../models/Hostel');

const isValidObjectIdHex = (val) =>
  typeof val === 'string' ? /^[0-9a-fA-F]{24}$/.test(val.trim()) : val instanceof mongoose.Types.ObjectId;

const expenseService = {
  async getExpenses({ organizationId, hostelId, category, month, page = 1, limit = 20 }) {
    const filter = {};
    if (organizationId) filter.organizationId = organizationId;

    if (hostelId && hostelId !== 'All') {
      if (isValidObjectIdHex(hostelId)) {
        const hostelObjQuery = { _id: hostelId };
        if (organizationId) hostelObjQuery.organizationId = organizationId;
        const hostelDoc = await Hostel.findOne(hostelObjQuery).select('code').lean();
        if (hostelDoc?.code) {
          filter.$or = [{ hostelId }, { hostel: hostelDoc.code }, { hostel: hostelId }];
        } else {
          filter.$or = [{ hostelId }, { hostel: hostelId }];
        }
      } else {
        const hostelQuery = { code: String(hostelId).trim() };
        if (organizationId) hostelQuery.organizationId = organizationId;
        const hostelDoc = await Hostel.findOne(hostelQuery).lean();
        if (hostelDoc) {
          filter.$or = [{ hostelId: hostelDoc._id }, { hostel: hostelDoc.code }, { hostel: hostelId }];
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

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitAmount = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const skip = (pageNum - 1) * limitAmount;

    const [total, expenses] = await Promise.all([
      Expense.countDocuments(filter),
      Expense.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip(skip)
        .limit(limitAmount)
        .lean()
    ]);

    return {
      expenses,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitAmount) || (total === 0 ? 0 : 1),
      limit: limitAmount,
    };
  },

  async createExpense(data, userId, organizationId, hostelId) {
    let resolvedHostelId = null;
    let resolvedHostelCode = null;
    const hostelCode = data.hostel || data.hostelId || hostelId || null;

    if (isValidObjectIdHex(data.hostelId)) {
      resolvedHostelId = data.hostelId;
    } else if (isValidObjectIdHex(hostelId)) {
      resolvedHostelId = hostelId;
    }

    if (resolvedHostelId) {
      const hQuery = { _id: resolvedHostelId };
      if (organizationId) hQuery.organizationId = organizationId;
      const hostelDoc = await Hostel.findOne(hQuery).select('code').lean();
      if (hostelDoc?.code) resolvedHostelCode = hostelDoc.code;
    } else if (hostelCode && hostelCode !== 'All') {
      const query = { code: hostelCode };
      if (organizationId) query.organizationId = organizationId;
      const hostelDoc = await Hostel.findOne(query);
      if (hostelDoc) {
        resolvedHostelId = hostelDoc._id;
        resolvedHostelCode = hostelDoc.code;
      }
    }

    const cleanData = { ...data };
    delete cleanData.organizationId; // Prevent untrusted body override

    const finalHostelCode =
      data.hostel && data.hostel !== 'All'
        ? data.hostel
        : resolvedHostelCode || (hostelCode && hostelCode !== 'All' && !isValidObjectIdHex(hostelCode) ? hostelCode : null);

    const expense = await Expense.create({
      ...cleanData,
      createdBy: userId,
      organizationId: organizationId,
      hostelId: resolvedHostelId,
      hostel: finalHostelCode,
    });
    return expense;
  },

  async deleteExpense(id, organizationId) {
    const filter = { _id: id };
    if (organizationId) filter.organizationId = organizationId;
    const expense = await Expense.findOneAndDelete(filter);
    if (!expense) throw new Error('Expense not found in this organization');
    return expense;
  },
};

module.exports = { expenseService };
