const db = require('../config/db');
const { sendBookingEmail } = require('../config/nodemailer');

/**
 * Checks for confirmed bookings whose rental end time has passed,
 * and automatically marks them as COMPLETED.
 */
const checkCompletedBookings = async () => {
  try {
    // Get the current local time of the Node.js server (which is in local timezone)
    // formatted as 'YYYY-MM-DD HH:mm:ss' to match the database values.
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localTime = new Date(today.getTime() - (offset * 60 * 1000));
    const formattedNow = localTime.toISOString().slice(0, 19).replace('T', ' ');

    // Find all bookings with status = 'CONFIRMED' where the end time is in the past.
    // We pass formattedNow as a parameter to compare local times correctly.
    const [ended] = await db.query(`
      SELECT b.id, b.user_id, b.sport, DATE_FORMAT(b.booking_date, '%Y-%m-%d') as booking_date,
             TIME_FORMAT(b.start_time, '%H:%i') as start_time, TIME_FORMAT(b.end_time, '%H:%i') as end_time,
             b.duration, b.total_price,
             u.nama as customer_nama, u.email as customer_email
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.status = 'CONFIRMED' AND CAST(CONCAT(b.booking_date, ' ', b.end_time) AS DATETIME) < ?
    `, [formattedNow]);

    if (ended.length === 0) {
      return;
    }

    console.log(`Found ${ended.length} completed booking(s) that have ended. Processing auto-completion...`);

    for (const b of ended) {
      const bookingId = b.id;
      const userId = b.user_id;

      // 1. Update status in bookings table
      await db.query("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?", [bookingId]);




    }

    console.log('Completed bookings processing finished.');
  } catch (error) {
    console.error('Error during completed bookings check:', error.message);
  }
};

/**
 * Checks for expired bookings (where payment has been pending for over 10 minutes)
 * and updates their status in the database, inserts notifications, and sends emails.
 * Also checks and auto-completes bookings that have ended their rental duration.
 */
const checkExpiredBookings = async () => {
  try {
    // 1. Process expired pending payments (using JS Date to avoid DB timezone mismatch)
    const now = new Date();
    const [expired] = await db.query(`
      SELECT p.id as payment_id, p.booking_id, p.amount,
             b.user_id, b.sport, DATE_FORMAT(b.booking_date, '%Y-%m-%d') as booking_date,
             TIME_FORMAT(b.start_time, '%H:%i') as start_time, TIME_FORMAT(b.end_time, '%H:%i') as end_time,
             b.duration, b.total_price,
             u.nama as customer_nama, u.email as customer_email
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE p.status = 'PENDING' AND p.countdown_end < ?
    `, [now]);

    if (expired.length > 0) {
      console.log(`Found ${expired.length} expired pending payment(s). Processing cancellation...`);

      for (const p of expired) {
        const paymentId = p.payment_id;
        const bookingId = p.booking_id;
        const userId = p.user_id;

        // Update status in payments
        await db.query("UPDATE payments SET status = 'EXPIRED' WHERE id = ?", [paymentId]);

        // Update status in bookings
        await db.query("UPDATE bookings SET status = 'EXPIRED' WHERE id = ?", [bookingId]);




      }

      console.log('Expired bookings processing completed.');
    }

    // 2. Process completed active bookings
    await checkCompletedBookings();

    // 3. Clean up expired captchas and temporary registrations
    try {
      await db.query("DELETE FROM captchas WHERE expires_at < NOW()");
      await db.query("DELETE FROM temp_registrations WHERE expires_at < NOW()");
    } catch (cleanupErr) {
      console.error('Error during captcha/otp table cleanup:', cleanupErr.message);
    }

  } catch (error) {
    console.error('Error during expired bookings check:', error.message);
  }
};

module.exports = {
  checkExpiredBookings,
  checkCompletedBookings
};
