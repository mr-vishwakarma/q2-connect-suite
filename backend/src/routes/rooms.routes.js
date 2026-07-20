const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const { getAllRooms, createRoom, updateRoom, deleteRoom } = require('../controllers/rooms.controller');

router.use(protect);
router.get('/', adminOnly, getAllRooms);
router.post('/', adminOnly, createRoom);
router.put('/:id', adminOnly, updateRoom);
router.delete('/:id', adminOnly, deleteRoom);

module.exports = router;
