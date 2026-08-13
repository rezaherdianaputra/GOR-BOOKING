const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads', 'proofs'));
  },
  filename: (req, file, cb) => {
    // Save with unique name: bookingId_timestamp.ext or user_timestamp.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Hanya file JPG, JPEG, dan PNG yang diizinkan.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Customer route to upload proof
router.post('/upload', 
  authenticateToken, 
  authorizeRole('customer'), 
  (req, res, next) => {
    upload.single('proof')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: 'Ukuran file terlalu besar. Maksimal 5 MB.' });
        }
        return res.status(400).json({ success: false, message: err.message });
      } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  paymentController.uploadProof
);

// Admin route to view all payments
router.get('/all', authenticateToken, authorizeRole('admin'), paymentController.getAllPayments);

// Admin route to verify payment (Approve/Reject)
router.post('/:id/verify', authenticateToken, authorizeRole('admin'), paymentController.verifyPayment);

module.exports = router;
