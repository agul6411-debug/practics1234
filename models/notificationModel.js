const pool = require('../config/db');

/**
 * Creates a new notification for a specific user.
 */
async function createNotification({ user_id, message, type }) {
  const query = `
    INSERT INTO notifications (user_id, message, type, is_read)
    VALUES (?, ?, ?, 0)
  `;
  const [result] = await pool.execute(query, [user_id, message, type]);
  return result.insertId;
}

/**
 * Retrieves all notifications for a specific user, ordered most recent first.
 */
async function getNotificationsByUser(user_id) {
  const query = `
    SELECT id, user_id, message, type, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
  `;
  const [rows] = await pool.execute(query, [user_id]);
  return rows.map((row) => ({
    ...row,
    is_read: Boolean(row.is_read)
  }));
}

/**
 * Gets the count of unread notifications for a user.
 */
async function getUnreadCount(user_id) {
  const query = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0';
  const [rows] = await pool.execute(query, [user_id]);
  return rows[0].count;
}

/**
 * Retrieves a single notification by its ID.
 */
async function getNotificationById(id) {
  const query = 'SELECT * FROM notifications WHERE id = ?';
  const [rows] = await pool.execute(query, [id]);
  return rows[0] || null;
}

/**
 * Marks a single notification as read.
 */
async function markAsRead(id) {
  const query = 'UPDATE notifications SET is_read = 1 WHERE id = ?';
  await pool.execute(query, [id]);
}

/**
 * Marks all notifications for a user as read.
 */
async function markAllAsRead(user_id) {
  const query = 'UPDATE notifications SET is_read = 1 WHERE user_id = ?';
  await pool.execute(query, [user_id]);
}

module.exports = {
  createNotification,
  getNotificationsByUser,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead
};
