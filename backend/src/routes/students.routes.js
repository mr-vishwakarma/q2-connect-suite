const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly, adminOrWarden } = require('../middleware/admin.middleware');
const { getAllStudents, getStudent, createStudent, updateStudent, deleteStudent } = require('../controllers/students.controller');

router.use(protect);

router.get('/', adminOrWarden, getAllStudents);
router.post('/', adminOnly, createStudent);
router.get('/:id', getStudent); // admin or own student
router.put('/:id', adminOnly, updateStudent);
router.delete('/:id', adminOnly, deleteStudent);

module.exports = router;
