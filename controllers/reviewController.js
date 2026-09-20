const ReviewModel = require('../models/ReviewModel');
const CustomerModel = require('../models/CustomerModel');
const RequestModel = require('../models/RequestModel');

/**
 * Allows a customer to submit a review for a responded/available request.
 */
async function addReview(req, res, next) {
  try {
    const userId = req.user.id;

    // Find customer profile
    const customer = await CustomerModel.findByUserId(userId);
    if (!customer) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    const { request_id, rating, comment } = req.body;
    if (!request_id || rating === undefined) {
      res.status(400);
      throw new Error('request_id and rating are required');
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      res.status(400);
      throw new Error('Rating must be a number between 1 and 5');
    }

    // Get request by ID
    const request = await RequestModel.findById(request_id);
    if (!request) {
      res.status(404);
      throw new Error('Request not found');
    }

    // Ownership check: confirm request belongs to this customer
    if (request.customer_id !== customer.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only review your own requests.'
      });
    }

    // Confirm request status is 'delivered', 'responded', or 'available'
    const allowedStatuses = ['delivered', 'responded', 'available'];
    if (!allowedStatuses.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'You can only review after receiving the item or after the vendor has responded'
      });
    }

    // Confirm no existing review for this request_id
    const existingReview = await ReviewModel.findByRequestId(request_id);
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You already reviewed this request'
      });
    }

    // Create review
    const createdReview = await ReviewModel.create({
      requestId: request_id,
      customerId: customer.id,
      vendorId: request.vendor_id,
      rating: numericRating,
      comment: comment || null
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: createdReview
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public endpoint to fetch all reviews for a specific vendor along with calculated average rating.
 */
async function getVendorReviews(req, res, next) {
  try {
    const vendorId = req.params.vendorId;
    if (!vendorId) {
      res.status(400);
      throw new Error('vendorId parameter is required');
    }

    const result = await ReviewModel.getByVendorId(vendorId);

    res.json({
      success: true,
      average_rating: result.averageRating,
      count: result.count,
      data: result.reviews
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  addReview,
  getVendorReviews
};
