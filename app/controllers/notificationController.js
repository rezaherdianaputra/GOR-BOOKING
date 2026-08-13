const db = require('../config/db');

// Get all notifications for user
const getNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const [notifications] = await db.query(
      `SELECT id, booking_id, message, is_read, created_at 
       FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat notifikasi.'
    });
  }
};

// Mark notifications as read
const markAsRead = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.body; // If id is provided, mark specific notification. Otherwise mark all as read.

  try {
    if (id) {
      await db.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [id, userId]
      );
    } else {
      await db.query(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
        [userId]
      );
    }

    return res.json({
      success: true,
      message: 'Notifikasi ditandai sebagai telah dibaca.'
    });
  } catch (error) {
    console.error('Mark Notifications Read Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat menandai notifikasi.'
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead
};
