const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const { getAllRooms, getRoomById, createRoom, updateRoom, deleteRoom } = require('../controllers/rooms.controller');

router.use(protect, resolveTenantContext);
router.get('/', adminOnly, getAllRooms);
router.get('/:id', adminOnly, getRoomById);
router.post('/', adminOnly, createRoom);
router.put('/:id', adminOnly, updateRoom);
router.delete('/:id', adminOnly, deleteRoom);

module.exports = router;

