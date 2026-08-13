const db = require('../config/db');
const { sendBookingEmail } = require('../config/nodemailer');
const { checkExpiredBookings } = require('../utils/expiryChecker');
require('dotenv').config();

// Helper to get settings as dictionary
const getSettingsMap = async () => {
  const [rows] = await db.query('SELECT `key`, value FROM settings');
  const settings = {};
  rows.forEach(r => {
    settings[r.key] = r.value;
  });
  return settings;
};

// Get schedule for a specific date or date range (Available vs Booked slots)
const getSchedule = async (req, res) => {
  let { date, start_date, end_date } = req.query;

  try {
    // Run lazy clean on expired bookings
    await checkExpiredBookings();

    let bookings = [];

    // Filter using only active status that blocks slots
    // Blocked statuses: WAITING_PAYMENT, WAITING_VERIFICATION, CONFIRMED
    if (start_date && end_date) {
      [bookings] = await db.query(
        `SELECT id, sport, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date, 
                TIME_FORMAT(start_time, '%H:%i') as start_time, 
                TIME_FORMAT(end_time, '%H:%i') as end_time, 
                duration, status 
         FROM bookings 
         WHERE booking_date >= ? AND booking_date <= ? 
           AND status IN ('WAITING_PAYMENT', 'WAITING_VERIFICATION', 'CONFIRMED')
         ORDER BY booking_date ASC, start_time ASC`,
        [start_date, end_date]
      );
    } else {
      if (!date) {
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localToday = new Date(today.getTime() - (offset * 60 * 1000));
        date = localToday.toISOString().split('T')[0];
      }

      [bookings] = await db.query(
        `SELECT id, sport, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date, 
                TIME_FORMAT(start_time, '%H:%i') as start_time, 
                TIME_FORMAT(end_time, '%H:%i') as end_time, 
                duration, status 
         FROM bookings 
         WHERE booking_date = ? 
           AND status IN ('WAITING_PAYMENT', 'WAITING_VERIFICATION', 'CONFIRMED')
         ORDER BY start_time ASC`,
        [date]
      );
    }

    return res.json({
      success: true,
      date,
      start_date,
      end_date,
      bookings
    });
  } catch (error) {
    console.error('Get Schedule Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat jadwal.'
    });
  }
};

