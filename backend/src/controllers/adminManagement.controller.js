const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Membership = require('../models/Membership');
const Hostel = require('../models/Hostel');
const AdminOtp = require('../models/AdminOtp');
const AuditLog = require('../models/AuditLog');
const { sendAdminActionOtpEmail, sendSecondaryAdminWelcomeEmail } = require('../utils/email');

/**
 * Helper: Check if user is Primary Admin for the given organization
 */
const isUserPrimaryAdmin = async (user, organizationId) => {
  if (!user) return false;
  if (user.isSuperAdmin || user.role === 'super_admin') return true;
  if (user.isPrimaryAdmin === true) return true;

  // Check Membership in the organization
  if (organizationId) {
    const mem = await Membership.findOne({
      userId: user._id,
      organizationId,
      status: 'ACTIVE',
    }).lean();

    if (mem && ['ORGANIZATION_OWNER', 'SUPER_ADMIN'].includes(mem.role)) {
      return true;
    }
  }

  // Canonical bootstrap accounts fallback
  if (user.email === 'abhi1006@q2connect.com' || user.username?.toLowerCase() === 'abhi1006') {
    return true;
  }

  return false;
};

/**
 * Helper: Record security audit event
 */
const logAdminAuditEvent = async ({
  req,
  action,
  entityId,
  entityType = 'ADMIN_USER',
  description,
  oldValue,
  newValue,
  result = 'SUCCESS',
}) => {
  try {
    await AuditLog.create({
      organizationId: req.organizationId || req.tenant?.organizationId || null,
      hostelId: req.tenant?.hostelId || null,
      actorId: req.user._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action,
      entityType,
      entityId: entityId ? entityId.toString() : undefined,
      description,
      oldValue,
      newValue,
      result,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '',
      userAgent: req.headers?.['user-agent'] || '',
    });
  } catch (err) {
    console.error('Failed to write admin audit log:', err.message);
  }
};

/**
 * @desc    Get all admins for authenticated tenant (organization & hostel scoped)
 * @route   GET /api/admins
 * @access  Private (Admin only)
 */
