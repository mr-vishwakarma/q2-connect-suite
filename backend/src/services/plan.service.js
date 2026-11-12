const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');

const DEFAULT_PLANS = [
  {
    name: 'Starter Plan',
    code: 'STARTER',
    description: 'Perfect for single hostel branches or small PG accommodations with essential automation.',
    priceMonthly: 1999,
    priceYearly: 19990,
    allowedBillingCycles: ['MONTHLY', 'YEARLY'],
    trialEligible: true,
    trialDays: 14,
    sortOrder: 1,
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
    allowedBillingCycles: ['MONTHLY', 'YEARLY'],
    trialEligible: true,
    trialDays: 14,
    sortOrder: 2,
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
    allowedBillingCycles: ['MONTHLY', 'YEARLY'],
    trialEligible: true,
    trialDays: 14,
    sortOrder: 3,
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
    allowedBillingCycles: ['MONTHLY', 'YEARLY'],
    trialEligible: false,
    trialDays: 0,
    sortOrder: 4,
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

function normalizeAllowedBillingCycles(cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return ['MONTHLY', 'YEARLY'];
  }
  const normalized = [];
  for (const raw of cycles) {
    const val = String(raw || '').toUpperCase().trim();
    const mapped = val === 'ANNUAL' ? 'YEARLY' : val;
    if ((mapped === 'MONTHLY' || mapped === 'YEARLY') && !normalized.includes(mapped)) {
      normalized.push(mapped);
    }
  }
  return normalized.length > 0 ? normalized : ['MONTHLY', 'YEARLY'];
}

const planService = {
  async getAllPlans() {
    let plans = await Plan.find().sort({ sortOrder: 1, priceMonthly: 1 });
    if (!plans || plans.length === 0) {
      await this.seedDefaultPlans();
      plans = await Plan.find().sort({ sortOrder: 1, priceMonthly: 1 });
    }
    return plans;
  },

  async getPublishedPlans() {
    let plans = await Plan.find({ isActive: true, status: 'ACTIVE' }).sort({ sortOrder: 1, priceMonthly: 1 });
    if (!plans || plans.length === 0) {
      const totalPlans = await Plan.countDocuments();
      if (totalPlans === 0) {
        await this.seedDefaultPlans();
        plans = await Plan.find({ isActive: true, status: 'ACTIVE' }).sort({ sortOrder: 1, priceMonthly: 1 });
      }
    }
    return plans;
  },

  async seedDefaultPlans() {
    // Use $setOnInsert so existing Super Admin customized plan prices and states are never overwritten
    const operations = DEFAULT_PLANS.map((plan) => ({
      updateOne: {
        filter: { code: plan.code },
        update: { $setOnInsert: { ...plan, version: 1 } },
        upsert: true,
      },
    }));
    await Plan.bulkWrite(operations);
    return Plan.find().sort({ sortOrder: 1, priceMonthly: 1 });
  },

  async createPlan(data) {
    if (!data.code || !String(data.code).trim()) {
      throw new Error('Plan code is required');
    }
    const cleanCode = String(data.code).toUpperCase().trim();
    const existing = await Plan.findOne({ code: cleanCode });
    if (existing) {
      throw new Error(`Plan with code '${data.code}' already exists`);
    }

    const status = data.status ? String(data.status).toUpperCase() : data.isActive === false ? 'INACTIVE' : 'ACTIVE';
    const isActive = status === 'ACTIVE';
    const trialEligible = data.trialEligible !== undefined ? Boolean(data.trialEligible) : true;
    const trialDays = trialEligible
      ? Math.max(0, Number(data.trialDays !== undefined ? data.trialDays : 14))
      : 0;

    const plan = await Plan.create({
      ...data,
      code: cleanCode,
      status,
      isActive,
      allowedBillingCycles: normalizeAllowedBillingCycles(data.allowedBillingCycles),
      trialEligible,
      trialDays,
      sortOrder: Number(data.sortOrder) || 0,
      version: 1,
    });
    return plan;
  },

  async updatePlan(id, data) {
    const existingPlan = await Plan.findById(id);
    if (!existingPlan) throw new Error('Plan not found');

    const updateFields = { ...data };
    if (updateFields.code) {
      updateFields.code = String(updateFields.code).toUpperCase().trim();
      if (updateFields.code !== existingPlan.code) {
        const collision = await Plan.findOne({ code: updateFields.code, _id: { $ne: id } });
        if (collision) {
          throw new Error(`Plan with code '${updateFields.code}' already exists`);
        }
      }
    }

    if (updateFields.status !== undefined) {
      updateFields.status = String(updateFields.status).toUpperCase();
      updateFields.isActive = updateFields.status === 'ACTIVE';
    } else if (updateFields.isActive !== undefined) {
      updateFields.isActive = Boolean(updateFields.isActive);
      updateFields.status = updateFields.isActive
        ? 'ACTIVE'
        : existingPlan.status === 'ARCHIVED'
        ? 'ARCHIVED'
        : 'INACTIVE';
    }

    if (updateFields.allowedBillingCycles !== undefined) {
      updateFields.allowedBillingCycles = normalizeAllowedBillingCycles(updateFields.allowedBillingCycles);
    }

    if (updateFields.trialEligible !== undefined) {
      updateFields.trialEligible = Boolean(updateFields.trialEligible);
      if (!updateFields.trialEligible && updateFields.trialDays === undefined) {
        updateFields.trialDays = 0;
      }
    }

    const commercialChanged =
      (updateFields.priceMonthly !== undefined && Number(updateFields.priceMonthly) !== existingPlan.priceMonthly) ||
      (updateFields.priceYearly !== undefined && Number(updateFields.priceYearly) !== existingPlan.priceYearly) ||
      updateFields.includedFeatures !== undefined ||
      updateFields.limits !== undefined ||
      updateFields.allowedBillingCycles !== undefined ||
      updateFields.trialEligible !== undefined ||
      updateFields.trialDays !== undefined;

    const updateOp = { $set: updateFields };
    if (commercialChanged) {
      updateOp.$inc = { version: 1 };
    }

    const plan = await Plan.findByIdAndUpdate(id, updateOp, { new: true, runValidators: true });
    return plan;
  },

  async deletePlan(id) {
    const existingPlan = await Plan.findById(id);
    if (!existingPlan) throw new Error('Plan not found');

    const referencedBySub = await Subscription.exists({ planId: id });
    if (referencedBySub) {
      // Preserve historical subscription and invoice references: archive instead of deleting
      const archived = await Plan.findByIdAndUpdate(
        id,
        { status: 'ARCHIVED', isActive: false },
        { new: true }
      );
      return archived;
    }

    const plan = await Plan.findByIdAndDelete(id);
    return plan;
  },
};

module.exports = { planService, DEFAULT_PLANS, normalizeAllowedBillingCycles };
