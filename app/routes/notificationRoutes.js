const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get user notifications (All logged-in users)
router.get('/', authenticateToken, notificationController.getNotifications);

// Mark notifications as read
router.put('/read', authenticateToken, notificationController.markAsRead);

module.exports = router;