const getAdmins = async (req, res) => {
  try {
    const orgId = req.organizationId;
    if (!orgId && !req.tenant?.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Tenant organization context required to list admins',
      });
    }

    const isCallerPrimary = await isUserPrimaryAdmin(req.user, orgId);

    // Build tenant-isolated query
    let query = { role: 'admin' };

    if (!req.tenant?.isSuperAdmin) {
      // Find all memberships in this organization
      const memberships = await Membership.find({
        organizationId: orgId,
        status: { $in: ['ACTIVE', 'INVITED'] },
      }).lean();

      const memberUserIds = memberships.map((m) => m.userId);

      query.$or = [
        { activeOrganizationId: orgId },
        { _id: { $in: memberUserIds } },
      ];

      // Optional hostel branch filter
      const requestedHostelId = req.headers['x-hostel-id'] || req.query?.hostelId;
      if (requestedHostelId && mongoose.Types.ObjectId.isValid(requestedHostelId)) {
        // Filter memberships that have access to this hostel or 'all'
        const hostelMemberships = memberships.filter(
          (m) =>
            m.hostelAccess?.includes('all') ||
            m.hostelAccess?.some((h) => h.toString() === requestedHostelId.toString())
        );
        const hostelUserIds = hostelMemberships.map((m) => m.userId);

        query = {
          role: 'admin',
          $or: [
            { activeOrganizationId: orgId, activeHostelId: requestedHostelId },
            { _id: { $in: hostelUserIds } },
          ],
        };
      }
    }

    const admins = await User.find(query)
      .select('-password -refreshTokens -activationToken -resetPasswordToken')
      .sort({ isPrimaryAdmin: -1, createdAt: -1 })
      .lean();

    // Map each admin to identify primary status definitively
    const mapped = await Promise.all(
      admins.map(async (u) => {
        const isPrimary =
          u.isPrimaryAdmin === true ||
          u.email === 'abhi1006@q2connect.com' ||
          u.username?.toLowerCase() === 'abhi1006' ||
          (await Membership.exists({
            userId: u._id,
            organizationId: orgId,
            role: 'ORGANIZATION_OWNER',
          }));

        return {
          id: u._id.toString(),
          user_id: u._id.toString(),
          name: u.name,
          username: u.username || u.name,
          email: u.email,
          phone: u.phone || '',
          role: u.role,
          status: u.status || (u.isActive ? 'ACTIVE' : 'DEACTIVATED'),
          is_primary: Boolean(isPrimary),
          isPrimaryAdmin: Boolean(isPrimary),
          hostels: u.hostels || [],
          invitationEmailStatus: u.invitationEmailStatus || (u.status === 'INVITED' ? 'pending' : 'sent'),
          invitationEmailError: u.invitationEmailError || null,
          invitationEmailSentAt: u.invitationEmailSentAt || null,
          created_at: u.createdAt,
        };
      })
    );

    // Primary admins first
    mapped.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

    return res.status(200).json({
      success: true,
      data: mapped,
      isCallerPrimaryAdmin: Boolean(isCallerPrimary),
    });
  } catch (error) {
    console.error('Error in getAdmins:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Request email OTP to create a new Secondary Admin
 * @route   POST /api/admins/request-create-otp
 * @access  Private (Primary Admin only)
 */
const requestCreateAdminOtp = async (req, res) => {
  try {
    const orgId = req.organizationId;
    const isPrimary = await isUserPrimaryAdmin(req.user, orgId);

    if (!isPrimary) {
      await logAdminAuditEvent({
        req,
        action: 'CREATE_ADMIN_UNAUTHORIZED_ATTEMPT',
        description: 'Secondary admin attempted to request OTP to add another admin',
        result: 'DENIED',
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the Primary Admin may add Secondary Admins.',
      });
    }

    const { name, username, email, phone, hostelId } = req.body;

    if (!name || !username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name, User ID (username), and Email are required.',
      });
    }

    const trimmedUsername = username.trim();
    const normalizedEmail = email.toLowerCase().trim();

    if (trimmedUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'User ID must be at least 3 characters long.',
      });
    }

    // Check uniqueness across system
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: trimmedUsername }],
    }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address or User ID already exists.',
      });
    }

    // Validate hostel branch belongs to tenant if specified
    let targetHostel = null;
    if (hostelId) {
      targetHostel = await Hostel.findOne({
        _id: hostelId,
        organizationId: orgId,
      }).lean();
      if (!targetHostel) {
        return res.status(400).json({
          success: false,
          message: 'Selected hostel branch does not belong to your organization.',
        });
      }
    }

    // Rate-limiting & resend cooldown check (60s cooldown)
    const existingActiveOtp = await AdminOtp.findOne({
      actorId: req.user._id,
      action: 'CREATE_SECONDARY_ADMIN',
      isConsumed: false,
      resendCooldownUntil: { $gt: new Date() },
    }).lean();

    if (existingActiveOtp) {
      const waitSeconds = Math.ceil((existingActiveOtp.resendCooldownUntil - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
        retryAfterSeconds: waitSeconds,
      });
    }

    // Invalidate any older unconsumed OTPs for this actor & action
    await AdminOtp.updateMany(
      { actorId: req.user._id, action: 'CREATE_SECONDARY_ADMIN', isConsumed: false },
      { $set: { isConsumed: true } }
    );

    // Generate cryptographically secure 6-digit numeric OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resendCooldownUntil = new Date(Date.now() + 60 * 1000); // 60 seconds

    await AdminOtp.create({
      actorId: req.user._id,
      organizationId: orgId,
      hostelId: targetHostel ? targetHostel._id : req.tenant?.hostelId || null,
      action: 'CREATE_SECONDARY_ADMIN',
      payload: {
        name: name.trim(),
        username: trimmedUsername,
        email: normalizedEmail,
        phone: phone ? phone.trim() : '',
        hostelId: targetHostel ? targetHostel._id.toString() : '',
      },
      otpHash,
      expiresAt,
      resendCooldownUntil,
      attempts: 0,
      maxAttempts: 5,
      isConsumed: false,
    });

    // Send OTP to Primary Admin's registered email ONLY (never to unverified destination)
    await sendAdminActionOtpEmail({
      to: req.user.email,
      adminName: req.user.name,
      action: 'CREATE_SECONDARY_ADMIN',
      otp: rawOtp,
      expiresInMinutes: 5,
    });

    await logAdminAuditEvent({
      req,
      action: 'OTP_REQUEST_CREATE_SECONDARY_ADMIN',
      description: `Primary Admin requested OTP to add secondary admin ${trimmedUsername} (${normalizedEmail})`,
      result: 'SUCCESS',
    });

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to your Primary Admin email (${req.user.email}).`,
      expiresInSeconds: 300,
      cooldownSeconds: 60,
    });
  } catch (error) {
    console.error('Error in requestCreateAdminOtp:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Verify OTP and Create Secondary Admin
 * @route   POST /api/admins/verify-create
 * @access  Private (Primary Admin only)
 */
const verifyCreateAdmin = async (req, res) => {
  try {
    const orgId = req.organizationId;
    const isPrimary = await isUserPrimaryAdmin(req.user, orgId);

    if (!isPrimary) {
      await logAdminAuditEvent({
        req,
        action: 'VERIFY_CREATE_ADMIN_UNAUTHORIZED',
        result: 'DENIED',
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the Primary Admin may verify and add Secondary Admins.',
      });
    }

    const { otp } = req.body;
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ success: false, message: 'Verification code is required.' });
    }

    const cleanOtp = otp.trim();

    // Find the latest active unconsumed OTP challenge
    const otpRecord = await AdminOtp.findOne({
      actorId: req.user._id,
      action: 'CREATE_SECONDARY_ADMIN',
      isConsumed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired or is invalid. Please request a new code.',
      });
    }

    // Check maximum attempts
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      otpRecord.isConsumed = true;
      await otpRecord.save();
      await logAdminAuditEvent({
        req,
        action: 'OTP_MAX_ATTEMPTS_EXCEEDED',
        description: 'Exceeded maximum 5 verification attempts for create admin',
        result: 'FAILURE',
      });
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    // Compare hash securely with constant-time equality
    const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(submittedHash, 'hex'),
      Buffer.from(otpRecord.otpHash, 'hex')
    );

    if (!isMatch) {
      otpRecord.attempts += 1;
      const remaining = otpRecord.maxAttempts - otpRecord.attempts;
      if (remaining <= 0) {
        otpRecord.isConsumed = true;
      }
      await otpRecord.save();

      await logAdminAuditEvent({
        req,
        action: 'OTP_VERIFICATION_FAILED',
        description: `Invalid OTP attempt for create admin (${remaining} attempts remaining)`,
        result: 'FAILURE',
      });

      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
        attemptsRemaining: Math.max(0, remaining),
      });
    }

    // OTP is valid: Mark consumed atomically
    otpRecord.isConsumed = true;
    await otpRecord.save();

    const { name, username, email, phone, hostelId } = otpRecord.payload;

    // Double check email/username uniqueness before creation
    const doubleCheck = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.trim() }],
    }).lean();

    if (doubleCheck) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address or User ID already exists.',
      });
    }

    // Generate single-use expiring activation token
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Resolve hostel
    let assignedHostel = null;
    if (hostelId && mongoose.Types.ObjectId.isValid(hostelId)) {
      assignedHostel = await Hostel.findById(hostelId).lean();
    }
    if (!assignedHostel && orgId) {
      assignedHostel = await Hostel.findOne({ organizationId: orgId }).lean();
    }

    // Generate a temporary strong random password hash to satisfy required constraint
    // (Permanent password will be securely chosen by admin via single-use activation link)
    const randomTempPassword = crypto.randomBytes(24).toString('hex') + 'A1!';

    const newAdmin = await User.create({
      name: name.trim(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : '',
      password: randomTempPassword,
      role: 'admin',
      isPrimaryAdmin: false, // Non-negotiable: Secondary Admin only
      isSuperAdmin: false,
      activeOrganizationId: orgId,
      activeHostelId: assignedHostel ? assignedHostel._id : null,
      hostels: assignedHostel ? [assignedHostel.code] : ['MAIN'],
      status: 'INVITED',
      isActive: true,
      mustChangePassword: true,
      activationToken: hashedActivationToken,
      activationExpires,
    });

    // Create Membership in tenant organization
    await Membership.create({
      userId: newAdmin._id,
      organizationId: orgId,
      role: 'HOSTEL_ADMIN',
      hostelAccess: assignedHostel ? [assignedHostel._id.toString()] : ['all'],
      status: 'ACTIVE',
    });

    // Queue welcome email with single-use activation link (no plaintext password)
    const frontendUrl = (process.env.FRONTEND_URL || 'https://q2-connect-suite.vercel.app').trim();
    const activationLink = `${frontendUrl}/reset-password?token=${rawActivationToken}&type=activation`;
    const correlationId = req.requestId || `admin-inv-${newAdmin._id}`;

    const { addEmailJob } = require('../queues/queueManager');
    let emailDispatched = false;

    try {
      await addEmailJob(
        'SECONDARY_ADMIN_WELCOME',
        {
          to: newAdmin.email,
          name: newAdmin.name,
          username: newAdmin.username,
          hostelName: assignedHostel ? assignedHostel.name : 'Hostel Branch',
          orgName: req.tenant?.organizationName || 'Q2 Connect Suite',
          activationLink,
          loginLink: `${frontendUrl}/login?role=admin`,
          adminUserId: newAdmin._id.toString(),
          correlationId,
        },
        { jobId: `admin-inv-${newAdmin._id}` }
      );
      emailDispatched = true;
    } catch (mailErr) {
      console.warn(`[adminManagement] Queue invitation email failed (${mailErr.message}), falling back to direct send...`);
      try {
        await sendSecondaryAdminWelcomeEmail({
          to: newAdmin.email,
          name: newAdmin.name,
          username: newAdmin.username,
          hostelName: assignedHostel ? assignedHostel.name : 'Hostel Branch',
          orgName: req.tenant?.organizationName || 'Q2 Connect Suite',
          activationLink,
          loginLink: `${frontendUrl}/login?role=admin`,
          correlationId,
        });
        await User.updateOne(
          { _id: newAdmin._id },
          { $set: { invitationEmailStatus: 'sent', invitationEmailSentAt: new Date(), invitationEmailError: null } }
        );
        emailDispatched = true;
      } catch (directErr) {
        console.error(`[adminManagement] Direct invitation email failed: ${directErr.message}`);
        await User.updateOne(
          { _id: newAdmin._id },
          { $set: { invitationEmailStatus: 'failed', invitationEmailError: directErr.message } }
        );
      }
    }

    await logAdminAuditEvent({
      req,
      action: 'SECONDARY_ADMIN_CREATED',
      entityId: newAdmin._id,
      description: `Secondary Admin ${newAdmin.username} (${newAdmin.email}) created by Primary Admin. Email status: ${emailDispatched ? 'DISPATCHED' : 'FAILED'}`,
      newValue: { id: newAdmin._id, username: newAdmin.username, email: newAdmin.email },
      result: 'SUCCESS',
    });

    const successMessage = emailDispatched
      ? `Secondary Admin ${newAdmin.name} created successfully. An activation email has been dispatched to ${newAdmin.email}.`
      : `Secondary Admin ${newAdmin.name} created successfully, but the activation email could not be delivered. You can resend the invitation from the directory.`;

    return res.status(201).json({
      success: true,
      message: successMessage,
      emailDispatched,
      data: {
        id: newAdmin._id.toString(),
        user_id: newAdmin._id.toString(),
        name: newAdmin.name,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.status,
        invitationEmailStatus: emailDispatched ? 'sent' : 'failed',
        is_primary: false,
        isPrimaryAdmin: false,
        created_at: newAdmin.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in verifyCreateAdmin:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Request email OTP to delete/deactivate a Secondary Admin
 * @route   POST /api/admins/request-delete-otp
 * @access  Private (Primary Admin only)
 */
const requestDeleteAdminOtp = async (req, res) => {
  try {
    const orgId = req.organizationId;
    const isPrimary = await isUserPrimaryAdmin(req.user, orgId);

    if (!isPrimary) {
      await logAdminAuditEvent({
        req,
        action: 'DELETE_ADMIN_UNAUTHORIZED_ATTEMPT',
        result: 'DENIED',
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the Primary Admin may delete or deactivate Secondary Admins.',
      });
    }

    const { targetAdminId } = req.body;
    if (!targetAdminId) {
      return res.status(400).json({ success: false, message: 'Target admin ID is required.' });
    }

    // Look up target admin
    const target = await User.findById(targetAdminId);
    if (!target || target.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    // Safety checks:
    // 1. Cannot delete self
    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete or deactivate your own Primary Admin account.',
      });
    }

    // 2. Check tenant ownership (cannot touch another organization's admin)
    if (!req.tenant?.isSuperAdmin) {
      const isTargetInOrg =
        (target.activeOrganizationId && target.activeOrganizationId.toString() === orgId.toString()) ||
        (await Membership.exists({ userId: target._id, organizationId: orgId }));

      if (!isTargetInOrg) {
        return res.status(404).json({ success: false, message: 'Admin not found.' });
      }
    }

    // 3. Cannot delete Primary Admin or Super Admin
    const isTargetPrimary = await isUserPrimaryAdmin(target, orgId);
    if (isTargetPrimary || target.isSuperAdmin || target.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Primary Admins and Super Admins cannot be deleted through this workflow.',
      });
    }

    // Rate-limiting & resend cooldown check (60s cooldown)
    const existingActiveOtp = await AdminOtp.findOne({
      actorId: req.user._id,
      action: 'DEACTIVATE_SECONDARY_ADMIN',
      targetAdminId: target._id,
      isConsumed: false,
      resendCooldownUntil: { $gt: new Date() },
    }).lean();

    if (existingActiveOtp) {
      const waitSeconds = Math.ceil((existingActiveOtp.resendCooldownUntil - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
        retryAfterSeconds: waitSeconds,
      });
    }

    // Invalidate prior unconsumed OTPs for this actor & target
    await AdminOtp.updateMany(
      {
        actorId: req.user._id,
        action: 'DEACTIVATE_SECONDARY_ADMIN',
        targetAdminId: target._id,
        isConsumed: false,
      },
      { $set: { isConsumed: true } }
    );

    // Generate 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const resendCooldownUntil = new Date(Date.now() + 60 * 1000);

    await AdminOtp.create({
      actorId: req.user._id,
      organizationId: orgId,
      hostelId: target.activeHostelId || null,
      action: 'DEACTIVATE_SECONDARY_ADMIN',
      targetAdminId: target._id,
      payload: {
        name: target.name,
        username: target.username,
        email: target.email,
      },
      otpHash,
      expiresAt,
      resendCooldownUntil,
      attempts: 0,
      maxAttempts: 5,
      isConsumed: false,
    });

    // Send OTP to Primary Admin's registered email
    await sendAdminActionOtpEmail({
      to: req.user.email,
      adminName: req.user.name,
      action: 'DEACTIVATE_SECONDARY_ADMIN',
      otp: rawOtp,
      expiresInMinutes: 5,
    });

    await logAdminAuditEvent({
      req,
      action: 'OTP_REQUEST_DEACTIVATE_SECONDARY_ADMIN',
      entityId: target._id,
      description: `Primary Admin requested OTP to deactivate secondary admin ${target.username} (${target.email})`,
      result: 'SUCCESS',
    });

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to your Primary Admin email (${req.user.email}).`,
      expiresInSeconds: 300,
      cooldownSeconds: 60,
    });
  } catch (error) {
    console.error('Error in requestDeleteAdminOtp:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Verify OTP and Deactivate Secondary Admin
 * @route   POST /api/admins/verify-delete
 * @access  Private (Primary Admin only)
 */
const verifyDeleteAdmin = async (req, res) => {
  try {
    const orgId = req.organizationId;
    const isPrimary = await isUserPrimaryAdmin(req.user, orgId);

    if (!isPrimary) {
      await logAdminAuditEvent({
        req,
        action: 'VERIFY_DELETE_ADMIN_UNAUTHORIZED',
        result: 'DENIED',
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the Primary Admin may delete or deactivate Secondary Admins.',
      });
    }

    const { otp, targetAdminId } = req.body;
    if (!otp || !targetAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Verification code and target admin ID are required.',
      });
    }

    const cleanOtp = otp.trim();

    const otpRecord = await AdminOtp.findOne({
      actorId: req.user._id,
      action: 'DEACTIVATE_SECONDARY_ADMIN',
      targetAdminId,
      isConsumed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired or is invalid. Please request a new code.',
      });
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      otpRecord.isConsumed = true;
      await otpRecord.save();
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(submittedHash, 'hex'),
      Buffer.from(otpRecord.otpHash, 'hex')
    );

    if (!isMatch) {
      otpRecord.attempts += 1;
      const remaining = otpRecord.maxAttempts - otpRecord.attempts;
      if (remaining <= 0) {
        otpRecord.isConsumed = true;
      }
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
        attemptsRemaining: Math.max(0, remaining),
      });
    }

    // Mark OTP consumed
    otpRecord.isConsumed = true;
    await otpRecord.save();

    // Revalidate target admin state
    const target = await User.findById(targetAdminId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    // Safety checks
    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own Primary Admin account.',
      });
    }

    const isTargetPrimary = await isUserPrimaryAdmin(target, orgId);
    if (isTargetPrimary) {
      return res.status(403).json({
        success: false,
        message: 'Primary Admins cannot be deleted.',
      });
    }

    // Perform deactivation (soft-delete with session revocation)
    target.status = 'DEACTIVATED';
    target.isActive = false;
    target.refreshTokens = []; // Revoke active sessions
    await target.save();

    // Suspend organization membership
    await Membership.updateMany(
      { userId: target._id, organizationId: orgId },
      { $set: { status: 'SUSPENDED' } }
    );

    await logAdminAuditEvent({
      req,
      action: 'SECONDARY_ADMIN_DEACTIVATED',
      entityId: target._id,
      description: `Secondary Admin ${target.username} (${target.email}) deactivated and sessions revoked by Primary Admin`,
      result: 'SUCCESS',
    });

    return res.status(200).json({
      success: true,
      message: `Secondary Admin ${target.name} has been deactivated successfully.`,
    });
  } catch (error) {
    console.error('Error in verifyDeleteAdmin:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Resend invitation email to an invited Secondary Admin
 * @route   POST /api/admins/:id/resend-invite
 * @access  Private (Primary Admin only)
 */
const resendAdminInvitation = async (req, res) => {
  try {
    const orgId = req.organizationId;
    const isPrimary = await isUserPrimaryAdmin(req.user, orgId);

    if (!isPrimary) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the Primary Admin may resend administrator invitations.',
      });
    }

    const target = await User.findById(req.params.id);
    if (!target || target.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    if (!target.isActive || target.status === 'DEACTIVATED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send invitation to a deactivated administrator account.',
      });
    }

    // Generate fresh single-use activation token
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');

    target.activationToken = hashedActivationToken;
    target.activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
    target.status = 'INVITED';
    target.invitationEmailStatus = 'pending';
    target.invitationEmailError = null;
    await target.save();

    const frontendUrl = (process.env.FRONTEND_URL || 'https://q2-connect-suite.vercel.app').trim();
    const activationLink = `${frontendUrl}/reset-password?token=${rawActivationToken}&type=activation`;
    const correlationId = req.requestId || `resend-admin-inv-${target._id}-${Date.now()}`;

    // Resolve assigned hostel for branding
    let assignedHostelName = 'Hostel Branch';
    if (target.activeHostelId) {
      const hDoc = await Hostel.findById(target.activeHostelId).lean();
      if (hDoc) assignedHostelName = hDoc.name;
    }

    const { addEmailJob } = require('../queues/queueManager');
    let emailSent = false;
    try {
      await addEmailJob(
        'SECONDARY_ADMIN_WELCOME',
        {
          to: target.email,
          name: target.name,
          username: target.username,
          hostelName: assignedHostelName,
          orgName: req.tenant?.organizationName || 'Q2 Connect Suite',
          activationLink,
          loginLink: `${frontendUrl}/login?role=admin`,
          adminUserId: target._id.toString(),
          correlationId,
        },
        { jobId: `resend-admin-inv-${target._id}-${Date.now()}` }
      );
      emailSent = true;
    } catch (qErr) {
      console.warn(`[adminManagement] Resend queue failed (${qErr.message}), falling back to direct send...`);
      try {
        await sendSecondaryAdminWelcomeEmail({
          to: target.email,
          name: target.name,
          username: target.username,
          hostelName: assignedHostelName,
          orgName: req.tenant?.organizationName || 'Q2 Connect Suite',
          activationLink,
          loginLink: `${frontendUrl}/login?role=admin`,
          correlationId,
        });
        target.invitationEmailStatus = 'sent';
        target.invitationEmailSentAt = new Date();
        target.invitationEmailError = null;
        await target.save();
        emailSent = true;
      } catch (directErr) {
        console.error(`[adminManagement] Direct resend failed: ${directErr.message}`);
        target.invitationEmailStatus = 'failed';
        target.invitationEmailError = directErr.message;
        await target.save();
        return res.status(500).json({
          success: false,
          message: `Failed to deliver invitation email: ${directErr.message}`,
        });
      }
    }

    await logAdminAuditEvent({
      req,
      action: 'SECONDARY_ADMIN_INVITATION_RESENT',
      entityId: target._id,
      description: `Primary Admin resent activation invitation to ${target.email}`,
      result: 'SUCCESS',
    });

    return res.status(200).json({
      success: true,
      message: `Invitation email dispatched successfully to ${target.email}.`,
    });
  } catch (error) {
    console.error('Error in resendAdminInvitation:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  isUserPrimaryAdmin,
  getAdmins,
  requestCreateAdminOtp,
  verifyCreateAdmin,
  requestDeleteAdminOtp,
  verifyDeleteAdmin,
  resendAdminInvitation,
};
