const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Membership = require('../models/Membership');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const OrganizationFeature = require('../models/OrganizationFeature');
const Student = require('../models/Student');
const Room = require('../models/Room');
const { DEFAULT_FEATURES } = require('../constants/saas.constants');

const organizationService = {
  async getAllOrganizations(query = {}) {
    const filter = { isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { slug: { $regex: query.search, $options: 'i' } },
        { contactEmail: { $regex: query.search, $options: 'i' } },
      ];
    }

    const organizations = await Organization.find(filter)
      .populate('subscriptionId')
      .sort({ createdAt: -1 });

    // Aggregate counts for each organization
    const orgsWithMetrics = await Promise.all(
      organizations.map(async (org) => {
        const hostelCount = await Hostel.countDocuments({ organizationId: org._id, isDeleted: false });
        const studentCount = await Student.countDocuments({ organizationId: org._id, isActive: true });
        const roomCount = await Room.countDocuments({ organizationId: org._id });
        return {
          ...org.toObject(),
          id: org._id,
          hostelCount,
          studentCount,
          roomCount,
        };
      })
    );

    return orgsWithMetrics;
  },

  async getOrganizationById(id) {
    const org = await Organization.findById(id).populate('subscriptionId');
    if (!org) throw new Error('Organization not found');

    const hostels = await Hostel.find({ organizationId: id, isDeleted: false });
    const memberships = await Membership.find({ organizationId: id }).populate('userId', 'name email username');
    const features = await OrganizationFeature.find({ organizationId: id });
    const subscription = await Subscription.findOne({ organizationId: id }).populate('planId');

    const studentCount = await Student.countDocuments({ organizationId: id, isActive: true });
    const roomCount = await Room.countDocuments({ organizationId: id });

    return {
      ...org.toObject(),
      id: org._id,
      hostels,
      memberships,
      features,
      subscription,
      studentCount,
      roomCount,
    };
  },

  async createOrganization(data, creatorUserId) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const existing = await Organization.findOne({ slug });
    if (existing) throw new Error('Organization with this slug already exists');

    const org = await Organization.create({
      name: data.name,
      slug,
      contactEmail: data.contactEmail,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country || 'India',
      status: 'ACTIVE',
    });

    // Default Starter Plan assignment
    const defaultPlan = await Plan.findOne({ code: 'STARTER' }) || await Plan.findOne();
    let subscription = null;
    if (defaultPlan) {
      const now = new Date();
      const nextMonth = new Date(now.setMonth(now.getMonth() + 1));
      subscription = await Subscription.create({
        organizationId: org._id,
        planId: defaultPlan._id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextMonth,
      });
      org.subscriptionId = subscription._id;
      await org.save();
    }

    // Initialize Default Features
    const defaultFeaturesToEnable = defaultPlan?.includedFeatures?.length > 0 ? defaultPlan.includedFeatures : DEFAULT_FEATURES;
    const orgFeatureDocs = defaultFeaturesToEnable.map((key) => ({
      organizationId: org._id,
      featureKey: key,
      enabled: true,
    }));
    if (orgFeatureDocs.length > 0) {
      await OrganizationFeature.insertMany(orgFeatureDocs);
    }

    // Default Main Branch Hostel
    const mainHostel = await Hostel.create({
      organizationId: org._id,
      name: `${data.name} - Main Branch`,
      code: 'MAIN',
      address: data.address || '',
      capacity: 100,
      genderType: data.genderType || 'GIRLS',
      status: 'ACTIVE',
    });

    // Create Membership for creator/admin if provided
    if (creatorUserId) {
      await Membership.create({
        userId: creatorUserId,
        organizationId: org._id,
        role: 'ORGANIZATION_OWNER',
        hostelAccess: ['all'],
        status: 'ACTIVE',
      });
    }

    return {
      organization: org,
      hostel: mainHostel,
      subscription,
    };
  },

  async updateOrganization(id, data) {
    const org = await Organization.findByIdAndUpdate(id, data, { new: true });
    if (!org) throw new Error('Organization not found');
    return org;
  },

  async suspendOrganization(id, isSuspended = true) {
    const org = await Organization.findByIdAndUpdate(
      id,
      { status: isSuspended ? 'SUSPENDED' : 'ACTIVE' },
      { new: true }
    );
    if (!org) throw new Error('Organization not found');
    return org;
  },
};

module.exports = { organizationService };
