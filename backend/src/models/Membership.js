const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: {
      type: String,
      enum: [
        'SUPER_ADMIN',
        'ORGANIZATION_OWNER',
        'HOSTEL_ADMIN',
        'WARDEN',
        'ACCOUNTANT',
        'RECEPTIONIST',
        'STAFF',
        'STUDENT',
      ],
      default: 'HOSTEL_ADMIN',
    },
    // 'all' or list of hostel branch ObjectId strings
    hostelAccess: [{ type: String, default: 'all' }],
    permissions: [{ type: String }],
    status: { type: String, enum: ['ACTIVE', 'INVITED', 'SUSPENDED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
membershipSchema.index({ organizationId: 1, role: 1 });

module.exports = mongoose.model('Membership', membershipSchema);
