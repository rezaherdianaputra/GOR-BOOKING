const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { sendBookingEmail } = require('../config/nodemailer');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'proofs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Upload proof of payment (Customer)
const uploadProof = async (req, res) => {
  const { bookingId } = req.body;
  const userId = req.user.id;

  if (!bookingId) {
    // Delete uploaded file if validation fails
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      message: 'Booking ID wajib disertakan.'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'File bukti transfer wajib diunggah.'
    });
  }

  try {
    // Verify booking belongs to user and is in WAITING_PAYMENT status
    const [bookings] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [bookingId, userId]
    );

    if (bookings.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Booking tidak ditemukan atau Anda tidak memiliki akses.'
      });
    }

    const booking = bookings[0];

    if (booking.status !== 'WAITING_PAYMENT') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: `Tidak dapat mengunggah bukti transfer. Status booking saat ini: ${booking.status}`
      });
    }

    // Get payment record to check countdown
    const [payments] = await db.query(
      'SELECT * FROM payments WHERE booking_id = ?',
      [bookingId]
    );

    if (payments.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Data pembayaran tidak ditemukan.'
      });
    }

    const payment = payments[0];
    const now = new Date();
    const countdownEnd = new Date(payment.countdown_end);

    if (countdownEnd < now || payment.status === 'EXPIRED') {
      if (req.file) fs.unlinkSync(req.file.path);
      
      // Update DB to EXPIRED if not already done
      await db.query("UPDATE bookings SET status = 'EXPIRED' WHERE id = ?", [bookingId]);
      await db.query("UPDATE payments SET status = 'EXPIRED' WHERE id = ?", [payment.id]);
      
      return res.status(400).json({
        success: false,
        message: 'Batas waktu pembayaran (10 menit) telah kedaluwarsa. Lapangan tidak dapat dipesan.'
      });
    }

    // Store relative file path
    const proofImagePath = `/uploads/proofs/${req.file.filename}`;

    // Update payment record
    await db.query(
      `UPDATE payments 
       SET proof_image = ?, status = 'WAITING_VERIFICATION' 
       WHERE booking_id = ?`,
      [proofImagePath, bookingId]
    );

    // Update booking status
    await db.query(
      `UPDATE bookings 
       SET status = 'WAITING_VERIFICATION' 
       WHERE id = ?`,
      [bookingId]
    );



    return res.json({
      success: true,
      message: 'Bukti transfer berhasil diunggah. Menunggu verifikasi dari Administrator.',
      proof_image: proofImagePath
    });
  } catch (error) {
    console.error('Upload Proof Error:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat mengunggah bukti transfer.'
    });
  }
};

// Get all payments (Admin only)
const getAllPayments = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  try {
    const [countRes] = await db.query('SELECT COUNT(*) as total FROM payments');
    const totalData = countRes[0].total;
    const totalPages = Math.ceil(totalData / limit) || 1;

    const [rows] = await db.query(`
      SELECT p.id as payment_id, p.amount, p.proof_image, p.status as payment_status, p.countdown_end, p.created_at,
             b.id as booking_id, b.sport, DATE_FORMAT(b.booking_date, '%Y-%m-%d') as booking_date,
             TIME_FORMAT(b.start_time, '%H:%i') as start_time, TIME_FORMAT(b.end_time, '%H:%i') as end_time,
             u.nama as customer_nama, u.email as customer_email, u.nomor_hp as customer_nomor_hp
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return res.json({
      success: true,
      pagination: {
        page,
        limit,
        totalData,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      payments: rows
    });
  } catch (error) {
    console.error('Get All Payments Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat data pembayaran.'
    });
  }
};

// Verify payment - Approve or Reject (Admin only)
const verifyPayment = async (req, res) => {
  const { id } = req.params; // payment_id
  const { action } = req.body; // 'approve' or 'reject'

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: "Aksi tidak valid. Harus 'approve' atau 'reject'."
    });
  }

  try {
    // Get payment & booking details
    const [payments] = await db.query(
      `SELECT p.*, b.user_id, b.sport, b.booking_date, b.start_time, b.end_time, b.duration, b.total_price
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE p.id = ?`,
      [id]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pembayaran tidak ditemukan.'
      });
    }

    const payment = payments[0];
    const bookingId = payment.booking_id;
    const customerId = payment.user_id;

    // Fetch user details for notification
    const [users] = await db.query('SELECT nama, email FROM users WHERE id = ?', [customerId]);
    const user = users[0];

    const dbBooking = {
      id: bookingId,
      sport: payment.sport,
      booking_date: payment.booking_date,
      start_time: payment.start_time,
      end_time: payment.end_time,
      duration: payment.duration,
      total_price: payment.total_price
    };

    if (action === 'approve') {
      // 1. Double check for scheduling conflicts
      const [conflicts] = await db.query(
        `SELECT id FROM bookings 
         WHERE booking_date = ? 
           AND status = 'CONFIRMED'
           AND id != ?
           AND start_time < ? 
           AND end_time > ?`,
        [payment.booking_date, bookingId, payment.end_time, payment.start_time]
      );

      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Terdapat booking lain yang sudah dikonfirmasi pada slot jam tersebut. Pembayaran tidak dapat disetujui.'
        });
      }

      // 2. Update payment and booking statuses
      await db.query("UPDATE payments SET status = 'PAID' WHERE id = ?", [id]);
      await db.query("UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?", [bookingId]);

      // 3. Create user notification
      await db.query(
        `INSERT INTO notifications (user_id, booking_id, message) 
         VALUES (?, ?, ?)`,
        [customerId, bookingId, `Pembayaran Anda untuk Booking #${bookingId} telah disetujui. Booking Anda telah dikonfirmasi! Telah dikirim email konfirmasi.`]
      );

      // 4. Send email notification
      dbBooking.status = 'CONFIRMED';
      sendBookingEmail(dbBooking, user, 'confirmed');

      return res.json({
        success: true,
        message: 'Pembayaran disetujui dan booking berhasil dikonfirmasi.'
      });
      
    } else {
      // Reject action
      const now = new Date();
      const countdownExpired = new Date(payment.countdown_end) < now;

      let nextBookingStatus = 'WAITING_PAYMENT';
      let nextPaymentStatus = 'REJECTED';
      let notificationMsg = `Bukti transfer untuk Booking #${bookingId} ditolak oleh admin. Silakan unggah bukti yang benar sebelum batas waktu habis.`;
      let emailType = 'rejected';

      if (countdownExpired) {
        nextBookingStatus = 'EXPIRED';
        nextPaymentStatus = 'EXPIRED';
        notificationMsg = `Bukti transfer untuk Booking #${bookingId} ditolak oleh admin dan batas waktu pembayaran telah habis. Booking Anda kedaluwarsa.`;
        emailType = 'expired';
      }

      // Update statuses
      await db.query("UPDATE payments SET status = ? WHERE id = ?", [nextPaymentStatus, id]);
      await db.query("UPDATE bookings SET status = ? WHERE id = ?", [nextBookingStatus, bookingId]);



      return res.json({
        success: true,
        message: `Pembayaran ditolak. Status booking saat ini: ${nextBookingStatus}.`
      });
    }
  } catch (error) {
    console.error('Verify Payment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memproses verifikasi pembayaran.'
    });
  }
};

module.exports = {
  uploadProof,
  getAllPayments,
  verifyPayment
};
