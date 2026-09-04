const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly, adminOrWarden } = require('../middleware/admin.middleware');
const {
  getAllStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  updateOwnProfile,
  getAlertsCount,
  getAlertStudents,
  getPendingRegistrations,
  approveRegistration,
  approveAndRegisterStudent,
  rejectRegistration,
} = require('../controllers/students.controller');

router.use(protect);

router.put('/profile', updateOwnProfile); // student updating own profile
router.get('/alerts/count', adminOrWarden, getAlertsCount);
router.get('/alerts', adminOrWarden, getAlertStudents);
router.get('/pending-registrations', adminOrWarden, getPendingRegistrations);
router.post('/approve-registration/:id', adminOnly, approveRegistration);
router.post('/approve-and-register/:id', adminOnly, approveAndRegisterStudent);
router.post('/reject-registration/:id', adminOnly, rejectRegistration);
router.get('/', adminOrWarden, getAllStudents);
router.post('/', adminOnly, createStudent);
router.get('/:id', getStudent); // admin or own student
router.put('/:id', adminOnly, updateStudent);
router.delete('/:id', adminOnly, deleteStudent);

module.exports = router;
