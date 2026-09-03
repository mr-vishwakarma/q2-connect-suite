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
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    // Find by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username.toLowerCase() }],
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
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: clientId,
        });
        payload = ticket.getPayload();
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

      // Link googleId and reset any failed login attempts/lockout
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
        requiresProfileSetup: false,
        accessToken,
        refreshToken,
        user: user.toJSON(),
        student: studentProfile,
      });
    }

    // 2. User does not exist yet -> New student registration via Google!
    // Generate a temporary 15-minute setup token so the client can submit step 2 (username, password, phone, hostel)
    const setupToken = jwt.sign(
      {
        email: normalizedEmail,
        googleId,
        name: name || 'Resident',
        picture: picture || '',
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Suggest a clean username from email or name
    const suggestedUsername = (normalizedEmail.split('@')[0] || 'resident').replace(/[^a-zA-Z0-9_]/g, '');

    return res.status(200).json({
      success: true,
      requiresProfileSetup: true,
      setupToken,
      googleProfile: {
        email: normalizedEmail,
        name: name || 'Resident',
        picture: picture || '',
        googleId,
        suggestedUsername,
      },
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Google authentication failed' });
  }
};

// @desc    Complete Google OAuth Step 2 (Choose username, password, phone, hostel)
// @route   POST /api/auth/complete-google-setup
// @access  Public
const completeGoogleSetup = async (req, res) => {
  try {
    const { setupToken, username, password, phone, hostel = 'Q2' } = req.body;
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

    const { email, googleId, name, picture } = decoded;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();

    // Check username uniqueness
    const existingUserWithUsername = await User.findOne({ username: normalizedUsername });
    if (existingUserWithUsername && existingUserWithUsername.email !== normalizedEmail) {
      return res.status(409).json({ success: false, message: 'This username is already taken. Please choose another.' });
    }

    // Check if user with this email already exists
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      // User was already created; update password and link
      user.password = password;
      user.username = normalizedUsername;
      user.googleId = googleId;
      user.authProvider = 'both';
      await user.save();
    } else {
      // Check if Student record pre-exists with this email
      let student = await Student.findOne({ email: normalizedEmail });

      // Create User record with BOTH password and googleId
      user = new User({
        name: name || 'Resident',
        email: normalizedEmail,
        username: normalizedUsername,
        password,
        googleId,
        authProvider: 'both',
        role: 'student',
        hostels: [hostel],
        isActive: true,
      });

      if (student) {
        user.studentId = student._id;
        await user.save();
        student.userId = user._id;
        student.username = normalizedUsername;
        if (phone) student.phone = phone;
        if (hostel) student.hostel = hostel;
        await student.save();
      } else {
        await user.save();
        student = await Student.create({
          userId: user._id,
          name: user.name,
          username: normalizedUsername,
          email: normalizedEmail,
          phone: phone || '',
          hostel,
          fees: 0,
        });
        user.studentId = student._id;
        await user.save({ validateBeforeSave: false });
      }
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push(refreshToken);
    await user.save({ validateBeforeSave: false });

    let studentProfile = null;
    if (user.role === 'student' && user.studentId) {
      studentProfile = await Student.findById(user.studentId);
    }

    return res.status(201).json({
      success: true,
      message: 'Account configured and profile linked successfully!',
      accessToken,
      refreshToken,
      user: user.toJSON(),
      student: studentProfile,
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
  googleLogin, registerStudent, completeGoogleSetup
};

