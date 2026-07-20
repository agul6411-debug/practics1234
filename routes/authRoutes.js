const express = require('express');
const {
  registerCustomer,
  registerVendor,
  login
} = require('../controllers/authController');

const router = express.Router();

// Route: POST /api/auth/register/customer
router.post('/register/customer', registerCustomer);

// Route: POST /api/auth/register/vendor
router.post('/register/vendor', registerVendor);

// Route: POST /api/auth/login
router.post('/login', login);

module.exports = router;
