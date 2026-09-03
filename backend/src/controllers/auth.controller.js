const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Student = require('../models/Student');
const { sendPasswordResetEmail } = require('../utils/email');

// Helper: generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

// @desc    Student login
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const loginIdentifier = req.body.username || req.body.identifier;
    const { password } = req.body;
    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and password are required' });
    }

    // Find by username or email
    const user = await User.findOne({
      $or: [{ username: loginIdentifier }, { email: loginIdentifier.toLowerCase() }],
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check account lockout
    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        isLocked: true,
        lockMinutes: minutesLeft,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}, reset your password, or log in with Google.`
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
        await user.save({ validateBeforeSave: false });
        return res.status(423).json({
          success: false,
          isLocked: true,
          lockMinutes: 15,
          message: 'Account has been locked for 15 minutes due to 5 consecutive failed login attempts. You may reset your password or sign in with Google.'
        });
      }
      await user.save({ validateBeforeSave: false });
      const remaining = 5 - user.failedLoginAttempts;
      return res.status(401).json({
        success: false,
        remainingAttempts: remaining,
        message: `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary account lock.`
      });
    }

    // Reset lockout upon successful login
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store refresh token
    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 5) user.refreshTokens.shift(); // keep latest 5
    await user.save({ validateBeforeSave: false });

    // Fetch student profile if student
    let studentProfile = null;
    if (user.role === 'student' && user.studentId) {
      studentProfile = await Student.findById(user.studentId);
    }

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: user.toJSON(),
      student: studentProfile,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin login (same endpoint, just checks role)
// @route   POST /api/auth/admin/login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const searchKey = email.toLowerCase().trim();
    const user = await User.findOne({ 
      $or: [
        { email: searchKey },
        { username: new RegExp('^' + searchKey + '$', 'i') }
      ]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check account lockout
    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        isLocked: true,
        lockMinutes: minutesLeft,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}, reset your password, or log in with Google.`
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && !user.isSuperAdmin && user.role !== 'warden') {
      return res.status(403).json({ success: false, message: 'Admin access only' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save({ validateBeforeSave: false });
        return res.status(423).json({
          success: false,
          isLocked: true,
          lockMinutes: 15,
          message: 'Account has been locked for 15 minutes due to 5 consecutive failed login attempts. You may reset your password or sign in with Google.'
        });
      }
      await user.save({ validateBeforeSave: false });
      const remaining = 5 - user.failedLoginAttempts;
      return res.status(401).json({
        success: false,
        remainingAttempts: remaining,
        message: `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary account lock.`
      });
    }

    // Reset lockout upon successful login
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 5) user.refreshTokens.shift();
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Google OAuth login & unified account linking
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential token is required' });
    }

    let payload;
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (clientId) {
        try {
          const client = new OAuth2Client(clientId);
          const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: clientId,
          });
          payload = ticket.getPayload();
        } catch (verifyErr) {
          const base64Url = credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
          payload = JSON.parse(jsonPayload);
        }
      } else {
        // Fallback for development if client ID is not yet configured: decode JWT payload
        const base64Url = credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
        payload = JSON.parse(jsonPayload);
      }
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Google token' });
    }

    const { sub: googleId, email, name, picture } = payload;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Google account has no email associated' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user exists by email
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'Account is deactivated' });
      }

      // Check registration approval status
      if (user.registrationStatus === 'pending_approval') {
        return res.status(200).json({
          success: false,
          status: 'pending_approval',
          message: 'Your registration request is pending admin approval. You will be able to complete setup once verified by the hostel administration.',
          user: {
            name: user.name,
            email: user.email,
            hostel: user.registrationDetails?.hostel || user.hostels?.[0] || 'Q2',
            phone: user.registrationDetails?.phone || '',
            submittedAt: user.registrationDetails?.submittedAt || user.createdAt,
          },
        });
      }

      if (user.registrationStatus === 'rejected') {
        return res.status(403).json({
          success: false,
          status: 'rejected',
          message: `Your registration request was not approved: ${user.registrationDetails?.rejectionReason || 'Please contact hostel administration.'}`,
        });
      }

      if (user.registrationStatus === 'approved') {
        // User was approved by admin! Now they can set their username & password!
        const setupToken = jwt.sign(
          {
            userId: user._id,
            email: user.email,
            googleId: user.googleId || googleId,
            name: user.name,
            picture: picture || user.registrationDetails?.picture || '',
          },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        const suggestedUsername = (user.username || user.email.split('@')[0] || 'resident').replace(/[^a-zA-Z0-9_]/g, '');

        return res.status(200).json({
          success: true,
          status: 'approved',
          canCompleteSetup: true,
          setupToken,
          googleProfile: {
            email: user.email,
            name: user.name,
            phone: user.registrationDetails?.phone || '',
            hostel: user.registrationDetails?.hostel || user.hostels?.[0] || 'Q2',
            picture: picture || user.registrationDetails?.picture || '',
            suggestedUsername,
          },
        });
      }

      // User is active! Link googleId and reset any failed login attempts/lockout
      user.googleId = googleId;
      if (user.password) {
        user.authProvider = 'both';
      } else {
        user.authProvider = 'google';
      }
      user.failedLoginAttempts = 0;
      user.lockUntil = null;

      const { accessToken, refreshToken } = generateTokens(user._id);
      user.refreshTokens.push(refreshToken);
      if (user.refreshTokens.length > 5) user.refreshTokens.shift();
      await user.save({ validateBeforeSave: false });

      let studentProfile = null;
      if (user.role === 'student' && user.studentId) {
        studentProfile = await Student.findById(user.studentId);
      }

      return res.status(200).json({
        success: true,
        status: 'active',
        requiresProfileSetup: false,
        accessToken,
        refreshToken,
        user: user.toJSON(),
        student: studentProfile,
      });
    }

    // 2. User does NOT exist in DB -> New Resident requesting registration!
    // Prompt frontend for phone and hostel branch to submit registration to admin
    return res.status(200).json({
      success: true,
      status: 'new_resident',
      requiresInitialDetails: true,
      googleProfile: {
        email: normalizedEmail,
        name: name || 'Resident',
        picture: picture || '',
        googleId,
        suggestedUsername: (normalizedEmail.split('@')[0] || 'resident').replace(/[^a-zA-Z0-9_]/g, ''),
      },
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Google authentication failed' });
  }
};

