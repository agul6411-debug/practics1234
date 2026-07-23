const express = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { getMyProfile, updateMyProfile } = require('../controllers/customerController');
const { createRequest, getMyRequests } = require('../controllers/requestController');
const { addReview, getVendorReviews } = require('../controllers/reviewController');

const router = express.Router();

// Public Route: View vendor reviews & ratings before contacting
router.get('/vendors/:vendorId/reviews', getVendorReviews);

// Protected Routes (Customer role required)
router.use(verifyToken, authorizeRoles('customer'));

// Customer Profile Routes
router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);

// Request Management Routes
router.post('/requests', createRequest);
router.get('/requests', getMyRequests);

// Review Submission Route
router.post('/reviews', addReview);

module.exports = router;
