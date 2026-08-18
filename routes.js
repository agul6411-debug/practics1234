const express = require('express');
const { verifyToken, authorizeRoles, upload } = require('./middleware');

// Import controllers
const authController = require('./controllers/authController');
const vendorController = require('./controllers/vendorController');
const customerController = require('./controllers/customerController');
const partController = require('./controllers/partController');
const categoryController = require('./controllers/categoryController');
const requestController = require('./controllers/requestController');
const commissionController = require('./controllers/commissionController');
const reviewController = require('./controllers/reviewController');
const reportController = require('./controllers/reportController');
const notificationController = require('./controllers/notificationController');
const adminController = require('./controllers/adminController');
const searchController = require('./controllers/searchController');

const router = express.Router();

// =========================================================================
// 1. Authentication Routes (/api/auth)
// =========================================================================
router.post('/auth/register/customer', authController.registerCustomer);
router.post('/auth/register/vendor', authController.registerVendor);
router.post('/auth/login', authController.login);
router.post('/auth/send-otp', authController.sendOtp);
router.post('/auth/verify-otp', authController.verifyOtp);

// =========================================================================
// 2. Vendor Routes (/api/vendor)
// =========================================================================
// Apply auth and vendor role checks across all vendor endpoints
router.get('/vendor/profile', verifyToken, authorizeRoles('vendor'), vendorController.getMyProfile);
router.put('/vendor/profile', verifyToken, authorizeRoles('vendor'), vendorController.updateMyProfile);

router.post(
  '/vendor/parts',
  verifyToken,
  authorizeRoles('vendor'),
  upload.fields([{ name: 'originalPhoto', maxCount: 1 }, { name: 'barcodePhoto', maxCount: 1 }]),
  partController.addPart
);
router.get('/vendor/parts', verifyToken, authorizeRoles('vendor'), partController.getMyParts);
router.put(
  '/vendor/parts/:id',
  verifyToken,
  authorizeRoles('vendor'),
  upload.fields([{ name: 'originalPhoto', maxCount: 1 }, { name: 'barcodePhoto', maxCount: 1 }]),
  partController.updatePart
);
router.delete('/vendor/parts/:id', verifyToken, authorizeRoles('vendor'), partController.deletePart);

router.get('/vendor/requests', verifyToken, authorizeRoles('vendor'), requestController.getVendorRequests);
router.put('/vendor/requests/:id/respond', verifyToken, authorizeRoles('vendor'), requestController.respondToRequest);
router.put('/vendor/requests/:id/cancel', verifyToken, authorizeRoles('vendor'), requestController.cancelRequestByVendor);

router.get('/vendor/commissions', verifyToken, authorizeRoles('vendor'), commissionController.getMyCommissions);
router.post(
  '/vendor/commissions/:id/proof',
  verifyToken,
  authorizeRoles('vendor'),
  upload.single('receiptImage'),
  commissionController.uploadProof
);

// =========================================================================
// 3. Parts Routes (/api/parts)
// =========================================================================
router.get('/parts/search', searchController.searchParts);
router.get('/parts/:id', partController.getPartDetails);

// =========================================================================
// 4. Category/Brand Routes (/api/categories)
// =========================================================================
// Public dropdown routes
router.get('/categories/brands', categoryController.getBrands);
router.get('/categories/part-types', categoryController.getPartTypes);

// Admin-only management routes
router.post('/categories/brands', verifyToken, authorizeRoles('admin'), categoryController.addBrand);
router.put('/categories/brands/:id', verifyToken, authorizeRoles('admin'), categoryController.updateBrand);
router.delete('/categories/brands/:id', verifyToken, authorizeRoles('admin'), categoryController.deleteBrand);

router.post('/categories/part-types', verifyToken, authorizeRoles('admin'), categoryController.addPartType);
router.put('/categories/part-types/:id', verifyToken, authorizeRoles('admin'), categoryController.updatePartType);
router.delete('/categories/part-types/:id', verifyToken, authorizeRoles('admin'), categoryController.deletePartType);

// =========================================================================
// 5. Customer Routes (/api/customer)
// =========================================================================
// Public review details check
router.get('/customer/vendors/:vendorId/reviews', reviewController.getVendorReviews);

