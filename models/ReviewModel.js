const pool = require('../db');

class ReviewModel {
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM reviews WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByRequestId(requestId) {
    const [rows] = await pool.execute('SELECT * FROM reviews WHERE request_id = ?', [requestId]);
    return rows[0] || null;
  }

  static async create({ requestId, customerId, vendorId, rating, comment = null }) {
    const [result] = await pool.execute(
      'INSERT INTO reviews (request_id, customer_id, vendor_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [requestId, customerId, vendorId, rating, comment]
    );
    return {
      id: result.insertId,
      request_id: requestId,
      customer_id: customerId,
      vendor_id: vendorId,
      rating,
      comment
    };
  }

  static async getByVendorId(vendorId) {
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

    return {
      reviews,
      averageRating,
      count: reviews.length
    };
  }
}

module.exports = ReviewModel;
