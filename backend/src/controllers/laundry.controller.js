const LaundrySlot = require('../models/LaundrySlot');
const Student = require('../models/Student');

// Config: Default to single washing machine system
const TOTAL_MACHINES = 1;

// Operating hours: 06:00 to 22:00 (16 one-hour slots per day)
const OPERATING_HOURS = [
  '06:00-07:00', '07:00-08:00', '08:00-09:00', '09:00-10:00',
  '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
  '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
  '18:00-19:00', '19:00-20:00', '20:00-21:00', '21:00-22:00'
];

exports.getAvailableSlots = async (req, res) => {
  try {
    const { date, hostel: queryHostel } = req.query; // format: YYYY-MM-DD
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required (YYYY-MM-DD)' });
    }

    let targetHostel = queryHostel;
    if (!targetHostel && req.user) {
      if (req.user.studentId) {
        const student = await Student.findById(req.user.studentId);
        targetHostel = student?.hostel || req.user.hostels?.[0];
      } else if (req.user.hostels && req.user.hostels.length > 0) {
        targetHostel = req.user.hostels[0];
      }
    }
    if (!targetHostel) targetHostel = 'Q2';

    // Get all active bookings for that hostel and date
    const query = {
      date,
      status: { $in: ['booked', 'maintenance'] },
    };
    if (targetHostel) {
      query.$or = [{ hostel: targetHostel }, { hostel: { $exists: false } }];
    }

    const bookings = await LaundrySlot.find(query)
      .populate('student', 'name roomNo phone email username')
      .sort({ timeSlot: 1 });

    res.status(200).json({
      success: true,
      data: {
        totalMachines: TOTAL_MACHINES,
        operatingHours: OPERATING_HOURS,
        hostel: targetHostel,
        bookings
      }
    });
  } catch (error) {
    console.error('getAvailableSlots error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bookSlot = async (req, res) => {
  try {
    const { date, timeSlot, machineNumber = 1 } = req.body;
    let studentId = req.user.studentId;

    if (!studentId && req.user.role === 'student') {
      const foundStudent = await Student.findOne({ userId: req.user._id });
      if (foundStudent) studentId = foundStudent._id;
    }

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student profile not linked to user account' });
    }

    if (!date || !timeSlot) {
      return res.status(400).json({ success: false, message: 'Please provide date and time slot' });
    }

    // Determine student hostel
    const student = await Student.findById(studentId);
    const targetHostel = student?.hostel || req.user.hostels?.[0] || 'Q2';

    // Check if student already has an active booking for this date (Limit: 1 slot per day)
    const existingStudentBooking = await LaundrySlot.findOne({
      student: studentId,
      date,
      status: 'booked'
    });

    if (existingStudentBooking) {
      return res.status(400).json({
        success: false,
        message: 'You have already booked a laundry slot for this day. Single machine daily limit is 1 slot per resident.'
      });
    }

    // Check if machine slot is already booked or in maintenance
    const existingSlot = await LaundrySlot.findOne({
      date,
      timeSlot,
      machineNumber: 1,
      $or: [{ hostel: targetHostel }, { hostel: { $exists: false } }],
      status: { $in: ['booked', 'maintenance'] }
    });

    if (existingSlot) {
      return res.status(400).json({
        success: false,
        message: existingSlot.status === 'maintenance'
          ? 'This time slot is temporarily reserved for machine maintenance.'
          : 'This slot is already booked. Please choose another time.'
      });
    }

    const newBooking = await LaundrySlot.create({
      student: studentId,
      hostel: targetHostel,
      date,
      timeSlot,
      machineNumber: 1,
      status: 'booked'
    });

    const populated = await LaundrySlot.findById(newBooking._id).populate('student', 'name roomNo phone');

    res.status(201).json({
      success: true,
      message: 'Laundry slot booked successfully on Machine 1!',
      data: populated
    });
  } catch (error) {
    console.error('bookSlot error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await LaundrySlot.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if the user is the owner student or an admin
    const isOwner = req.user.studentId && booking.student.toString() === req.user.studentId.toString();
    const isAdmin = ['admin', 'super_admin', 'warden'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Laundry slot booking cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    let studentId = req.user.studentId;
    if (!studentId && req.user.role === 'student') {
      const foundStudent = await Student.findOne({ userId: req.user._id });
      if (foundStudent) studentId = foundStudent._id;
    }

    if (!studentId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const bookings = await LaundrySlot.find({ student: studentId })
      .sort({ date: -1, timeSlot: -1 })
      .limit(15);

    res.status(200).json({
      success: true,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.adminBlockSlot = async (req, res) => {
  try {
    const { date, timeSlot, hostel = 'Q2', notes = 'Machine Maintenance' } = req.body;
    if (!date || !timeSlot) {
      return res.status(400).json({ success: false, message: 'Date and timeSlot are required' });
    }

    const existing = await LaundrySlot.findOne({
      date,
      timeSlot,
      machineNumber: 1,
      hostel,
      status: { $in: ['booked', 'maintenance'] }
    });

    if (existing) {
      if (existing.status === 'maintenance') {
        // Toggle unblock
        await LaundrySlot.findByIdAndDelete(existing._id);
        return res.status(200).json({ success: true, message: 'Maintenance block removed. Slot is now available.' });
      }
      return res.status(400).json({ success: false, message: 'Slot is currently booked by a student. Cancel booking first.' });
    }

    // Block slot for maintenance
    const blocked = await LaundrySlot.create({
      student: req.user._id, // admin placeholder
      hostel,
      date,
      timeSlot,
      machineNumber: 1,
      status: 'maintenance',
      notes
    });

    return res.status(201).json({ success: true, message: 'Slot blocked for maintenance', data: blocked });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