// Protected customer-only routes
router.get('/customer/profile', verifyToken, authorizeRoles('customer'), customerController.getMyProfile);
router.put('/customer/profile', verifyToken, authorizeRoles('customer'), customerController.updateMyProfile);
router.post('/customer/requests', verifyToken, authorizeRoles('customer'), requestController.createRequest);
router.get('/customer/requests', verifyToken, authorizeRoles('customer'), requestController.getMyRequests);
router.post('/customer/verify-delivery', verifyToken, authorizeRoles('customer'), requestController.verifyDelivery);
router.post('/customer/reviews', verifyToken, authorizeRoles('customer'), reviewController.addReview);

// =========================================================================
// 6. Admin Routes (/api/admin)
// =========================================================================
// Require admin checks across all endpoints here
router.get('/admin/vendors', verifyToken, authorizeRoles('admin'), adminController.getAllVendors);
router.put('/admin/vendors/:id/approve', verifyToken, authorizeRoles('admin'), adminController.approveVendor);
router.put('/admin/vendors/:id/reject', verifyToken, authorizeRoles('admin'), adminController.rejectVendor);
router.put('/admin/vendors/:id/verify-deposit', verifyToken, authorizeRoles('admin'), adminController.verifyVendorDeposit);
router.put('/admin/vendors/:id/reject-deposit', verifyToken, authorizeRoles('admin'), adminController.rejectVendorDeposit);

router.get('/admin/users', verifyToken, authorizeRoles('admin'), adminController.getAllUsers);
router.put('/admin/users/:id/block', verifyToken, authorizeRoles('admin'), adminController.blockUser);
router.put('/admin/users/:id/unblock', verifyToken, authorizeRoles('admin'), adminController.unblockUser);

router.get('/admin/dashboard', verifyToken, authorizeRoles('admin'), adminController.getDashboardStats);

router.get('/admin/commissions', verifyToken, authorizeRoles('admin'), commissionController.getAllCommissionsAdmin);
router.put('/admin/commissions/:id/verify', verifyToken, authorizeRoles('admin'), commissionController.verifyCommission);
router.put('/admin/commissions/:id/reject', verifyToken, authorizeRoles('admin'), commissionController.rejectCommission);

router.get('/admin/reports', verifyToken, authorizeRoles('admin'), reportController.getAllReportsAdmin);
router.put('/admin/reports/:id/resolve', verifyToken, authorizeRoles('admin'), reportController.resolveReport);
router.put('/admin/reports/:id/dismiss', verifyToken, authorizeRoles('admin'), reportController.dismissReport);

router.get('/settings/public', adminController.getPublicSettings);
router.get('/admin/settings', verifyToken, authorizeRoles('admin'), adminController.getPublicSettings);
router.put('/admin/settings', verifyToken, authorizeRoles('admin'), adminController.updateSystemSettings);
router.post(
  '/vendor/security-deposit',
  verifyToken,
  authorizeRoles('vendor'),
  upload.single('receiptImage'),
  vendorController.submitSecurityDepositProof
);

// =========================================================================
// 7. Notification Routes (/api/notifications)
// =========================================================================
router.get('/notifications', verifyToken, notificationController.getMyNotifications);
router.get('/notifications/unread-count', verifyToken, notificationController.getUnreadCount);
router.put('/notifications/read-all', verifyToken, notificationController.markAllAsRead);
router.put('/notifications/:id/read', verifyToken, notificationController.markAsRead);

// =========================================================================
// 8. Report Routes (/api/reports)
// =========================================================================
router.post('/reports', verifyToken, reportController.submitReport);
router.get('/reports/my', verifyToken, reportController.getMyReports);

// =========================================================================
// 9. Chat Routes (/api/chat)
// =========================================================================
const chatController = require('./controllers/chatController');
router.post('/chat/rooms', verifyToken, chatController.createOrGetRoom);
router.get('/chat/rooms', verifyToken, chatController.getMyRooms);
router.get('/chat/rooms/:roomId/messages', verifyToken, chatController.getRoomMessages);
router.post('/chat/rooms/:roomId/messages', verifyToken, chatController.sendMessage);

module.exports = router;
