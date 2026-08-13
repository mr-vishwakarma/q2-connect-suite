const mongoose = require('mongoose');

const laundrySlotSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  date: {
    type: String, // format YYYY-MM-DD
    required: true
  },
  timeSlot: {
    type: String, // e.g., '07:00-08:00'
    required: true
  },
  machineNumber: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['booked', 'completed', 'cancelled'],
    default: 'booked'
  }
}, { timestamps: true });

// Prevent a student from booking more than 1 slot per day
laundrySlotSchema.index({ student: 1, date: 1, status: 1 });

// Prevent a machine from being double-booked at the same time on the same date
laundrySlotSchema.index({ date: 1, timeSlot: 1, machineNumber: 1, status: 1 });

module.exports = mongoose.model('LaundrySlot', laundrySlotSchema);
