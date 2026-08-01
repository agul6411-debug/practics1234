const pool = require('../db');

/**
 * Allows a customer to submit a review for a responded/available request.
 */
async function addReview(req, res, next) {
  try {
    const userId = req.user.id;

    // Find customer profile
    const [custRows] = await pool.execute('SELECT * FROM customers WHERE user_id = ?', [userId]);
    const customer = custRows[0] || null;
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
    const [requestRows] = await pool.execute('SELECT * FROM requests WHERE id = ?', [request_id]);
    const request = requestRows[0] || null;
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
    const [existingReviewRows] = await pool.execute('SELECT * FROM reviews WHERE request_id = ?', [request_id]);
    if (existingReviewRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already reviewed this request'
      });
    }

    // Create review
    const [result] = await pool.execute(
      'INSERT INTO reviews (request_id, customer_id, vendor_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [
        request_id,
        customer.id,
        request.vendor_id,
        numericRating,
        comment || null
      ]
    );
    const reviewId = result.insertId;

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

    // Get reviews by vendor
    const [reviews] = await pool.execute(
      `SELECT 
        rv.id, rv.request_id, rv.rating, rv.comment, rv.created_at,
        u.name as customer_name
      FROM reviews rv
      JOIN customers c ON rv.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE rv.vendor_id = ?
      ORDER BY rv.created_at DESC`,
      [vendorId]
    );

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
