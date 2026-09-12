const pool = require('../db');

class ReportModel {
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM reports WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create({ reporterUserId, reportedUserId, requestId, reason, description }) {
    const [result] = await pool.execute(
      `INSERT INTO reports (reporter_user_id, reported_user_id, request_id, reason, description, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        reporterUserId,
        parseInt(reportedUserId, 10),
        requestId ? parseInt(requestId, 10) : null,
        reason.trim(),
        description.trim()
      ]
    );
    return this.findById(result.insertId);
  }

  static async getByReporter(reporterUserId) {
    const [reports] = await pool.execute(
      `SELECT 
        r.id, r.reporter_user_id, r.reported_user_id, r.request_id, r.reason, r.description, r.status, r.created_at,
        u_reported.name as reported_user_name, u_reported.email as reported_user_email, u_reported.role as reported_user_role
      FROM reports r
      JOIN users u_reported ON r.reported_user_id = u_reported.id
      WHERE r.reporter_user_id = ?
      ORDER BY r.created_at DESC, r.id DESC`,
      [reporterUserId]
    );
    return reports;
  }

  static async getAll(status = null) {
    let query = `
      SELECT 
        r.id, r.reporter_user_id, r.reported_user_id, r.request_id, r.reason, r.description, r.status, r.created_at,
        u_reporter.name as reporter_name, u_reporter.email as reporter_email, u_reporter.role as reporter_role,
        u_reported.name as reported_name, u_reported.email as reported_email, u_reported.role as reported_role
      FROM reports r
      JOIN users u_reporter ON r.reporter_user_id = u_reporter.id
      JOIN users u_reported ON r.reported_user_id = u_reported.id
    `;
    const values = [];

    if (status && status !== 'all') {
      query += ' WHERE r.status = ?';
      values.push(status);
    }

    query += ' ORDER BY r.created_at DESC, r.id DESC';
    const [reports] = await pool.execute(query, values);
    return reports;
  }

  static async updateStatus(id, status) {
    const [result] = await pool.execute(
      'UPDATE reports SET status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = ReportModel;
