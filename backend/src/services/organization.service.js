const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Membership = require('../models/Membership');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const OrganizationFeature = require('../models/OrganizationFeature');
const Student = require('../models/Student');
const Room = require('../models/Room');
const User = require('../models/User');
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
    const slug = (data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')).trim();
    const existing = await Organization.findOne({ slug });
    if (existing) throw new Error('Organization with this slug identifier already exists');

    // Check if admin user email is already taken
    const adminEmail = data.adminEmail ? data.adminEmail.toLowerCase().trim() : null;
    if (adminEmail) {
      const existingUser = await User.findOne({ email: adminEmail });
      if (existingUser) {
        throw new Error(`An administrator account with email '${adminEmail}' already exists`);
      }
    }

    // 1. Create Organization with KYC & Aadhaar
    const org = await Organization.create({
      name: data.name.trim(),
      legalName: data.legalName ? data.legalName.trim() : data.name.trim(),
      slug,
      contactEmail: data.contactEmail.toLowerCase().trim(),
      phone: data.phone || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
      country: data.country || 'India',
      aadhaarNumber: data.aadhaarNumber || '',
      aadhaarDocument: data.aadhaarDocument || '',
      gstin: data.gstin || '',
      pan: data.pan || '',
      orgType: data.orgType || 'Multi-Branch Chain',
      primaryColor: data.primaryColor || '#f59e0b',
      status: data.trialDays ? 'TRIAL' : 'ACTIVE',
    });

    // 2. Resolve Plan & Assign Subscription
    const planQuery = data.planId ? { _id: data.planId } : (data.planCode ? { code: data.planCode.toUpperCase() } : { code: 'STARTER' });
    const selectedPlan = await Plan.findOne(planQuery) || await Plan.findOne();
    let subscription = null;

    if (selectedPlan) {
      const now = new Date();
      const trialDays = Number(data.trialDays) || 14;
      const billingCycle = data.billingCycle || 'MONTHLY';
      
      let periodEnd = new Date(now);
      if (billingCycle === 'ANNUAL') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else if (billingCycle === 'QUARTERLY') {
        periodEnd.setMonth(periodEnd.getMonth() + 3);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (data.trialDays) {
        periodEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      }

      subscription = await Subscription.create({
        organizationId: org._id,
        planId: selectedPlan._id,
        status: data.trialDays ? 'TRIAL' : 'ACTIVE',
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });

      org.subscriptionId = subscription._id;
      await org.save();
    }

    // 3. Initialize Feature Catalog
    const featuresToEnable = selectedPlan?.includedFeatures?.length > 0 ? selectedPlan.includedFeatures : DEFAULT_FEATURES;
    const orgFeatureDocs = featuresToEnable.map((key) => ({
      organizationId: org._id,
      featureKey: key,
      enabled: true,
    }));
    if (orgFeatureDocs.length > 0) {
      await OrganizationFeature.insertMany(orgFeatureDocs);
    }

    // 4. Create First Property / Branch Hostel with Amenities & Policy
    const branchCode = (data.branchCode || 'MAIN').toUpperCase().trim();
    const mainHostel = await Hostel.create({
      organizationId: org._id,
      name: data.branchName ? data.branchName.trim() : `${data.name} - Main Branch`,
      code: branchCode,
      address: data.propertyAddress || data.address || '',
      capacity: Number(data.capacity) || 100,
      floors: Number(data.floors) || 1,
      totalRooms: Number(data.totalRooms) || 10,
      genderType: data.genderType || 'GIRLS',
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      contactPhone: data.wardenPhone || data.phone || '',
      contactEmail: data.contactEmail || '',
      wardenName: data.wardenName || '',
      wardenPhone: data.wardenPhone || '',
      emergencyContact: data.emergencyContact || '',
      status: 'ACTIVE',
      settings: {
        lateFeePerDay: Number(data.lateFeePerDay) || 20,
        gracePeriodDays: Number(data.gracePeriodDays) || 5,
        laundrySlotsPerDay: 1,
        monthlyRentDueDay: Number(data.monthlyRentDueDay) || 5,
        securityDeposit: Number(data.securityDeposit) || 5000,
        hasMess: data.hasMess !== false,
        messOffNoticeHours: Number(data.messOffNoticeHours) || 24,
        messRebatePerDay: Number(data.messRebatePerDay) || 120,
        laundrySlotsPerWeek: Number(data.laundrySlotsPerWeek) || 2,
        curfewTime: data.curfewTime || '21:30',
        parentConsentRequired: data.parentConsentRequired !== false,
      },
    });

    // 5. Create Primary Administrator Account & Organization Owner Membership
    let adminUser = null;
    if (adminEmail && data.adminPassword) {
      adminUser = await User.create({
        name: data.adminName ? data.adminName.trim() : `${data.name} Administrator`,
        email: adminEmail,
        username: data.adminUsername ? data.adminUsername.trim() : adminEmail.split('@')[0],
        password: data.adminPassword,
        role: 'admin',
        activeOrganizationId: org._id,
        activeHostelId: mainHostel._id,
        hostels: [mainHostel.code],
        isActive: true,
      });

      await Membership.create({
        userId: adminUser._id,
        organizationId: org._id,
        role: 'ORGANIZATION_OWNER',
        hostelAccess: ['all'],
        status: 'ACTIVE',
      });
    }

    // Link creator user if super admin
    if (creatorUserId && (!adminUser || String(creatorUserId) !== String(adminUser._id))) {
      await Membership.create({
        userId: creatorUserId,
        organizationId: org._id,
        role: 'SUPER_ADMIN',
        hostelAccess: ['all'],
        status: 'ACTIVE',
      }).catch(() => {});
    }

    return {
      organization: org,
      hostel: mainHostel,
      subscription,
      adminUser,
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
