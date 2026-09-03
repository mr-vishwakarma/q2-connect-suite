const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, unique: true, sparse: true, trim: true },
    password: { 
      type: String, 
      required: function () { return this.authProvider !== 'google'; }, 
      minlength: 6 
    },
    role: { type: String, enum: ['super_admin', 'admin', 'student', 'warden', 'accountant', 'staff'], default: 'student' },
    isSuperAdmin: { type: Boolean, default: false },
    activeOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    activeHostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
    // Admin can manage multiple hostels
    hostels: [{ type: String }],
    // Link to student profile if role is student
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    isActive: { type: Boolean, default: true },
    refreshTokens: [{ type: String }],
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    // Security & Anti-Brute-Force Lockout
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    // Google OAuth & Hybrid Auth
    googleId: { type: String, sparse: true },
    authProvider: { type: String, enum: ['local', 'google', 'both'], default: 'local' },

    // Resident Registration & Admin Approval Workflow
    registrationStatus: {
      type: String,
      enum: ['active', 'pending_approval', 'approved', 'rejected'],
      default: 'active',
    },
    registrationDetails: {
      phone: { type: String },
      hostel: { type: String },
      picture: { type: String },
      rejectionReason: { type: String },
      submittedAt: { type: Date },
      approvedAt: { type: Date },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true }
);

// Method: Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