// Create a new booking
const createBooking = async (req, res) => {
  const { sport, booking_date, start_time, duration } = req.body;
  const user_id = req.user.id;

  // Validate inputs
  if (!sport || !booking_date || !start_time || !duration) {
    return res.status(400).json({
      success: false,
      message: 'Semua field booking wajib diisi.'
    });
  }

  // Parse duration and start time hour
  const parsedDuration = parseInt(duration, 10);
  const startHour = parseInt(start_time.split(':')[0], 10);

  if (isNaN(parsedDuration) || parsedDuration <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Durasi booking harus berupa angka positif.'
    });
  }

  try {
    // Run lazy clean on expired bookings
    await checkExpiredBookings();

    // Fetch settings dynamically
    const settings = await getSettingsMap();
    const pricePerHour = parseInt(settings.price_per_hour || '100000', 10);
    const operationalStart = parseInt((settings.operational_hours_start || '08:00').split(':')[0], 10);
    const operationalEnd = parseInt((settings.operational_hours_end || '22:00').split(':')[0], 10);

    if (isNaN(startHour) || startHour < operationalStart || startHour >= operationalEnd) {
      return res.status(400).json({
        success: false,
        message: `Jam mulai harus berada di antara jam operasional (${settings.operational_hours_start || '08:00'} - ${(operationalEnd - 1).toString().padStart(2, '0')}:00).`
      });
    }

    const endHour = startHour + parsedDuration;

    // Validate operational hours limits (cannot exceed operationalEnd)
    if (endHour > operationalEnd) {
      return res.status(400).json({
        success: false,
        message: `Pemesanan melebihi jam operasional. Lapangan harus kosong pada pukul ${settings.operational_hours_end || '22:00'}. Pilihan jam selesai Anda: ${endHour.toString().padStart(2, '0')}:00`
      });
    }

    // Format time values for database
    const formattedStartTime = `${startHour.toString().padStart(2, '0')}:00:00`;
    const formattedEndTime = `${endHour.toString().padStart(2, '0')}:00:00`;

    // Validate that the booking is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDateObj = new Date(booking_date);
    bookingDateObj.setHours(0, 0, 0, 0);

    if (bookingDateObj < today) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat memesan lapangan untuk tanggal di masa lalu.'
      });
    }

    // Check conflict/overlap
    // Condition: A booking overlaps if: start_time < new_end_time AND end_time > new_start_time
    const [conflicts] = await db.query(
      `SELECT id FROM bookings 
       WHERE booking_date = ? 
         AND status IN ('WAITING_PAYMENT', 'WAITING_VERIFICATION', 'CONFIRMED')
         AND start_time < ? 
         AND end_time > ?`,
      [booking_date, formattedEndTime, formattedStartTime]
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Jadwal yang Anda pilih sudah terisi atau bertabrakan dengan pesanan lain.'
      });
    }

    // Calculate total price
    const total_price = parsedDuration * pricePerHour;

    // Generate unique custom Booking ID (BK-YYMMDD-XXXX)
    let bookingId = '';
    let isUnique = false;
    while (!isUnique) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let randomPart = '';
      for (let i = 0; i < 4; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const today = new Date();
      const yy = today.getFullYear().toString().slice(-2);
      const mm = (today.getMonth() + 1).toString().padStart(2, '0');
      const dd = today.getDate().toString().padStart(2, '0');
      bookingId = `BK-${yy}${mm}${dd}-${randomPart}`;

      const [existing] = await db.query('SELECT id FROM bookings WHERE id = ?', [bookingId]);
      if (existing.length === 0) {
        isUnique = true;
      }
    }

    // Insert booking (status starts as WAITING_PAYMENT)
    await db.query(
      `INSERT INTO bookings (id, user_id, sport, booking_date, start_time, end_time, duration, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'WAITING_PAYMENT')`,
      [bookingId, user_id, sport, booking_date, formattedStartTime, formattedEndTime, parsedDuration, total_price]
    );

    // Create payment entry with 10 minutes countdown
    // countdown_end is 10 minutes from now (JS generated to avoid DB timezone mismatch)
    const countdownEnd = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      `INSERT INTO payments (booking_id, amount, status, countdown_end)
       VALUES (?, ?, 'PENDING', ?)`,
      [bookingId, total_price, countdownEnd]
    );





    return res.status(201).json({
      success: true,
      message: 'Booking berhasil diajukan. Selesaikan pembayaran dalam 10 menit.',
      bookingId
    });
  } catch (error) {
    console.error('Create Booking Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memproses pemesanan.'
    });
  }
};

// Get personal booking history (Customer only)
const getMyBookings = async (req, res) => {
  const user_id = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  try {
    // Run lazy clean on expired/completed bookings
    await checkExpiredBookings();

    const [countRes] = await db.query(
      'SELECT COUNT(*) as total FROM bookings WHERE user_id = ?',
      [user_id]
    );
    const totalData = countRes[0].total;
    const totalPages = Math.ceil(totalData / limit) || 1;

    const [bookings] = await db.query(
      `SELECT b.id, b.sport, DATE_FORMAT(b.booking_date, '%Y-%m-%d') as booking_date, 
              TIME_FORMAT(b.start_time, '%H:%i') as start_time, 
              TIME_FORMAT(b.end_time, '%H:%i') as end_time, 
              b.duration, b.total_price, b.status, b.created_at,
              p.status as payment_status,
              p.countdown_end
       FROM bookings b
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.user_id = ? 
       ORDER BY b.booking_date DESC, b.start_time DESC
       LIMIT ? OFFSET ?`,
      [user_id, limit, offset]
    );

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
      bookings
    });
  } catch (error) {
    console.error('Get My Bookings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat riwayat pemesanan.'
    });
  }
};

