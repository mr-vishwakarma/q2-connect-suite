const Plan = require('../models/Plan');

const DEFAULT_PLANS = [
  {
    name: 'Starter Plan',
    code: 'STARTER',
    description: 'Perfect for single hostel branches or small PG accommodations with essential automation.',
    priceMonthly: 1999,
    priceYearly: 19990,
    limits: { maxStudents: 50, maxRooms: 20, maxHostels: 1, maxStaff: 3, storageGb: 2 },
    includedFeatures: [
      'student_management',
      'room_management',
      'fee_management',
      'security_deposit',
      'attendance',
      'complaints',
      'reports',
    ],
    isActive: true,
    isPopular: false,
    status: 'ACTIVE',
  },
  {
    name: 'Growth Plan',
    code: 'GROWTH',
    description: 'Designed for expanding student housing with integrated mess management & digital registers.',
    priceMonthly: 4999,
    priceYearly: 49990,
    limits: { maxStudents: 150, maxRooms: 60, maxHostels: 2, maxStaff: 8, storageGb: 5 },
    includedFeatures: [
      'student_management',
      'room_management',
      'fee_management',
      'security_deposit',
      'attendance',
      'mess_management',
      'laundry',
      'complaints',
      'reports',
    ],
    isActive: true,
    isPopular: false,
    status: 'ACTIVE',
  },
  {
    name: 'Professional Plan',
    code: 'PROFESSIONAL',
    description: 'Ideal for multi-floor and multi-branch hostel chains with expense tracking & advanced analytics.',
    priceMonthly: 8999,
    priceYearly: 89990,
    limits: { maxStudents: 500, maxRooms: 200, maxHostels: 5, maxStaff: 20, storageGb: 15 },
    includedFeatures: [
      'student_management',
      'room_management',
      'fee_management',
      'security_deposit',
      'expense_management',
      'attendance',
      'mess_management',
      'laundry',
      'complaints',
      'reports',
      'advanced_analytics',
    ],
    isActive: true,
    isPopular: true,
    status: 'ACTIVE',
  },
  {
    name: 'Enterprise Plan',
    code: 'ENTERPRISE',
    description: 'Full-scale solution for large hostel networks with custom branding, API access & dedicated SLA.',
    priceMonthly: 19999,
    priceYearly: 199990,
    limits: { maxStudents: 0, maxRooms: 0, maxHostels: 0, maxStaff: 0, storageGb: 50 },
    includedFeatures: [
      'student_management',
      'room_management',
      'fee_management',
      'security_deposit',
      'expense_management',
      'attendance',
      'mess_management',
      'laundry',
      'complaints',
      'reports',
      'advanced_analytics',
      'custom_branding',
      'biometric_integration',
      'api_access',
    ],
    isActive: true,
    isPopular: false,
    status: 'ACTIVE',
  },
];

const planService = {
  async getAllPlans() {
    let plans = await Plan.find().sort({ priceMonthly: 1 });
    if (!plans || plans.length === 0) {
      await this.seedDefaultPlans();
      plans = await Plan.find().sort({ priceMonthly: 1 });
    }
    return plans;
  },

  async seedDefaultPlans() {
    const operations = DEFAULT_PLANS.map((plan) => ({
      updateOne: {
        filter: { code: plan.code },
        update: { $set: plan },
        upsert: true,
      },
    }));
    await Plan.bulkWrite(operations);
    return Plan.find().sort({ priceMonthly: 1 });
  },

  async createPlan(data) {
    const existing = await Plan.findOne({ code: data.code.toUpperCase().trim() });
    if (existing) {
      throw new Error(`Plan with code '${data.code}' already exists`);
    }
    const plan = await Plan.create({
      ...data,
      code: data.code.toUpperCase().trim(),
    });
    return plan;
  },

  async updatePlan(id, data) {
    if (data.code) {
      data.code = data.code.toUpperCase().trim();
    }
    const plan = await Plan.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!plan) throw new Error('Plan not found');
    return plan;
  },

  async deletePlan(id) {
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) throw new Error('Plan not found');
    return plan;
  },
};

module.exports = { planService, DEFAULT_PLANS };
