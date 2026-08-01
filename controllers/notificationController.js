const pool = require('../db');

/**
 * Retrieves all notifications for the authenticated user.
 */
async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.id;

    // Get notifications
    const [rows] = await pool.execute(
      `SELECT id, user_id, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    const notifications = rows.map((row) => ({
      ...row,
      is_read: Boolean(row.is_read)
    }));

    res.json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns the unread notification count for the authenticated user.
 */
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.id;

    // Get unread count
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    const count = rows[0].count;

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Marks a single notification as read.
 */
async function markAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    // Find notification by ID
    const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    const notification = rows[0] || null;
    if (!notification) {
      res.status(404);
      throw new Error('Notification not found');
    }

    // Ownership check
    if (notification.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not own this notification.'
      });
    }

    // Mark as read
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Marks all notifications for the authenticated user as read.
 */
async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;

    // Mark all as read
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
