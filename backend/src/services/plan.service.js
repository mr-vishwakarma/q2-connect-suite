const Plan = require('../models/Plan');

const planService = {
  async getAllPlans() {
    return Plan.find().sort({ priceMonthly: 1 });
  },

  async createPlan(data) {
    const plan = await Plan.create(data);
    return plan;
  },

  async updatePlan(id, data) {
    const plan = await Plan.findByIdAndUpdate(id, data, { new: true });
    if (!plan) throw new Error('Plan not found');
    return plan;
  },

  async deletePlan(id) {
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) throw new Error('Plan not found');
    return plan;
  },
};

module.exports = { planService };
