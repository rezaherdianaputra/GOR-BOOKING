const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Public route to view court availability schedule
router.get('/schedule', bookingController.getSchedule);

// Customer routes
router.post('/', authenticateToken, authorizeRole('customer'), bookingController.createBooking);
router.get('/my', authenticateToken, authorizeRole('customer'), bookingController.getMyBookings);

// Admin routes
router.get('/', authenticateToken, authorizeRole('admin'), bookingController.getAllBookings);
router.put('/:id/status', authenticateToken, authorizeRole('admin'), bookingController.updateBookingStatus);

module.exports = router;
