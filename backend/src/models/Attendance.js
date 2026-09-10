const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    hostel: { type: String, trim: true, default: 'Q2' },
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'mess_off'], default: 'present' },
  },
  { timestamps: true }
);

// Unique: one record per student per date
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organizationId: 1, date: 1, status: 1 });
attendanceSchema.index({ organizationId: 1, hostelId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
