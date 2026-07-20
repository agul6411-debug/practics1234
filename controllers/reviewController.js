const customerModel = require('../models/customerModel');
const requestModel = require('../models/requestModel');
const reviewModel = require('../models/reviewModel');

/**
 * Allows a customer to submit a review for a responded/available request.
 */
async function addReview(req, res, next) {
  try {
    const userId = req.user.id;
    const customer = await customerModel.findCustomerByUserId(userId);
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

    const request = await requestModel.getRequestById(request_id);
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

    // Confirm request status is 'responded' or 'available'
    if (request.status !== 'responded' && request.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'You can only review after the vendor has responded'
      });
    }

    // Confirm no existing review for this request_id
    const existingReview = await reviewModel.findReviewByRequestId(request_id);
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You already reviewed this request'
      });
    }

    const reviewId = await reviewModel.createReview({
      request_id,
      customer_id: customer.id,
      vendor_id: request.vendor_id,
      rating: numericRating,
      comment
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        id: reviewId,
        request_id,
        customer_id: customer.id,
        vendor_id: request.vendor_id,
        rating: numericRating,
        comment
      }
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

    const reviews = await reviewModel.getReviewsByVendor(vendorId);

    let averageRating = 0;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, curr) => acc + Number(curr.rating), 0);
      averageRating = Number((sum / reviews.length).toFixed(1));
    }

    res.json({
      success: true,
      average_rating: averageRating,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  addReview,
  getVendorReviews
};
