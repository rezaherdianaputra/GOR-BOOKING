const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Customer stats
router.get('/customer', authenticateToken, authorizeRole('customer'), dashboardController.getCustomerDashboard);

// Admin stats
router.get('/admin', authenticateToken, authorizeRole('admin'), dashboardController.getAdminDashboard);

module.exports = router;
