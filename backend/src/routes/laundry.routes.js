const express = require('express');
const router = express.Router();
const { 
  getAvailableSlots, 
  bookSlot, 
  cancelBooking, 
  getMyBookings 
} = require('../controllers/laundry.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// Student routes
router.post('/book', authorize('student'), bookSlot);
router.get('/my-bookings', authorize('student'), getMyBookings);

// Admin & Student routes
router.get('/slots', getAvailableSlots);
router.delete('/cancel/:id', cancelBooking);

module.exports = router;