// Get all bookings (Admin only)
const getAllBookings = async (req, res) => {
  const { date, start_date, end_date } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  let baseWhere = '';
  const params = [];

  if (date) {
    baseWhere = ` WHERE b.booking_date = ?`;
    params.push(date);
  } else if (start_date && end_date) {
    baseWhere = ` WHERE b.booking_date >= ? AND b.booking_date <= ?`;
    params.push(start_date, end_date);
  }

  try {
    // Run lazy clean on expired/completed bookings
    await checkExpiredBookings();

    const countQuery = `SELECT COUNT(*) as total FROM bookings b ${baseWhere}`;
    const [countRes] = await db.query(countQuery, params);
    const totalData = countRes[0].total;
    const totalPages = Math.ceil(totalData / limit) || 1;

    let query = `
      SELECT b.id, b.user_id, b.sport, DATE_FORMAT(b.booking_date, '%Y-%m-%d') as booking_date, 
             TIME_FORMAT(b.start_time, '%H:%i') as start_time, 
             TIME_FORMAT(b.end_time, '%H:%i') as end_time, 
             b.duration, b.total_price, b.status, b.created_at,
             u.nama as customer_nama, u.email as customer_email, u.nomor_hp as customer_nomor_hp,
             p.proof_image, p.status as payment_status, p.id as payment_id
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN payments p ON b.id = p.booking_id
      ${baseWhere}
      ORDER BY b.booking_date DESC, b.start_time DESC
      LIMIT ? OFFSET ?
    `;

    const [bookings] = await db.query(query, [...params, limit, offset]);
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
      bookings
    });
  } catch (error) {
    console.error('Get All Bookings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat semua pemesanan.'
    });
  }
};

// Update booking status (Admin only)
const updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status tidak valid. Harus salah satu dari: CONFIRMED, CANCELLED, COMPLETED, EXPIRED'
    });
  }

  try {
    // Check if the booking exists
    const [bookings] = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking tidak ditemukan.'
      });
    }

    const currentBooking = bookings[0];

    // If changing to 'CONFIRMED', verify that there's no conflict
    if (status === 'CONFIRMED' && currentBooking.status !== 'CONFIRMED') {
      const [conflicts] = await db.query(
        `SELECT id FROM bookings 
         WHERE booking_date = ? 
           AND status = 'CONFIRMED'
           AND id != ?
           AND start_time < ? 
           AND end_time > ?`,
        [
          currentBooking.booking_date, 
          id, 
          currentBooking.end_time, 
          currentBooking.start_time
        ]
      );

      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Gagal menyetujui. Terdapat pemesanan lain yang telah disetujui di slot waktu yang sama.'
        });
      }
    }

    // Update status
    await db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);

    // Sync corresponding payment status
    if (status === 'CONFIRMED') {
      await db.query("UPDATE payments SET status = 'PAID' WHERE booking_id = ?", [id]);
    } else if (status === 'CANCELLED') {
      await db.query("UPDATE payments SET status = 'REJECTED' WHERE booking_id = ?", [id]);
    } else if (status === 'EXPIRED') {
      await db.query("UPDATE payments SET status = 'EXPIRED' WHERE booking_id = ?", [id]);
    }

    // Fetch user details for notification
    const [users] = await db.query('SELECT nama, email FROM users WHERE id = ?', [currentBooking.user_id]);
    if (users.length > 0) {
      const user = users[0];
      const updatedBooking = { ...currentBooking, status };
      
      // Only notify user and send email if status is CONFIRMED
      if (status === 'CONFIRMED') {
        await db.query(
          'INSERT INTO notifications (user_id, booking_id, message) VALUES (?, ?, ?)',
          [currentBooking.user_id, id, `Pembayaran Anda untuk Booking #${id} telah disetujui. Booking Anda telah dikonfirmasi!`]
        );
        sendBookingEmail(updatedBooking, user, 'confirmed');
      }
    }

    return res.json({
      success: true,
      message: `Status booking berhasil diperbarui menjadi: ${status}`
    });
  } catch (error) {
    console.error('Update Booking Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memperbarui status booking.'
    });
  }
};

module.exports = {
  getSchedule,
  createBooking,
  getMyBookings,
  getAllBookings,
  updateBookingStatus
};
