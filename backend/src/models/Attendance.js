const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'] },
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'mess_off'], default: 'present' },
  },
  { timestamps: true }
);

// Unique: one record per student per date
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
