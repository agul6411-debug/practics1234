const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} = require('../controllers/notificationController');

const router = express.Router();

// Require user authentication across all notification endpoints
router.use(verifyToken);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
