const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Student = require('../models/Student');

const getNotifications = async (req, res) => {
  try {
    const { hostel } = req.query;
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const query = {};

    // Enforce Tenant Scoping
    if (!isSuperAdmin) {
      query.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      query.organizationId = orgId;
    }

    if (hostel && hostel !== 'All') query.hostel = hostel;

    if (req.user.role === 'student') {
      query.userId = req.user._id;
    }

    const notifications = await Notification.find(query)
      .populate('userId', 'name email username studentId')
      .sort({ createdAt: -1 })
      .limit(req.user.role === 'admin' ? 200 : 50);
      
    let unreadCount = 0;
    if (req.user.role === 'student') {
      unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    }

    return res.status(200).json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: broadcast notification to a hostel or specific user within own tenant
const broadcastNotification = async (req, res) => {
  try {
    const { hostel, title, message, type, recipient } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required' });
    }

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    if (!isSuperAdmin && !orgId) {
      return res.status(403).json({ success: false, message: 'Organization tenant context required' });
    }

    const studentQuery = {};
    if (!isSuperAdmin) {
      studentQuery.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      studentQuery.organizationId = orgId;
    }
    
    let targetUserIds = [];
    if (recipient && recipient !== 'all') {
      studentQuery._id = recipient;
      const student = await Student.findOne(studentQuery);
      if (student && student.userId) targetUserIds.push(student.userId);
    } else {
      if (hostel && hostel !== 'All') studentQuery.hostel = hostel;
      const students = await Student.find(studentQuery).select('userId');
      targetUserIds = students.map(s => s.userId).filter(Boolean);
    }

    if (targetUserIds.length === 0) {
      return res.status(404).json({ success: false, message: 'No students found to notify in your organization' });
    }

    const notifications = targetUserIds.map(userId => ({
      userId,
      organizationId: orgId || null,
      hostel,
      title,
      message,
      type: type || 'info',
    }));

    await Notification.insertMany(notifications);
    
    if (req.io) {
      targetUserIds.forEach(id => req.io.to(id.toString()).emit('notification', { title, message, type }));
      req.io.emit('notifications-updated');
    }

    return res.status(201).json({ success: true, message: `Sent to ${targetUserIds.length} students` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const filter = { _id: req.params.id };
    if (!isSuperAdmin) {
      filter.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      filter.organizationId = orgId;
    }

    const notification = await Notification.findOneAndDelete(filter);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found in your organization' });
    
    if (req.io) req.io.emit('notifications-updated');
    return res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, broadcastNotification, deleteNotification };

