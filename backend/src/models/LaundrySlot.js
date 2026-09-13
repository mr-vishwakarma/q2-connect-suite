const mongoose = require('mongoose');

const laundrySlotSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  date: {
    type: String, // format YYYY-MM-DD
    required: true,
  },
  timeSlot: {
    type: String, // e.g., '07:00-08:00'
    required: true,
  },
  machineNumber: {
    type: Number,
    default: 1,
    required: true,
  },
  hostel: {
    type: String,
    default: 'Q2',
  },
  notes: {
    type: String,
  },
  status: {
    type: String,
    enum: ['booked', 'completed', 'cancelled', 'maintenance'],
    default: 'booked',
  },
}, { timestamps: true });

// Prevent a student from booking more than 1 slot per day within an organization
laundrySlotSchema.index({ organizationId: 1, student: 1, date: 1, status: 1 });

// Prevent a machine in a hostel from being double-booked at the same time on the same date within an organization
laundrySlotSchema.index({ organizationId: 1, hostel: 1, date: 1, timeSlot: 1, machineNumber: 1, status: 1 });
laundrySlotSchema.index({ organizationId: 1, date: 1, status: 1 });

module.exports = mongoose.model('LaundrySlot', laundrySlotSchema);

