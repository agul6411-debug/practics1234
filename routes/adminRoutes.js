const express = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getAllVendors,
  approveVendor,
  rejectVendor,
  getAllUsers,
  blockUser,
  unblockUser,
  getDashboardStats
} = require('../controllers/adminController');
const {
  getAllCommissionsAdmin,
  verifyCommission,
  rejectCommission
} = require('../controllers/commissionController');
const {
  getAllReportsAdmin,
  resolveReport,
  dismissReport
} = require('../controllers/reportController');

const router = express.Router();

// Require admin authentication across all admin routes
router.use(verifyToken, authorizeRoles('admin'));

// Vendor Management Routes
router.get('/vendors', getAllVendors);
router.put('/vendors/:id/approve', approveVendor);
router.put('/vendors/:id/reject', rejectVendor);

// User Management Routes
router.get('/users', getAllUsers);
router.put('/users/:id/block', blockUser);
router.put('/users/:id/unblock', unblockUser);

// Dashboard Statistics Route
router.get('/dashboard', getDashboardStats);

// Commission Management Routes
router.get('/commissions', getAllCommissionsAdmin);
router.put('/commissions/:id/verify', verifyCommission);
router.put('/commissions/:id/reject', rejectCommission);

// Report Management Routes
router.get('/reports', getAllReportsAdmin);
router.put('/reports/:id/resolve', resolveReport);
router.put('/reports/:id/dismiss', dismissReport);

module.exports = router;
