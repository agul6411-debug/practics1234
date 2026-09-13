const pool = require('../db');

class UserModel {
  static async findByEmail(email) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create({ name, email, password, phone, role, otp }) {
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, phone, role, is_email_verified, email_otp, otp_expires_at) 
       VALUES (?, ?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [name, email, password, phone || null, role, otp]
    );
    return result.insertId;
  }

  static async updateOtpByEmail(email, otp) {
    const [result] = await pool.execute(
      'UPDATE users SET email_otp = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ?',
      [otp, email]
    );
    return result.affectedRows > 0;
  }

  static async updateOtpById(id, otp) {
    const [result] = await pool.execute(
      'UPDATE users SET email_otp = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
      [otp, id]
    );
    return result.affectedRows > 0;
  }

  static async findValidOtpUser(email, otp) {
    const [rows] = await pool.execute(
      `SELECT * FROM users 
       WHERE email = ? AND email_otp = ? AND (otp_expires_at IS NULL OR otp_expires_at > NOW())`,
      [email, otp]
    );
    return rows[0] || null;
  }

  static async markEmailVerified(id) {
    const [result] = await pool.execute(
      'UPDATE users SET is_email_verified = 1, email_otp = NULL, otp_expires_at = NULL WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async resetPassword(id, hashedPassword) {
    const [result] = await pool.execute(
      `UPDATE users 
       SET password = ?, is_email_verified = 1, email_otp = NULL, otp_expires_at = NULL 
       WHERE id = ?`,
      [hashedPassword, id]
    );
    return result.affectedRows > 0;
  }

  static async getAll({ role } = {}) {
    let query = 'SELECT id, name, email, phone, role, status, is_email_verified, created_at FROM users';
    const values = [];

    if (role) {
      query += ' WHERE role = ?';
      values.push(role);
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async updateStatus(id, status) {
    const [result] = await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows > 0;
  }

  static async getAdminUsers() {
    const [rows] = await pool.execute("SELECT id FROM users WHERE role = 'admin'");
    return rows;
  }

  static async getAllUserIds() {
    const [rows] = await pool.execute('SELECT id FROM users');
    return rows;
  }

  static async getUserIdsByRole(role) {
    const [rows] = await pool.execute('SELECT id FROM users WHERE role = ?', [role]);
    return rows;
  }

  static async countByRole(role) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      [role]
    );
    return rows[0].count;
  }
}

module.exports = UserModel;

