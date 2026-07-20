const notificationModel = require('../models/notificationModel');

/**
 * Retrieves all notifications for the authenticated user.
 */
async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const notifications = await notificationModel.getNotificationsByUser(userId);

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
    const count = await notificationModel.getUnreadCount(userId);

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

    const notification = await notificationModel.getNotificationById(notificationId);
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

    await notificationModel.markAsRead(notificationId);

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
    await notificationModel.markAllAsRead(userId);

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
