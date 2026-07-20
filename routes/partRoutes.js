const express = require('express');
const { verifyPartByToken } = require('../controllers/partController');

const router = express.Router();

// Public Route: QR Code verification for customers scanning parts
router.get('/verify/:token', verifyPartByToken);

module.exports = router;
