const pool = require('../config/db');

/**
 * Creates a new customer review for a vendor.
 */
async function createReview({ request_id, customer_id, vendor_id, rating, comment }) {
  const query = `
    INSERT INTO reviews (request_id, customer_id, vendor_id, rating, comment)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(query, [
    request_id,
    customer_id,
    vendor_id,
    rating,
    comment || null
  ]);
  return result.insertId;
}

/**
 * Finds an existing review by request ID.
 */
async function findReviewByRequestId(request_id) {
  const query = 'SELECT * FROM reviews WHERE request_id = ?';
  const [rows] = await pool.execute(query, [request_id]);
  return rows[0] || null;
}

/**
 * Returns all reviews submitted for a specific vendor along with reviewer customer names.
 */
async function getReviewsByVendor(vendor_id) {
  const query = `
    SELECT 
      rv.id, rv.request_id, rv.rating, rv.comment, rv.created_at,
      u.name as customer_name
    FROM reviews rv
    JOIN customers c ON rv.customer_id = c.id
    JOIN users u ON c.user_id = u.id
    WHERE rv.vendor_id = ?
    ORDER BY rv.created_at DESC
  `;
  const [rows] = await pool.execute(query, [vendor_id]);
  return rows;
}

module.exports = {
  createReview,
  findReviewByRequestId,
  getReviewsByVendor
};
