const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String },
    legalName: { type: String, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, default: 'India', trim: true },
    aadhaarNumber: { type: String, trim: true },
    aadhaarDocument: { type: String, trim: true },
    gstin: { type: String, trim: true },
    pan: { type: String, trim: true },
    orgType: { type: String, trim: true, default: 'Multi-Branch Chain' },
    primaryColor: { type: String, trim: true, default: '#f59e0b' },
    status: {
      type: String,
      enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'ARCHIVED'],
      default: 'TRIAL',
    },
    kycVerificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
    },
    kycVerifiedAt: { type: Date },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    settings: {
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      allowMultiBranch: { type: Boolean, default: true },
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

organizationSchema.index({ status: 1, createdAt: -1 });
organizationSchema.index({ isDeleted: 1, createdAt: -1 });
organizationSchema.index({ contactEmail: 1 });

module.exports = mongoose.model('Organization', organizationSchema);
