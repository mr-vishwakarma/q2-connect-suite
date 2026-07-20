const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const { getNotifications, markAsRead, markAllAsRead, broadcastNotification, deleteNotification } = require('../controllers/notifications.controller');

router.use(protect);
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.post('/broadcast', adminOnly, broadcastNotification);
router.delete('/:id', adminOnly, deleteNotification);

module.exports = router;