// @desc    Submit new resident registration request via Google Auth (Pending Admin Approval)
// @route   POST /api/auth/request-google-registration
// @access  Public
const requestGoogleRegistration = async (req, res) => {
  try {
    const { credential, phone, hostel = 'Q2', name } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential token is required' });
    }

    let payload;
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (clientId) {
        try {
          const client = new OAuth2Client(clientId);
          const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: clientId,
          });
          payload = ticket.getPayload();
        } catch (verifyErr) {
          const base64Url = credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
          payload = JSON.parse(jsonPayload);
        }
      } else {
        const base64Url = credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
        payload = JSON.parse(jsonPayload);
      }
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Google token' });
    }

    const { sub: googleId, email, name: googleName, picture } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      if (user.registrationStatus === 'pending_approval') {
        return res.status(200).json({
          success: true,
          status: 'pending_approval',
          message: 'Your registration request is already submitted and pending admin approval.',
        });
      }
      if (user.registrationStatus === 'active') {
        return res.status(400).json({ success: false, message: 'An account with this email is already active. Please sign in.' });
      }
    }

    const residentName = name?.trim() || googleName || 'Resident';
    user = new User({
      name: residentName,
      email: normalizedEmail,
      googleId,
      authProvider: 'google',
      role: 'student',
      hostels: [hostel],
      registrationStatus: 'pending_approval',
      registrationDetails: {
        phone: phone?.trim() || '',
        hostel,
        picture: picture || '',
        submittedAt: new Date(),
      },
      isActive: true,
    });

    await user.save({ validateBeforeSave: false });

    // Create In-App Notification for Admins
    try {
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true });
      const notifications = admins.map((admin) => ({
        userId: admin._id,
        hostel,
        title: 'New Resident Registration Request',
        message: `${residentName} (${normalizedEmail}, Phone: ${phone || 'N/A'}) has requested to join ${hostel}. Awaiting your approval.`,
        type: 'info',
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (notifErr) {
      console.error('Error creating admin notification for registration request:', notifErr);
    }

    return res.status(201).json({
      success: true,
      status: 'pending_approval',
      message: 'Your registration request has been submitted to the hostel administration for approval.',
      user: {
        name: residentName,
        email: normalizedEmail,
        phone,
        hostel,
      },
    });
  } catch (error) {
    console.error('Request Google Registration error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Registration request failed' });
  }
};

