const db = require('../config/db');
require('dotenv').config();

const PRICE_PER_HOUR = parseInt(process.env.GOR_PRICE_PER_HOUR || '100000', 10);

// Get schedule for a specific date or date range (Available vs Booked slots)
const getSchedule = async (req, res) => {
  let { date, start_date, end_date } = req.query;

  try {
    let bookings = [];

    if (start_date && end_date) {
      // Query bookings within the range
      [bookings] = await db.query(
        `SELECT id, sport, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date, 
                TIME_FORMAT(start_time, '%H:%i') as start_time, 
                TIME_FORMAT(end_time, '%H:%i') as end_time, 
                duration, status 
         FROM bookings 
         WHERE booking_date >= ? AND booking_date <= ? AND status IN ('pending', 'approved', 'completed')
         ORDER BY booking_date ASC, start_time ASC`,
        [start_date, end_date]
      );
    } else {
      if (!date) {
        // Default to today in YYYY-MM-DD format (local server time)
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localToday = new Date(today.getTime() - (offset * 60 * 1000));
        date = localToday.toISOString().split('T')[0];
      }

      // Select all bookings that are active on this date (not cancelled)
      [bookings] = await db.query(
        `SELECT id, sport, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date, 
                TIME_FORMAT(start_time, '%H:%i') as start_time, 
                TIME_FORMAT(end_time, '%H:%i') as end_time, 
                duration, status 
         FROM bookings 
         WHERE booking_date = ? AND status IN ('pending', 'approved', 'completed')
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

  if (isNaN(startHour) || startHour < 8 || startHour >= 22) {
    return res.status(400).json({
      success: false,
      message: 'Jam mulai harus berada di antara jam operasional (08:00 - 21:00).'
    });
  }

  const endHour = startHour + parsedDuration;

  // Validate operational hours limits (cannot exceed 22:00)
  if (endHour > 22) {
    return res.status(400).json({
      success: false,
      message: `Pemesanan melebihi jam operasional. Lapangan harus kosong pada pukul 22:00. Pilihan jam selesai Anda: ${endHour.toString().padStart(2, '0')}:00`
    });
  }

  // Format time values for database
  const formattedStartTime = `${startHour.toString().padStart(2, '0')}:00:00`;
  const formattedEndTime = `${endHour.toString().padStart(2, '0')}:00:00`;

  try {
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
         AND status IN ('pending', 'approved', 'completed')
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
    const total_price = parsedDuration * PRICE_PER_HOUR;

    // Insert booking
    await db.query(
      `INSERT INTO bookings (user_id, sport, booking_date, start_time, end_time, duration, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [user_id, sport, booking_date, formattedStartTime, formattedEndTime, parsedDuration, total_price]
    );

    return res.status(201).json({
      success: true,
      message: 'Booking berhasil diajukan dengan status Pending.'
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

  try {
    const [bookings] = await db.query(
      `SELECT id, sport, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date, 
              TIME_FORMAT(start_time, '%H:%i') as start_time, 
              TIME_FORMAT(end_time, '%H:%i') as end_time, 
              duration, total_price, status, created_at 
       FROM bookings 
       WHERE user_id = ? 
       ORDER BY booking_date DESC, start_time DESC`,
      [user_id]
    );

    return res.json({
      success: true,
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
  let query = `
    SELECT b.id, b.user_id, b.sport, DATE_FORMAT(b.booking_date, '%Y-%m-%d') as booking_date, 
           TIME_FORMAT(b.start_time, '%H:%i') as start_time, 
           TIME_FORMAT(b.end_time, '%H:%i') as end_time, 
           b.duration, b.total_price, b.status, b.created_at,
           u.nama as customer_nama, u.email as customer_email, u.nomor_hp as customer_nomor_hp
    FROM bookings b
    JOIN users u ON b.user_id = u.id
  `;
  const params = [];

  if (date) {
    query += ` WHERE b.booking_date = ?`;
    params.push(date);
  } else if (start_date && end_date) {
    query += ` WHERE b.booking_date >= ? AND b.booking_date <= ?`;
    params.push(start_date, end_date);
  }

  query += ` ORDER BY b.booking_date DESC, b.start_time DESC`;

  try {
    const [bookings] = await db.query(query, params);
    return res.json({
      success: true,
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

  const validStatuses = ['approved', 'cancelled', 'completed'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status tidak valid. Harus salah satu dari: approved, cancelled, completed'
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

    // If changing to 'approved', verify that there's no conflict in case another booking was approved in the meantime
    // Wait! In this system, since Pending immediately blocks the slot, we check for conflicts at creation.
    // However, if the booking is currently 'cancelled' and being re-approved, or if we want to double check:
    if (status === 'approved' && currentBooking.status !== 'approved') {
      const [conflicts] = await db.query(
        `SELECT id FROM bookings 
         WHERE booking_date = ? 
           AND status IN ('approved', 'completed')
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
