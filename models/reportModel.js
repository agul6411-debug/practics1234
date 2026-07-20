const pool = require('../config/db');

/**
 * Creates a new complaint report.
 */
async function createReport({ reporter_user_id, reported_user_id, request_id, reason, description }) {
  const query = `
    INSERT INTO reports (reporter_user_id, reported_user_id, request_id, reason, description, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `;
  const [result] = await pool.execute(query, [
    reporter_user_id,
    reported_user_id,
    request_id || null,
    reason,
    description
  ]);
  return result.insertId;
}

/**
 * Retrieves all reports submitted by a specific user (reporter).
 */
async function getReportsByReporter(reporter_user_id) {
  const query = `
    SELECT 
      r.id, r.reporter_user_id, r.reported_user_id, r.request_id, r.reason, r.description, r.status, r.created_at,
      u_reported.name as reported_user_name, u_reported.email as reported_user_email, u_reported.role as reported_user_role
    FROM reports r
    JOIN users u_reported ON r.reported_user_id = u_reported.id
    WHERE r.reporter_user_id = ?
    ORDER BY r.created_at DESC, r.id DESC
  `;
  const [rows] = await pool.execute(query, [reporter_user_id]);
  return rows;
}

/**
 * Retrieves all reports across all users for admin review, joined with reporter & reported user details.
 */
async function getAllReports(statusFilter) {
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

  if (statusFilter && statusFilter !== 'all') {
    query += ' WHERE r.status = ?';
    values.push(statusFilter);
  }

  query += ' ORDER BY r.created_at DESC, r.id DESC';
  const [rows] = await pool.execute(query, values);
  return rows;
}

/**
 * Retrieves a single report by its ID.
 */
async function getReportById(id) {
  const query = 'SELECT * FROM reports WHERE id = ?';
  const [rows] = await pool.execute(query, [id]);
  return rows[0] || null;
}

/**
 * Updates the status of a report ('resolved' or 'dismissed').
 */
async function updateReportStatus(id, status) {
  const query = 'UPDATE reports SET status = ? WHERE id = ?';
  await pool.execute(query, [status, id]);
}

module.exports = {
  createReport,
  getReportsByReporter,
  getAllReports,
  getReportById,
  updateReportStatus
};
