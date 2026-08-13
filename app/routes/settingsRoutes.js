const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// GET settings (Public)
router.get('/', settingsController.getSettings);

// PUT settings (Admin only)
router.put('/', authenticateToken, authorizeRole('admin'), settingsController.updateSettings);

module.exports = router;
