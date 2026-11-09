const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema(
  {
    enquiryId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    workEmail: {
      type: String,
      required: [true, 'Work email address is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
      index: true,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      maxlength: [20, 'Contact number cannot exceed 20 characters'],
    },
    hostelName: {
      type: String,
      required: [true, 'Hostel or organization name is required'],
      trim: true,
      maxlength: [150, 'Hostel name cannot exceed 150 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [100, 'State cannot exceed 100 characters'],
    },
    hostelType: {
      type: String,
      required: [true, 'Hostel type is required'],
      enum: {
        values: ['Boys Hostel', 'Girls Hostel', 'Co-living', 'Other'],
        message: '{VALUE} is not a valid hostel type',
      },
    },
    approxBeds: {
      type: String,
      required: [true, 'Approximate bed capacity is required'],
      enum: {
        values: ['Under 50', '50–100', '101–250', '251–500', 'Above 500'],
        message: '{VALUE} is not a valid bed capacity range',
      },
    },
    message: {
      type: String,
      trim: true,
      maxlength: [2000, 'Additional message cannot exceed 2000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'closed'],
      default: 'new',
      index: true,
    },
    source: {
      type: String,
      default: 'website_connect_form',
      trim: true,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

enquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Enquiry', enquirySchema);
