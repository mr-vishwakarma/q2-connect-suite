const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Membership = require('../models/Membership');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const OrganizationFeature = require('../models/OrganizationFeature');
const Student = require('../models/Student');
const Room = require('../models/Room');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { DEFAULT_FEATURES } = require('../constants/saas.constants');
const {
  getPublishedPlanOrFail,
  validatePlanAndCycle,
  getPlanPriceForCycle,
  buildPricingSnapshot,
  syncOrganizationFeatures,
  buildHistoryEntry,
  evaluateNearExpiry,
  getNearExpiryThresholdDays,
} = require('./subscriptionLifecycle.service');
const { calculateSubscriptionPeriod } = require('../utils/subscriptionPeriod');

const organizationService = {
  async getAllOrganizations(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.search) {
      const searchRegex = { $regex: query.search.trim(), $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { slug: searchRegex },
        { contactEmail: searchRegex },
      ];
    }

    const [organizations, total] = await Promise.all([
      Organization.find(filter)
        .populate({
          path: 'subscriptionId',
          populate: {
            path: 'planId',
            select: 'name code priceMonthly priceYearly limits trialEligible trialDays',
          },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Organization.countDocuments(filter),
    ]);

    if (organizations.length === 0) {
      return {
        organizations: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const orgIds = organizations.map((o) => o._id);

    // High-performance batch aggregation scoped only to the current page
    const [hostelGroups, studentGroups, roomGroups] = await Promise.all([
      Hostel.aggregate([
        { $match: { organizationId: { $in: orgIds }, isDeleted: false } },
        { $group: { _id: '$organizationId', count: { $sum: 1 } } },
      ]),
      Student.aggregate([
        { $match: { organizationId: { $in: orgIds }, isActive: true } },
        { $group: { _id: '$organizationId', count: { $sum: 1 } } },
      ]),
      Room.aggregate([
        { $match: { organizationId: { $in: orgIds } } },
        { $group: { _id: '$organizationId', count: { $sum: 1 } } },
      ]),
    ]);

    const hostelMap = new Map(hostelGroups.map((g) => [String(g._id), g.count]));
    const studentMap = new Map(studentGroups.map((g) => [String(g._id), g.count]));
    const roomMap = new Map(roomGroups.map((g) => [String(g._id), g.count]));

    const orgsWithMetrics = organizations.map((org) => {
      const orgIdStr = String(org._id);
      const sub = org.subscriptionId;
      const plan = sub?.planId;
      const snap = sub?.pricingSnapshot;
      return {
        ...org,
        id: org._id,
        hostelCount: hostelMap.get(orgIdStr) || 0,
        studentCount: studentMap.get(orgIdStr) || 0,
        roomCount: roomMap.get(orgIdStr) || 0,
        subscriptionSummary: sub
          ? {
              status: sub.status,
              activationMethod: sub.activationMethod || 'PENDING',
              billingCycle: snap?.billingCycle || sub.billingCycle,
              planId: plan?._id || snap?.planId,
              planName: snap?.planName || plan?.name || null,
              planCode: snap?.planCode || plan?.code || null,
              agreedPriceRupees:
                snap?.agreedPriceRupees ??
                sub.agreedPriceRupees ??
                sub.amount ??
                null,
              currentPeriodEnd: sub.currentPeriodEnd,
              trialEndsAt: sub.trialEndsAt,
            }
          : null,
      };
    });

    return {
      organizations: orgsWithMetrics,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getOrganizationById(id) {
    const org = await Organization.findById(id).populate({
      path: 'subscriptionId',
      populate: { path: 'planId' },
    });
    if (!org) throw new Error('Organization not found');

    const [hostels, memberships, features, subscription, studentCount, roomCount, thresholdDays] =
      await Promise.all([
        Hostel.find({ organizationId: id, isDeleted: false }),
        Membership.find({ organizationId: id }).populate('userId', 'name email username'),
        OrganizationFeature.find({ organizationId: id }),
        Subscription.findOne({ organizationId: id }).populate('planId'),
        Student.countDocuments({ organizationId: id, isActive: true }),
        Room.countDocuments({ organizationId: id }),
        getNearExpiryThresholdDays(),
      ]);

    const subObj = subscription
      ? {
          ...subscription.toObject(),
          nearExpiry: evaluateNearExpiry(subscription, thresholdDays),
        }
      : null;

    return {
      ...org.toObject(),
      id: org._id,
      hostels,
      memberships,
      features,
      subscription: subObj,
      studentCount,
      roomCount,
    };
  },

  async createOrganization(data, creatorUserId) {
    if (!data.name || !data.name.trim()) {
      throw new Error('Organization name is required');
    }
    if (!data.contactEmail || !data.contactEmail.trim()) {
      throw new Error('Official contact email is required');
    }

    // Validate Plan & Billing Frequency strictly BEFORE creating any tenant/user records
    const selectedPlan = await getPublishedPlanOrFail(
      { planId: data.planId, planCode: data.planCode },
      { requirePublished: true }
    );
    const billingCycle = validatePlanAndCycle({
      plan: selectedPlan,
      billingCycle: data.billingCycle || 'MONTHLY',
    });

    const requestedMode = String(data.activationMode || '').toUpperCase().trim();
    const isTrialRequested =
      requestedMode === 'FREE_TRIAL' ||
      (!requestedMode && data.trialDays !== undefined && Number(data.trialDays) > 0);

    let trialDays = 0;
    if (isTrialRequested) {
      if (selectedPlan.trialEligible === false) {
        const err = new Error(
          `Free trial is not permitted for plan '${selectedPlan.name}'. Please activate via Online Payment or Voucher.`
        );
        err.statusCode = 400;
        err.code = 'TRIAL_NOT_ELIGIBLE';
        throw err;
      }
      trialDays =
        data.trialDays !== undefined && Number(data.trialDays) > 0
          ? Number(data.trialDays)
          : Number(selectedPlan.trialDays || 14);
      if (trialDays <= 0) {
        trialDays = 14;
      }
    }

    const slug = (data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')).trim();
    const existing = await Organization.findOne({ slug });
    if (existing) {
      throw new Error(`Organization with slug identifier '${slug}' already exists`);
    }

    // Check if admin user email or username is already taken
    const adminEmail = data.adminEmail ? data.adminEmail.toLowerCase().trim() : null;
    if (!adminEmail) {
      throw new Error('Administrator login email is required');
    }
    const adminUsername = (data.adminUsername || adminEmail.split('@')[0]).trim();

    const existingAdminUser = await User.findOne({
      $or: [{ email: adminEmail }, { username: adminUsername }],
    });
    if (existingAdminUser) {
      if (existingAdminUser.email === adminEmail) {
        throw new Error(`An administrator account with email '${adminEmail}' already exists`);
      }
      throw new Error(`Username '${adminUsername}' is already taken`);
    }

    // Check Warden details if provided in onboarding
    const wardenName = data.wardenName && data.wardenName.trim() ? data.wardenName.trim() : null;
    const branchCode = (data.branchCode || 'MAIN').toUpperCase().trim();

    let wardenEmail = data.wardenEmail ? data.wardenEmail.toLowerCase().trim() : null;
    let wardenUsername = data.wardenUsername ? data.wardenUsername.trim() : null;

    if (wardenName) {
      if (!wardenEmail) {
        wardenEmail = `warden_${branchCode.toLowerCase()}.${Date.now().toString(36)}@${slug}.hosteliq.internal`;
      }
      if (!wardenUsername) {
        wardenUsername = `warden_${branchCode.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`;
      }

      const existingWarden = await User.findOne({
        $or: [{ email: wardenEmail }, { username: wardenUsername }],
      });
      if (existingWarden) {
        if (existingWarden.email === wardenEmail) {
          throw new Error(`A user account with email '${wardenEmail}' already exists`);
        }
        throw new Error(`Warden username '${wardenUsername}' is already taken`);
      }
    }

    // 1. Create Organization with KYC & Aadhaar
    const initialOrgStatus = isTrialRequested ? 'TRIAL' : 'PENDING_PAYMENT';
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
      status: initialOrgStatus,
    });

    // 2. Create Authoritative Subscription with Exact Selected Plan & Immutable Pricing Snapshot
    const now = new Date();
    const catalogPrice = getPlanPriceForCycle(selectedPlan, billingCycle);
    const snapshot = buildPricingSnapshot({
      plan: selectedPlan,
      billingCycle,
      agreedPriceRupees: catalogPrice,
      finalPayableRupees: catalogPrice,
      source: isTrialRequested ? 'ONBOARDING_FREE_TRIAL' : 'ONBOARDING',
    });

    let periodStart = now;
    let periodEnd;
    let trialStartsAt = undefined;
    let trialEndsAt = undefined;

    if (isTrialRequested) {
      trialStartsAt = now;
      trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      periodEnd = trialEndsAt;
    } else {
      const calc = calculateSubscriptionPeriod({
        activationDate: now,
        billingCycle,
        durationCycles: 1,
      });
      periodStart = calc.periodStart;
      periodEnd = calc.periodEnd;
    }

    const subStatus = isTrialRequested ? 'TRIAL' : 'PENDING_PAYMENT';
    const activationMethod = isTrialRequested ? 'FREE_TRIAL' : 'PENDING';

    const subscription = await Subscription.create({
      organizationId: org._id,
      planId: selectedPlan._id,
      status: subStatus,
      activationMethod,
      billingCycle,
      renewalMode: 'MANUAL',
      autoRenew: false,
      agreedPriceRupees: catalogPrice,
      amount: isTrialRequested ? 0 : catalogPrice,
      amountPaise: isTrialRequested ? 0 : Math.round(catalogPrice * 100),
      currency: (selectedPlan.currency || 'INR').toUpperCase(),
      pricingSnapshot: snapshot,
      startedAt: isTrialRequested ? now : undefined,
      trialStartsAt,
      trialEndsAt,
      trialUsed: isTrialRequested,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      history: [
        buildHistoryEntry({
          eventType: isTrialRequested ? 'TRIAL_STARTED' : 'ONBOARDING_SUBSCRIPTION_CREATED',
          toStatus: subStatus,
          toPlanId: selectedPlan._id,
          toPlanName: selectedPlan.name,
          billingCycle,
          amountRupees: isTrialRequested ? 0 : catalogPrice,
          activationMethod,
          actor: creatorUserId ? { _id: creatorUserId } : null,
          notes: isTrialRequested
            ? `Onboarded with ${trialDays}-day free trial on ${selectedPlan.name} (${billingCycle})`
            : `Onboarded with ${selectedPlan.name} (${billingCycle}); awaiting payment or voucher activation`,
        }),
      ],
    });

    org.subscriptionId = subscription._id;
    await org.save();

    // 3. Initialize Feature Catalog synced strictly to selected plan
    const featuresToEnable =
      selectedPlan.includedFeatures?.length > 0 ? selectedPlan.includedFeatures : DEFAULT_FEATURES;
    await syncOrganizationFeatures(org._id, featuresToEnable, {
      enabled: isTrialRequested,
    });

    // 4. Create First Property / Branch Hostel with Amenities & Policy
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
      wardenName: wardenName || '',
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

    // Initialize hostel operational settings document (Living Operations & Rules)
    await Settings.findOneAndUpdate(
      { organizationId: org._id, hostel: branchCode },
      {
        $setOnInsert: {
          organizationId: org._id,
          hostelId: mainHostel._id,
          hostel: branchCode,
          lateFeePerDay: Number(data.lateFeePerDay) || 20,
          gracePeriodDays: Number(data.gracePeriodDays) || 5,
          monthlyRentDueDay: Number(data.monthlyRentDueDay) || 5,
          securityDeposit: Number(data.securityDeposit) || 5000,
          curfewTime: data.curfewTime || '21:30',
          weeklyLaundrySlots: Number(data.laundrySlotsPerWeek) || 2,
          laundrySlotsPerWeek: Number(data.laundrySlotsPerWeek) || 2,
        },
      },
      { upsert: true, new: true }
    );

    // 5. Create Primary Administrator Account (Secure Token + No Plaintext Password)
    const crypto = require('crypto');
    const rawAdminToken = crypto.randomBytes(32).toString('hex');
    const hashedAdminToken = crypto.createHash('sha256').update(rawAdminToken).digest('hex');
    const activationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const randomAdminTempPassword = crypto.randomBytes(24).toString('hex') + 'A1!';

    const adminUser = await User.create({
      name: data.adminName ? data.adminName.trim() : `${data.name} Administrator`,
      email: adminEmail,
      username: adminUsername,
      password: randomAdminTempPassword,
      phone: data.adminPhone || data.phone || '',
      role: 'admin',
      isPrimaryAdmin: true,
      isSuperAdmin: false,
      activeOrganizationId: org._id,
      activeHostelId: mainHostel._id,
      hostels: [mainHostel.code],
      status: 'INVITED',
      isActive: true,
      mustChangePassword: true,
      activationToken: hashedAdminToken,
      activationExpires,
      invitationEmailStatus: 'pending',
    });

    await Membership.create({
      userId: adminUser._id,
      organizationId: org._id,
      role: 'ORGANIZATION_OWNER',
      hostelAccess: ['all', mainHostel.code, mainHostel._id.toString()],
      status: 'ACTIVE',
    });

    // 6. Create Warden Account if Warden details are provided
    let wardenUser = null;
    let rawWardenToken = null;

    if (wardenName) {
      rawWardenToken = crypto.randomBytes(32).toString('hex');
      const hashedWardenToken = crypto.createHash('sha256').update(rawWardenToken).digest('hex');
      const randomWardenTempPassword = crypto.randomBytes(24).toString('hex') + 'W1!';

      wardenUser = await User.create({
        name: wardenName,
        email: wardenEmail,
        username: wardenUsername,
        password: randomWardenTempPassword,
        phone: data.wardenPhone ? data.wardenPhone.trim() : '',
        role: 'warden',
        isPrimaryAdmin: false,
        isSuperAdmin: false,
        activeOrganizationId: org._id,
        activeHostelId: mainHostel._id,
        hostels: [mainHostel.code],
        status: 'INVITED',
        isActive: true,
        mustChangePassword: true,
        activationToken: hashedWardenToken,
        activationExpires,
        invitationEmailStatus: 'pending',
      });

      await Membership.create({
        userId: wardenUser._id,
        organizationId: org._id,
        role: 'WARDEN',
        hostelAccess: [mainHostel.code, mainHostel._id.toString()],
        status: 'ACTIVE',
      });
    }

    // 7. Dispatch Account Invitations & Record Delivery Status
    const {
      sendHostelOnboardingWelcomeEmail,
      sendWardenInvitationToAdminEmail,
      getTrustedFrontendUrl,
    } = require('../utils/email');

    const frontendUrl = getTrustedFrontendUrl();
    const adminActivationLink = `${frontendUrl}/reset-password?token=${rawAdminToken}&type=activation`;
    const loginLink = `${frontendUrl}/login?role=admin`;

    try {
      const adminMailResult = await sendHostelOnboardingWelcomeEmail({
        to: adminUser.email,
        name: adminUser.name,
        username: adminUser.username,
        orgName: org.name,
        branchName: mainHostel.name,
        role: 'Organization Owner & Administrator',
        activationLink: adminActivationLink,
        loginLink,
        correlationId: `onboard-admin-${adminUser._id}-${Date.now()}`,
      });

      if (adminMailResult) {
        adminUser.invitationEmailStatus = 'sent';
        adminUser.invitationEmailSentAt = new Date();
        adminUser.invitationEmailError = null;
      } else {
        adminUser.invitationEmailStatus = 'failed';
        adminUser.invitationEmailError = 'Email delivery transport returned unconfirmed status';
      }
    } catch (emailErr) {
      adminUser.invitationEmailStatus = 'failed';
      adminUser.invitationEmailError = emailErr.message;
    }
    await adminUser.save();

    if (wardenUser && rawWardenToken) {
      const wardenActivationLink = `${frontendUrl}/reset-password?token=${rawWardenToken}&type=activation`;
      try {
        const wardenMailResult = await sendWardenInvitationToAdminEmail({
          adminEmail: adminUser.email,
          adminName: adminUser.name,
          wardenName: wardenUser.name,
          wardenEmail: wardenUser.email,
          wardenUsername: wardenUser.username,
          wardenPhone: wardenUser.phone,
          branchName: mainHostel.name,
          orgName: org.name,
          activationLink: wardenActivationLink,
          loginLink,
          correlationId: `onboard-warden-${wardenUser._id}-${Date.now()}`,
        });

        if (wardenMailResult) {
          wardenUser.invitationEmailStatus = 'sent';
          wardenUser.invitationEmailSentAt = new Date();
          wardenUser.invitationEmailError = null;
        } else {
          wardenUser.invitationEmailStatus = 'failed';
          wardenUser.invitationEmailError = 'Email delivery transport returned unconfirmed status';
        }
      } catch (wEmailErr) {
        wardenUser.invitationEmailStatus = 'failed';
        wardenUser.invitationEmailError = wEmailErr.message;
      }
      await wardenUser.save();
    }

    // 8. Link creator user if super admin
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
      adminAccount: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        username: adminUser.username,
        role: adminUser.role,
        status: adminUser.status,
        invitationEmailStatus: adminUser.invitationEmailStatus,
        invitationEmailSentAt: adminUser.invitationEmailSentAt,
        invitationEmailError: adminUser.invitationEmailError,
      },
      wardenAccount: wardenUser ? {
        id: wardenUser._id,
        name: wardenUser.name,
        email: wardenUser.email,
        username: wardenUser.username,
        role: wardenUser.role,
        status: wardenUser.status,
        invitationEmailStatus: wardenUser.invitationEmailStatus,
        invitationEmailSentAt: wardenUser.invitationEmailSentAt,
        invitationEmailError: wardenUser.invitationEmailError,
      } : null,
    };
  },

  async resendInvitation(userId) {
    const crypto = require('crypto');
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.status === 'ACTIVE' && !user.activationToken) {
      return {
        alreadyActive: true,
        message: 'This account has already completed activation and established its password.',
        user,
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const activationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    user.activationToken = hashedToken;
    user.activationExpires = activationExpires;
    user.invitationEmailStatus = 'pending';
    user.invitationEmailError = null;
    await user.save();

    const {
      sendHostelOnboardingWelcomeEmail,
      sendWardenInvitationToAdminEmail,
      getTrustedFrontendUrl,
    } = require('../utils/email');

    const frontendUrl = getTrustedFrontendUrl();
    const activationLink = `${frontendUrl}/reset-password?token=${rawToken}&type=activation`;
    const loginLink = `${frontendUrl}/login?role=admin`;

    const org = user.activeOrganizationId ? await Organization.findById(user.activeOrganizationId) : null;
    const orgName = org ? org.name : 'Hosteliq';

    const hostel = user.activeHostelId ? await Hostel.findById(user.activeHostelId) : (org ? await Hostel.findOne({ organizationId: org._id }) : null);
    const branchName = hostel ? hostel.name : 'Hostel Branch';

    let emailSent = false;

    if (user.role === 'admin') {
      try {
        const res = await sendHostelOnboardingWelcomeEmail({
          to: user.email,
          name: user.name,
          username: user.username,
          orgName,
          branchName,
          role: 'Organization Owner & Administrator',
          activationLink,
          loginLink,
          correlationId: `resend-admin-${user._id}-${Date.now()}`,
        });
        if (res) {
          user.invitationEmailStatus = 'sent';
          user.invitationEmailSentAt = new Date();
          user.invitationEmailError = null;
          emailSent = true;
        } else {
          user.invitationEmailStatus = 'failed';
          user.invitationEmailError = 'Email transport returned unconfirmed status';
        }
      } catch (err) {
        user.invitationEmailStatus = 'failed';
        user.invitationEmailError = err.message;
      }
    } else if (user.role === 'warden') {
      // Find primary admin to send the forwardable invitation
      const primaryAdmin = await User.findOne({
        activeOrganizationId: user.activeOrganizationId,
        role: 'admin',
        isPrimaryAdmin: true,
      }) || await User.findOne({
        activeOrganizationId: user.activeOrganizationId,
        role: 'admin',
      });

      const recipientEmail = primaryAdmin ? primaryAdmin.email : user.email;
      const recipientName = primaryAdmin ? primaryAdmin.name : 'Hostel Administrator';

      try {
        const res = await sendWardenInvitationToAdminEmail({
          adminEmail: recipientEmail,
          adminName: recipientName,
          wardenName: user.name,
          wardenEmail: user.email,
          wardenUsername: user.username,
          wardenPhone: user.phone,
          branchName,
          orgName,
          activationLink,
          loginLink,
          correlationId: `resend-warden-${user._id}-${Date.now()}`,
        });
        if (res) {
          user.invitationEmailStatus = 'sent';
          user.invitationEmailSentAt = new Date();
          user.invitationEmailError = null;
          emailSent = true;
        } else {
          user.invitationEmailStatus = 'failed';
          user.invitationEmailError = 'Email transport returned unconfirmed status';
        }
      } catch (err) {
        user.invitationEmailStatus = 'failed';
        user.invitationEmailError = err.message;
      }
    }

    await user.save();

    return {
      success: emailSent,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        invitationEmailStatus: user.invitationEmailStatus,
        invitationEmailSentAt: user.invitationEmailSentAt,
        invitationEmailError: user.invitationEmailError,
      },
    };
  },

  async provisionWardenForHostel(hostelId, wardenData) {
    const crypto = require('crypto');
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) throw new Error('Hostel branch not found');

    const org = await Organization.findById(hostel.organizationId);
    if (!org) throw new Error('Associated organization not found');

    const wardenName = wardenData.name && wardenData.name.trim() ? wardenData.name.trim() : null;
    if (!wardenName) throw new Error('Warden name is required');

    let wardenEmail = wardenData.email ? wardenData.email.toLowerCase().trim() : null;
    let wardenUsername = wardenData.username ? wardenData.username.trim() : null;

    if (!wardenEmail) {
      wardenEmail = `warden_${hostel.code.toLowerCase()}.${Date.now().toString(36)}@${org.slug}.hosteliq.internal`;
    }
    if (!wardenUsername) {
      wardenUsername = `warden_${hostel.code.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const existing = await User.findOne({
      $or: [{ email: wardenEmail }, { username: wardenUsername }],
    });
    if (existing) {
      if (existing.email === wardenEmail) throw new Error(`A user account with email '${wardenEmail}' already exists`);
      throw new Error(`Username '${wardenUsername}' is already taken`);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const activationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const randomTempPassword = crypto.randomBytes(24).toString('hex') + 'W1!';

    const wardenUser = await User.create({
      name: wardenName,
      email: wardenEmail,
      username: wardenUsername,
      password: randomTempPassword,
      phone: wardenData.phone ? wardenData.phone.trim() : '',
      role: 'warden',
      isPrimaryAdmin: false,
      isSuperAdmin: false,
      activeOrganizationId: org._id,
      activeHostelId: hostel._id,
      hostels: [hostel.code],
      status: 'INVITED',
      isActive: true,
      mustChangePassword: true,
      activationToken: hashedToken,
      activationExpires,
      invitationEmailStatus: 'pending',
    });

    await Membership.create({
      userId: wardenUser._id,
      organizationId: org._id,
      role: 'WARDEN',
      hostelAccess: [hostel.code, hostel._id.toString()],
      status: 'ACTIVE',
    });

    // Update hostel with warden info
    hostel.wardenName = wardenName;
    if (wardenData.phone) hostel.wardenPhone = wardenData.phone.trim();
    await hostel.save();

    // Send invitation to Primary Admin
    const primaryAdmin = await User.findOne({
      activeOrganizationId: org._id,
      role: 'admin',
      isPrimaryAdmin: true,
    }) || await User.findOne({
      activeOrganizationId: org._id,
      role: 'admin',
    });

    const recipientEmail = primaryAdmin ? primaryAdmin.email : wardenEmail;
    const recipientName = primaryAdmin ? primaryAdmin.name : 'Hostel Administrator';

    const {
      sendWardenInvitationToAdminEmail,
      getTrustedFrontendUrl,
    } = require('../utils/email');

    const frontendUrl = getTrustedFrontendUrl();
    const activationLink = `${frontendUrl}/reset-password?token=${rawToken}&type=activation`;
    const loginLink = `${frontendUrl}/login?role=admin`;

    try {
      const res = await sendWardenInvitationToAdminEmail({
        adminEmail: recipientEmail,
        adminName: recipientName,
        wardenName: wardenUser.name,
        wardenEmail: wardenUser.email,
        wardenUsername: wardenUser.username,
        wardenPhone: wardenUser.phone,
        branchName: hostel.name,
        orgName: org.name,
        activationLink,
        loginLink,
        correlationId: `provision-warden-${wardenUser._id}-${Date.now()}`,
      });
      if (res) {
        wardenUser.invitationEmailStatus = 'sent';
        wardenUser.invitationEmailSentAt = new Date();
        wardenUser.invitationEmailError = null;
      } else {
        wardenUser.invitationEmailStatus = 'failed';
        wardenUser.invitationEmailError = 'Email transport returned unconfirmed status';
      }
    } catch (err) {
      wardenUser.invitationEmailStatus = 'failed';
      wardenUser.invitationEmailError = err.message;
    }
    await wardenUser.save();

    return {
      wardenAccount: {
        id: wardenUser._id,
        name: wardenUser.name,
        email: wardenUser.email,
        username: wardenUser.username,
        role: wardenUser.role,
        status: wardenUser.status,
        invitationEmailStatus: wardenUser.invitationEmailStatus,
        invitationEmailSentAt: wardenUser.invitationEmailSentAt,
        invitationEmailError: wardenUser.invitationEmailError,
      },
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

    if (isSuspended) {
      // Immediate security enforcement: revoke all active refresh tokens for all users in this tenant
      await User.updateMany({ activeOrganizationId: id }, { $set: { refreshTokens: [] } });
      // Deactivate associated hostel branches
      await Hostel.updateMany({ organizationId: id }, { $set: { status: 'INACTIVE' } });
    } else {
      // Reactivate associated hostel branches
      await Hostel.updateMany({ organizationId: id, status: 'INACTIVE' }, { $set: { status: 'ACTIVE' } });
    }

    return org;
  },
};

module.exports = { organizationService };
