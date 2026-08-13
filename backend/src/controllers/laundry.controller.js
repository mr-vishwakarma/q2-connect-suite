const LaundrySlot = require('../models/LaundrySlot');
const Student = require('../models/Student');
const moment = require('moment');

// Config
const TOTAL_MACHINES = 4;
// Operating hours: 06:00 to 22:00 (16 slots per machine per day)
const OPERATING_HOURS = [
  '06:00-07:00', '07:00-08:00', '08:00-09:00', '09:00-10:00',
  '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
  '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
  '18:00-19:00', '19:00-20:00', '20:00-21:00', '21:00-22:00'
];

exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query; // format: YYYY-MM-DD
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    // Get all booked slots for the day
    const bookings = await LaundrySlot.find({ date, status: 'booked' }).populate('student', 'firstName lastName roomNumber');

    res.status(200).json({
      success: true,
      data: {
        totalMachines: TOTAL_MACHINES,
        operatingHours: OPERATING_HOURS,
        bookings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bookSlot = async (req, res) => {
  try {
    const { date, timeSlot, machineNumber } = req.body;
    const studentId = req.user.studentId;

    if (!date || !timeSlot || !machineNumber) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Check if student already has a booking for this date (Limit: 1 slot per day)
    const existingStudentBooking = await LaundrySlot.findOne({
      student: studentId,
      date,
      status: 'booked'
    });

    if (existingStudentBooking) {
      return res.status(400).json({ success: false, message: 'You have already booked a laundry slot for this day. Limit is 1 slot per day.' });
    }

    // Check if the specific machine and time slot is already booked
    const existingMachineBooking = await LaundrySlot.findOne({
      date,
      timeSlot,
      machineNumber,
      status: 'booked'
    });

    if (existingMachineBooking) {
      return res.status(400).json({ success: false, message: 'This slot is already booked by someone else.' });
    }

    const newBooking = await LaundrySlot.create({
      student: studentId,
      date,
      timeSlot,
      machineNumber,
      status: 'booked'
    });

    res.status(201).json({
      success: true,
      message: 'Slot booked successfully',
      data: newBooking
    });
  } catch (error) {
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

    // Check if the user is the owner or an admin
    if (req.user.role === 'student' && booking.student.toString() !== req.user.studentId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    const bookings = await LaundrySlot.find({ student: studentId })
      .sort({ date: -1, timeSlot: 1 })
      .limit(10); // get latest 10 bookings

    res.status(200).json({
      success: true,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
