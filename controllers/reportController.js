const ReportModel = require('../models/ReportModel');
const NotificationModel = require('../models/NotificationModel');

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

    const newReport = await ReportModel.create({
      reporterUserId,
      reportedUserId: parseInt(reported_user_id, 10),
      requestId: request_id ? parseInt(request_id, 10) : null,
      reason: reason.trim(),
      description: description.trim()
    });

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
    const reports = await ReportModel.getByReporter(reporterUserId);

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
    const reports = await ReportModel.getAll(status);

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

    const report = await ReportModel.findById(reportId);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    await ReportModel.updateStatus(reportId, 'resolved');

    // Trigger notification to original reporter (wrapped in try/catch)
    try {
      await NotificationModel.create({
        userId: report.reporter_user_id,
        message: 'Your report has been reviewed and resolved.',
        type: 'system',
        isRead: 0
      });
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

    const report = await ReportModel.findById(reportId);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    await ReportModel.updateStatus(reportId, 'dismissed');

    // Trigger notification to original reporter (wrapped in try/catch)
    try {
      await NotificationModel.create({
        userId: report.reporter_user_id,
        message: 'Your report has been reviewed and dismissed.',
        type: 'system',
        isRead: 0
      });
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
