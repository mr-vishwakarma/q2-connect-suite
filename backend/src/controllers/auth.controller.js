const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
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

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access only' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
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

// @desc    Register admin (first-time setup or superadmin use)
// @route   POST /api/auth/register-admin
// @access  Public (you may want to protect this later with a secret key)
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, adminSecret } = req.body;

    // Optional: restrict registration with a secret
    if (adminSecret && adminSecret !== process.env.ADMIN_REGISTRATION_SECRET) {
      return res.status(403).json({ success: false, message: 'Invalid admin registration secret' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email: email.toLowerCase(), password, role: 'admin' });
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
    return res.status(200).json({ success: true, user: req.user, student: studentProfile });
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
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    // Look for user by email (could be student real email or admin email)
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // We always return success to avoid leaking which emails exist
    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent.' });
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
  checkAdminExists, getAdmins, deleteAdmin, requestPasswordReset, resetPassword 
};

