const pool = require('../db');

class NotificationModel {
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create({ userId, message, type = 'system', isRead = 0 }) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO notifications (user_id, message, type, is_read)
         VALUES (?, ?, ?, ?)`,
        [userId, message, type, isRead]
      );
      return result.insertId;
    } catch (err) {
      console.error('NotificationModel.create error:', err.message);
      return null;
    }
  }

  static async getByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    return rows.map((row) => ({
      ...row,
      is_read: Boolean(row.is_read)
    }));
  }

  static async getUnreadCount(userId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return rows[0].count;
  }

  static async markAsRead(id) {
    const [result] = await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async markAllAsRead(userId) {
    const [result] = await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    return result.affectedRows > 0;
  }

  static async markReadByType(userId, type) {
    try {
      await pool.execute(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type = ?',
        [userId, type]
      );
    } catch (_) {}
  }

  static async markReadByMessagePattern(userId, pattern) {
    try {
      await pool.execute(
        `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND message LIKE ?`,
        [userId, pattern]
      );
    } catch (_) {}
  }

  static async getAllAdmin() {
    const [rows] = await pool.execute(`
      SELECT 
        n.id, n.user_id, n.message, n.type, n.is_read, n.created_at,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC, n.id DESC
    `);
    return rows;
  }

  static async broadcastToUser(userId, message, type = 'system') {
    await this.create({ userId, message, type, isRead: 0 });
  }

  static async broadcastToRole(role, message, type = 'system') {
    const [users] = await pool.execute('SELECT id FROM users WHERE role = ?', [role]);
    for (const u of users) {
      await this.create({ userId: u.id, message, type, isRead: 0 });
    }
  }

  static async broadcastToAll(message, type = 'system') {
    const [users] = await pool.execute('SELECT id FROM users');
    for (const u of users) {
      await this.create({ userId: u.id, message, type, isRead: 0 });
    }
  }
}

module.exports = NotificationModel;
