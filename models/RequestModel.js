const pool = require('../db');

class RequestModel {
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM requests WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findWithPartAndBarcode(id) {
    const [rows] = await pool.execute(
      `SELECT r.*, p.barcode_number, p.id as p_id 
       FROM requests r 
       JOIN parts p ON r.part_id = p.id 
       WHERE r.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByCustomerAndVendor(customerId, vendorId) {
    const [rows] = await pool.execute(
      `SELECT * FROM requests 
       WHERE customer_id = ? AND vendor_id = ? 
       ORDER BY is_locked ASC, created_at ASC 
       LIMIT 1`,
      [customerId, vendorId]
    );
    return rows[0] || null;
  }

  static async countDistinctCustomersForVendor(vendorId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(DISTINCT customer_id) as count FROM requests WHERE vendor_id = ?',
      [vendorId]
    );
    return rows[0].count;
  }

  static async create({
    customerId,
    vendorId,
    partId,
    sequenceNumber,
    isLocked,
    deliveryType,
    deliveryAddress,
    deliveryCity,
    deliveryPhone,
    deliveryNotes,
    deliveryFee,
    totalAmount
  }) {
    const [result] = await pool.execute(
      `INSERT INTO requests (customer_id, vendor_id, part_id, sequence_number, is_locked, status, delivery_type, delivery_address, delivery_city, delivery_phone, delivery_notes, delivery_fee, total_amount)
       VALUES (?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        vendorId,
        partId,
        sequenceNumber,
        isLocked ? 1 : 0,
        deliveryType,
        deliveryAddress,
        deliveryCity,
        deliveryPhone,
        deliveryNotes,
        deliveryFee,
        totalAmount
      ]
    );
    return this.findById(result.insertId);
  }

  static async getByCustomerId(customerId) {
    const [rows] = await pool.execute(
      `SELECT 
        r.id, r.sequence_number, r.is_locked, r.status, r.created_at,
        r.delivery_type, r.delivery_address, r.delivery_city, r.delivery_phone, r.delivery_notes,
        r.delivery_fee, r.total_amount,
        r.cancellation_reason, r.cancelled_by, r.cancelled_at,
        p.id as part_id, p.model_name, p.price, p.image_url,
        v.id as vendor_id, v.user_id as vendor_user_id, v.shop_name, v.city as vendor_city, v.address as vendor_address,
        b.name as brand_name, pt.name as part_type_name
      FROM requests r
      JOIN parts p ON r.part_id = p.id
      JOIN vendors v ON r.vendor_id = v.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN part_types pt ON p.part_type_id = pt.id
      WHERE r.customer_id = ?
      ORDER BY r.created_at DESC`,
      [customerId]
    );
    return rows;
  }

  static async getByVendorId(vendorId) {
    const [rows] = await pool.execute(
      `SELECT 
        r.id, r.customer_id, r.vendor_id, r.part_id, r.sequence_number, r.is_locked, r.status, r.created_at,
        r.delivery_type, r.delivery_address, r.delivery_city, r.delivery_phone, r.delivery_notes,
        r.delivery_fee, r.total_amount,
        r.cancellation_reason, r.cancelled_by, r.cancelled_at,
        p.model_name, p.price, p.condition_type, p.image_url,
        u.id as customer_user_id, u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
        c.city as customer_city
      FROM requests r
      JOIN parts p ON r.part_id = p.id
      JOIN customers c ON r.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE r.vendor_id = ?
      ORDER BY r.created_at DESC, r.id DESC`,
      [vendorId]
    );
    return rows;
  }

  static async updateStatus(id, status) {
    const [result] = await pool.execute('UPDATE requests SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows > 0;
  }

  static async findByVerifiedBarcode(barcode, excludeRequestId = null) {
    if (!barcode) return null;
    let query = `
      SELECT r.id, r.created_at, r.verified_at, p.model_name
      FROM requests r
      JOIN parts p ON r.part_id = p.id
      WHERE LOWER(TRIM(r.verified_barcode)) = LOWER(TRIM(?))
    `;
    const values = [barcode];

    if (excludeRequestId) {
      query += ' AND r.id != ?';
      values.push(excludeRequestId);
    }

    const [rows] = await pool.execute(query, values);
    return rows[0] || null;
  }

  static async verifyDelivery(requestId, barcode) {
    await pool.execute(
      `UPDATE requests SET verified_barcode = ?, verified_at = NOW(), status = 'available' WHERE id = ?`,
      [barcode, requestId]
    );
  }

  static async cancelByVendor(requestId, cancelReason) {
    await pool.execute(
      `UPDATE requests 
       SET status = 'cancelled', cancellation_reason = ?, cancelled_by = 'vendor', cancelled_at = NOW() 
       WHERE id = ?`,
      [cancelReason, requestId]
    );
  }

  static async unlockLeads(customerId, vendorId) {
    await pool.execute(
      'UPDATE requests SET is_locked = 0 WHERE customer_id = ? AND vendor_id = ?',
      [customerId, vendorId]
    );
  }

  static async countAll() {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM requests');
    return rows[0].count;
  }
}

module.exports = RequestModel;
