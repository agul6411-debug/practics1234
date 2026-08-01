const pool = require('../db');

/**
 * Submits a new complaint report against another user.
 */
async function submitReport(req, res, next) {
  try {
    const reporterUserId = req.user.id;
    const { reported_user_id, request_id, reason, description } = req.body;

    if (!reported_user_id) {
      res.status(400);
      throw new Error('reported_user_id is required');
    }

    if (parseInt(reported_user_id, 10) === reporterUserId) {
      res.status(400);
      throw new Error('You cannot report yourself');
    }

    if (!reason || reason.trim().length === 0) {
      res.status(400);
      throw new Error('reason is required');
    }

    if (!description || description.trim().length === 0) {
      res.status(400);
      throw new Error('description is required');
    }

    // Create report
    const [result] = await pool.execute(
      `INSERT INTO reports (reporter_user_id, reported_user_id, request_id, reason, description, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        reporterUserId,
        parseInt(reported_user_id, 10),
        request_id ? parseInt(request_id, 10) : null,
        reason.trim(),
        description.trim()
      ]
    );
    const reportId = result.insertId;

    // Get created report
    const [reportRows] = await pool.execute('SELECT * FROM reports WHERE id = ?', [reportId]);
    const newReport = reportRows[0] || null;

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: newReport
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves reports submitted by the authenticated user.
 */
async function getMyReports(req, res, next) {
  try {
    const reporterUserId = req.user.id;

    // Get reports by reporter
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

    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to retrieve all submitted reports.
 */
async function getAllReportsAdmin(req, res, next) {
  try {
    const { status } = req.query;

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

    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to mark a report as resolved and notify reporter.
 */
async function resolveReport(req, res, next) {
  try {
    const reportId = req.params.id;

    // Get report by ID
    const [reportRows] = await pool.execute('SELECT * FROM reports WHERE id = ?', [reportId]);
    const report = reportRows[0] || null;
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    // Resolve report
    await pool.execute('UPDATE reports SET status = ? WHERE id = ?', ['resolved', reportId]);

    // Trigger notification to original reporter (wrapped in try/catch)
    try {
      await pool.execute(
        `INSERT INTO notifications (user_id, message, type, is_read)
         VALUES (?, 'Your report has been reviewed and resolved.', 'system', 0)`,
        [report.reporter_user_id]
      );
    } catch (notifErr) {
      console.error('Notification creation failed in resolveReport:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Report marked as resolved'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to mark a report as dismissed and notify reporter.
 */
async function dismissReport(req, res, next) {
  try {
    const reportId = req.params.id;

    // Get report by ID
    const [reportRows] = await pool.execute('SELECT * FROM reports WHERE id = ?', [reportId]);
    const report = reportRows[0] || null;
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    // Dismiss report
    await pool.execute('UPDATE reports SET status = ? WHERE id = ?', ['dismissed', reportId]);

    // Trigger notification to original reporter (wrapped in try/catch)
    try {
      await pool.execute(
        `INSERT INTO notifications (user_id, message, type, is_read)
         VALUES (?, 'Your report has been reviewed and dismissed.', 'system', 0)`,
        [report.reporter_user_id]
      );
    } catch (notifErr) {
      console.error('Notification creation failed in dismissReport:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Report marked as dismissed'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitReport,
  getMyReports,
  getAllReportsAdmin,
  resolveReport,
  dismissReport
};
