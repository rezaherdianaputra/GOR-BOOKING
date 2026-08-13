const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Public routes
router.get('/captcha', authController.getCaptcha);
router.post('/register', authController.register);
router.post('/verify-register-otp', authController.verifyRegisterOTP);
router.post('/resend-register-otp', authController.resendRegisterOTP);
router.post('/login', authController.login);

// Protected routes (available for authenticated users)
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);

// Admin-only routes
router.get('/users', authenticateToken, authorizeRole('admin'), authController.getAllUsers);

module.exports = router;
