const db = require('../config/db');
const { checkExpiredBookings } = require('../utils/expiryChecker');

// Get customer dashboard metrics
const getCustomerDashboard = async (req, res) => {
  const user_id = req.user.id;

  try {
    // Run lazy clean on expired/completed bookings
    await checkExpiredBookings();
    // 1. Total bookings count
    const [totalRes] = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = ?',
      [user_id]
    );
    const totalBookings = totalRes[0].count;

    // 2. Today's bookings count (active status only)
    const [todayRes] = await db.query(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE user_id = ? AND booking_date = CURDATE() AND status IN ('WAITING_PAYMENT', 'WAITING_VERIFICATION', 'CONFIRMED', 'COMPLETED')`,
      [user_id]
    );
    const todayBookings = todayRes[0].count;

    // 3. Next upcoming booking (active statuses, starting from today/now)
    const [nextRes] = await db.query(
      `SELECT id, sport, DATE_FORMAT(booking_date, '%Y-%m-%d') as booking_date, 
              TIME_FORMAT(start_time, '%H:%i') as start_time, duration, status
       FROM bookings
       WHERE user_id = ?
         AND status IN ('WAITING_PAYMENT', 'WAITING_VERIFICATION', 'CONFIRMED')
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
    // Run lazy clean on expired/completed bookings
    await checkExpiredBookings();
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

// Get monthly bookkeeping/revenue report (Admin only)
const getMonthlyReport = async (req, res) => {
  const { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({
      success: false,
      message: 'Parameter year dan month wajib disertakan.'
    });
  }

  try {
    // 1. Fetch detailed bookings representing revenue (status is CONFIRMED or COMPLETED)
    const [bookings] = await db.query(
      `SELECT b.id, b.sport, DATE_FORMAT(b.booking_date, '%Y-%m-%d') as booking_date, 
              TIME_FORMAT(b.start_time, '%H:%i') as start_time, TIME_FORMAT(b.end_time, '%H:%i') as end_time, 
              b.duration, b.total_price, u.nama as customer_nama
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE YEAR(b.booking_date) = ? AND MONTH(b.booking_date) = ?
         AND b.status IN ('CONFIRMED', 'COMPLETED')
       ORDER BY b.booking_date ASC, b.start_time ASC`,
      [year, month]
    );

    // 2. Query summary statistics
    const [summaryRes] = await db.query(
      `SELECT COALESCE(SUM(total_price), 0) as totalRevenue, COUNT(*) as totalBookings
       FROM bookings
       WHERE YEAR(booking_date) = ? AND MONTH(booking_date) = ?
         AND status IN ('CONFIRMED', 'COMPLETED')`,
      [year, month]
    );

    const totalRevenue = parseFloat(summaryRes[0].totalRevenue);
    const totalBookings = parseInt(summaryRes[0].totalBookings, 10);
    const avgRevenue = totalBookings > 0 ? (totalRevenue / totalBookings) : 0;

    // 3. Query breakdown by cabor (sport)
    const [caborRes] = await db.query(
      `SELECT sport, COUNT(*) as count, COALESCE(SUM(duration), 0) as totalDuration, COALESCE(SUM(total_price), 0) as revenue
       FROM bookings
       WHERE YEAR(booking_date) = ? AND MONTH(booking_date) = ?
         AND status IN ('CONFIRMED', 'COMPLETED')
       GROUP BY sport
       ORDER BY revenue DESC`,
      [year, month]
    );

    const caborBreakdown = caborRes.map(c => ({
      sport: c.sport,
      count: parseInt(c.count, 10),
      totalDuration: parseInt(c.totalDuration, 10),
      revenue: parseFloat(c.revenue)
    }));

    return res.json({
      success: true,
      summary: {
        totalRevenue,
        totalBookings,
        avgRevenue
      },
      caborBreakdown,
      bookings
    });

  } catch (error) {
    console.error('Monthly Report Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat laporan bulanan.'
    });
  }
};

// Get annual bookkeeping/revenue report (Admin only)
const getAnnualReport = async (req, res) => {
  const { year } = req.query;

  if (!year) {
    return res.status(400).json({
      success: false,
      message: 'Parameter year wajib disertakan.'
    });
  }

  try {
    // 1. Fetch detailed bookings representing revenue for the year (status is CONFIRMED or COMPLETED)
    const [bookings] = await db.query(
      `SELECT b.id, b.sport, DATE_FORMAT(b.booking_date, '%Y-%m-%d') as booking_date, 
              TIME_FORMAT(b.start_time, '%H:%i') as start_time, TIME_FORMAT(b.end_time, '%H:%i') as end_time, 
              b.duration, b.total_price, u.nama as customer_nama
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE YEAR(b.booking_date) = ?
         AND b.status IN ('CONFIRMED', 'COMPLETED')
       ORDER BY b.booking_date ASC, b.start_time ASC`,
      [year]
    );

    // 2. Query summary statistics for the year
    const [summaryRes] = await db.query(
      `SELECT COALESCE(SUM(total_price), 0) as totalRevenue, COUNT(*) as totalBookings
       FROM bookings
       WHERE YEAR(booking_date) = ?
         AND status IN ('CONFIRMED', 'COMPLETED')`,
      [year]
    );

    const totalRevenue = parseFloat(summaryRes[0].totalRevenue);
    const totalBookings = parseInt(summaryRes[0].totalBookings, 10);
    const avgRevenue = totalBookings > 0 ? (totalRevenue / totalBookings) : 0;

    // 3. Query breakdown by cabor (sport) for the year
    const [caborRes] = await db.query(
      `SELECT sport, COUNT(*) as count, COALESCE(SUM(duration), 0) as totalDuration, COALESCE(SUM(total_price), 0) as revenue
       FROM bookings
       WHERE YEAR(booking_date) = ?
         AND status IN ('CONFIRMED', 'COMPLETED')
       GROUP BY sport
       ORDER BY revenue DESC`,
      [year]
    );

    const caborBreakdown = caborRes.map(c => ({
      sport: c.sport,
      count: parseInt(c.count, 10),
      totalDuration: parseInt(c.totalDuration, 10),
      revenue: parseFloat(c.revenue)
    }));

    // 4. Query monthly breakdown for the year
    const [monthlyRes] = await db.query(
      `SELECT MONTH(booking_date) as monthNum, COUNT(*) as count, 
              COALESCE(SUM(duration), 0) as totalDuration, COALESCE(SUM(total_price), 0) as revenue
       FROM bookings
       WHERE YEAR(booking_date) = ?
         AND status IN ('CONFIRMED', 'COMPLETED')
       GROUP BY MONTH(booking_date)
       ORDER BY monthNum ASC`,
      [year]
    );

    // Initialize all 12 months with 0s, then merge query results
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => ({
      monthNum: i + 1,
      monthName: monthNames[i],
      count: 0,
      totalDuration: 0,
      revenue: 0
    }));

    monthlyRes.forEach(row => {
      const idx = row.monthNum - 1;
      if (idx >= 0 && idx < 12) {
        monthlyBreakdown[idx].count = parseInt(row.count, 10);
        monthlyBreakdown[idx].totalDuration = parseInt(row.totalDuration, 10);
        monthlyBreakdown[idx].revenue = parseFloat(row.revenue);
      }
    });

    return res.json({
      success: true,
      summary: {
        totalRevenue,
        totalBookings,
        avgRevenue
      },
      caborBreakdown,
      monthlyBreakdown,
      bookings
    });

  } catch (error) {
    console.error('Annual Report Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat laporan tahunan.'
    });
  }
};

module.exports = {
  getCustomerDashboard,
  getAdminDashboard,
  getMonthlyReport,
  getAnnualReport
};