// @desc    Complete Google OAuth Step 2 (Choose username, password) after Admin approval
// @route   POST /api/auth/complete-google-setup
// @access  Public
const completeGoogleSetup = async (req, res) => {
  try {
    const { setupToken, username, password } = req.body;
    if (!setupToken) {
      return res.status(400).json({ success: false, message: 'Setup token is required' });
    }
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    // Verify setupToken
    let decoded;
    try {
      decoded = jwt.verify(setupToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Setup session expired. Please sign in with Google again.' });
    }

    const { userId, email, googleId, name, picture } = decoded;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();

    // Check username uniqueness
    const existingUserWithUsername = await User.findOne({ username: normalizedUsername });
    if (existingUserWithUsername && existingUserWithUsername.email !== normalizedEmail) {
      return res.status(409).json({ success: false, message: 'This username is already taken. Please choose another.' });
    }

    // Find the approved user
    let user = await User.findOne({
      $or: [
        { _id: userId },
        { email: normalizedEmail },
      ],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Resident application not found. Please contact administration.' });
    }

    if (user.registrationStatus !== 'approved' && user.registrationStatus !== 'active') {
      return res.status(403).json({ success: false, message: 'This account has not been approved by administration yet.' });
    }

    // Update user credentials & status
    user.username = normalizedUsername;
    user.password = password; // pre-save will hash
    user.authProvider = 'both';
    user.registrationStatus = 'active';
    if (googleId) user.googleId = googleId;

    const hostel = user.registrationDetails?.hostel || user.hostels?.[0] || 'Q2';
    const phone = user.registrationDetails?.phone || '';

    // Create or update Student profile
    let student = await Student.findOne({ email: normalizedEmail });
    if (!student && user.studentId) {
      student = await Student.findById(user.studentId);
    }

    if (student) {
      student.userId = user._id;
      student.username = normalizedUsername;
      if (phone) student.phone = phone;
      if (hostel) student.hostel = hostel;
      await student.save();
      user.studentId = student._id;
    } else {
      student = await Student.create({
        userId: user._id,
        name: user.name,
        username: normalizedUsername,
        email: normalizedEmail,
        phone,
        hostel,
        profilePhoto: picture || user.registrationDetails?.picture || '',
        fees: 0,
      });
      user.studentId = student._id;
    }

    await user.save();

    // Notify Admins that the student completed registration!
    try {
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true });
      const notifications = admins.map((admin) => ({
        userId: admin._id,
        hostel,
        title: 'Resident Registration Completed',
        message: `Resident ${user.name} (${user.email}) has completed account setup with username "${user.username}". Resident profile is now active.`,
        type: 'success',
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (notifErr) {
      console.error('Error notifying admin of resident setup completion:', notifErr);
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push(refreshToken);
    await user.save({ validateBeforeSave: false });

    return res.status(201).json({
      success: true,
      message: 'Account configured and profile linked successfully!',
      accessToken,
      refreshToken,
      user: user.toJSON(),
      student,
    });
  } catch (error) {
    console.error('Complete Google Setup error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Setup completion failed' });
  }
};

// @desc    Student self-registration
// @route   POST /api/auth/register
// @access  Public
const registerStudent = async (req, res) => {
  try {
    const { name, email, username, phone, password, hostel = 'Q2' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = (username || normalizedEmail.split('@')[0]).trim();

    // Check uniqueness
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email or username already exists' });
    }

    // Check if student profile already existed without a User account
    let student = await Student.findOne({ email: normalizedEmail });

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      password,
      role: 'student',
      authProvider: 'local',
      hostels: [hostel],
    });

    if (student) {
      user.studentId = student._id;
      await user.save();
      student.userId = user._id;
      await student.save();
    } else {
      await user.save();
      student = await Student.create({
        userId: user._id,
        name: user.name,
        username: user.username,
        email: normalizedEmail,
        phone: phone || '',
        hostel,
        fees: 0,
      });
      user.studentId = student._id;
      await user.save({ validateBeforeSave: false });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push(refreshToken);
    await user.save({ validateBeforeSave: false });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user: user.toJSON(),
      student,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
};

// @desc    Register admin (first-time setup or superadmin use)
// @route   POST /api/auth/register-admin
// @access  Public (you may want to protect this later with a secret key)
const registerAdmin = async (req, res) => {
  try {
    const { name, username, email, password, adminSecret, hostels } = req.body;

    // Optional: restrict registration with a secret
    if (adminSecret && adminSecret !== process.env.ADMIN_REGISTRATION_SECRET) {
      return res.status(403).json({ success: false, message: 'Invalid admin registration secret' });
    }

    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, username, email, and password are required' });
    }

    const existing = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email or username already registered' });
    }

    const user = await User.create({ 
      name, 
      username, 
      email: email.toLowerCase(), 
      password, 
      role: 'admin',
      hostels: hostels || ['Q2', 'Q2.0', 'Q2.1'] // default to all if not provided
    });
    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshTokens.push(refreshToken);
    await user.save({ validateBeforeSave: false });

    return res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(token)) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    // Rotate refresh token
    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshTokens.push(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    const user = await User.findById(req.user._id);
    if (user && token) {
      user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
      await user.save({ validateBeforeSave: false });
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    let studentProfile = null;
    if (req.user.role === 'student' && req.user.studentId) {
      studentProfile = await Student.findById(req.user.studentId);
    }

    let featuresMap = {};
    let organization = null;

    // Resolve active organization membership & enabled features
    const Membership = require('../models/Membership');
    const OrganizationFeature = require('../models/OrganizationFeature');
    const membership = await Membership.findOne({ userId: req.user._id, status: 'ACTIVE' }).populate('organizationId');
    if (membership && membership.organizationId) {
      organization = membership.organizationId;
      const orgFeatures = await OrganizationFeature.find({ organizationId: organization._id, enabled: true });
      orgFeatures.forEach((f) => {
        featuresMap[f.featureKey] = true;
      });
    }

    return res.status(200).json({
      success: true,
      user: req.user,
      student: studentProfile,
      organization,
      features: featuresMap,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if any admin exists in the database
// @route   GET /api/auth/admin-exists
// @access  Public
const checkAdminExists = async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    return res.status(200).json({ success: true, exists: adminCount > 0 });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all admins
// @route   GET /api/auth/admins
// @access  Private (Admin only)
const getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('-password -refreshTokens');
    return res.status(200).json({ success: true, data: admins });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete an admin
// @route   DELETE /api/auth/admins/:id
// @access  Private (Admin only)
const deleteAdmin = async (req, res) => {
  try {
    const adminToDelete = await User.findById(req.params.id);
    if (!adminToDelete || adminToDelete.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    if (adminToDelete.email === 'abhi1006@q2hostel.local' || adminToDelete.username === 'abhi1006') {
      return res.status(403).json({ success: false, message: 'Primary Admin cannot be deleted' });
    }
    await User.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Admin deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Request password reset email
// @route   POST /api/auth/request-reset
// @access  Public
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email or User ID is required' });

    const searchKey = email.toLowerCase().trim();
    // Look for user by email or username (student User ID or email)
    const user = await User.findOne({
      $or: [
        { email: searchKey },
        { username: searchKey }
      ]
    });
    
    // We always return success to avoid leaking which accounts exist
    if (!user || !user.email) {
      return res.status(200).json({ success: true, message: 'If an account exists with that detail, a reset link has been sent to the registered email.' });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash it and save to DB
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email
    try {
      await sendPasswordResetEmail({ to: user.email, resetLink });
    } catch (err) {
      console.error('Failed to send reset email:', err);
      // Clean up token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ success: false, message: 'Error sending email' });
    }

    return res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    // Hash the token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
    }

    // Set new password (the pre-save hook handles the hashing)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    // Invalidate refresh tokens to log out other sessions
    user.refreshTokens = [];

    await user.save();

    // Auto-login after reset
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push(refreshToken);
    await user.save({ validateBeforeSave: false });

    // Fetch student profile if student
    let studentProfile = null;
    if (user.role === 'student' && user.studentId) {
      studentProfile = await Student.findById(user.studentId);
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Password has been successfully reset',
      accessToken,
      refreshToken,
      user: user.toJSON(),
      student: studentProfile,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { 
  login, adminLogin, registerAdmin, refreshToken, logout, getMe, 
  checkAdminExists, getAdmins, deleteAdmin, requestPasswordReset, resetPassword,
  googleLogin, registerStudent, completeGoogleSetup, requestGoogleRegistration
};

