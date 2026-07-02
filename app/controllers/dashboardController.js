const db = require('../config/db');

// Get customer dashboard metrics
const getCustomerDashboard = async (req, res) => {
  const user_id = req.user.id;

  try {
    // 1. Total bookings count
    const [totalRes] = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = ?',
      [user_id]
    );
    const totalBookings = totalRes[0].count;

    // 2. Today's bookings count (active status only)
    const [todayRes] = await db.query(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE user_id = ? AND booking_date = CURDATE() AND status IN ('pending', 'approved', 'completed')`,
      [user_id]
    );
    const todayBookings = todayRes[0].count;

    // 3. Next upcoming booking (pending or approved, starting from today/now)
    const [nextRes] = await db.query(
      `SELECT id, sport, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date, 
              TIME_FORMAT(start_time, '%H:%i') as start_time, duration, status
       FROM bookings
       WHERE user_id = ?
         AND status IN ('pending', 'approved')
         AND (booking_date > CURDATE() OR (booking_date = CURDATE() AND start_time >= CURRENT_TIME()))
       ORDER BY booking_date ASC, start_time ASC
       LIMIT 1`,
      [user_id]
    );
    const nextBooking = nextRes.length > 0 ? nextRes[0] : null;

    // 4. Recent bookings (last 3, regardless of status)
    const [recentRes] = await db.query(
      `SELECT id, sport, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date, 
              TIME_FORMAT(start_time, '%H:%i') as start_time, TIME_FORMAT(end_time, '%H:%i') as end_time, 
              duration, total_price, status 
       FROM bookings 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 3`,
      [user_id]
    );

    return res.json({
      success: true,
      stats: {
        totalBookings,
        todayBookings,
        nextBooking,
        recentBookings: recentRes
      }
    });
  } catch (error) {
    console.error('Customer Dashboard Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat dashboard.'
    });
  }
};

// Get admin dashboard metrics
const getAdminDashboard = async (req, res) => {
  try {
    // 1. Total active users (customers)
    const [usersRes] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'customer'"
    );
    const totalUsers = usersRes[0].count;

    // 2. Total all bookings
    const [bookingsRes] = await db.query(
      'SELECT COUNT(*) as count FROM bookings'
    );
    const totalBookings = bookingsRes[0].count;

    // 3. Bookings scheduled for today
    const [todayRes] = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE booking_date = CURDATE()'
    );
    const bookingsToday = todayRes[0].count;

    // 4. Bookings scheduled for this calendar week (Mon-Sun)
    const [weekRes] = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE YEARWEEK(booking_date, 1) = YEARWEEK(CURDATE(), 1)'
    );
    const bookingsThisWeek = weekRes[0].count;

    // 5. Bookings scheduled for this calendar month
    const [monthRes] = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE MONTH(booking_date) = MONTH(CURDATE()) AND YEAR(booking_date) = YEAR(CURDATE())'
    );
    const bookingsThisMonth = monthRes[0].count;

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalBookings,
        bookingsToday,
        bookingsThisWeek,
        bookingsThisMonth
      }
    });
  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat dashboard admin.'
    });
  }
};

module.exports = {
  getCustomerDashboard,
  getAdminDashboard
};
