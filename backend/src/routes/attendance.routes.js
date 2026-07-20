const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const { getAttendance, markAttendance, updateAttendance } = require('../controllers/attendance.controller');

router.use(protect);
router.get('/', getAttendance);
router.post('/', adminOnly, markAttendance);
router.put('/:id', adminOnly, updateAttendance);

module.exports = router;
