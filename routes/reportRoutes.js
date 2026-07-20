const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { submitReport, getMyReports } = require('../controllers/reportController');

const router = express.Router();

// Require user authentication across all user report routes
router.use(verifyToken);

router.post('/', submitReport);
router.get('/my', getMyReports);

module.exports = router;
