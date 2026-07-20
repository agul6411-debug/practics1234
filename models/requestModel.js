const pool = require('../config/db');

/**
 * Checks if a customer has previously contacted a specific vendor.
 * Returns the earliest request record if found.
 */
async function findExistingRequestForCustomerVendor(customer_id, vendor_id) {
  const query = `
    SELECT * FROM requests 
    WHERE customer_id = ? AND vendor_id = ? 
    ORDER BY created_at ASC 
    LIMIT 1
  `;
  const [rows] = await pool.execute(query, [customer_id, vendor_id]);
  return rows[0] || null;
}

/**
 * Counts the number of unique customers who have sent requests to a vendor.
 */
async function countDistinctCustomersForVendor(vendor_id) {
  const query = 'SELECT COUNT(DISTINCT customer_id) as count FROM requests WHERE vendor_id = ?';
  const [rows] = await pool.execute(query, [vendor_id]);
  return rows[0].count;
}

/**
 * Creates a new request record.
 */
async function createRequest({ customer_id, vendor_id, part_id, sequence_number, is_locked }) {
  const query = `
    INSERT INTO requests (customer_id, vendor_id, part_id, sequence_number, is_locked, status)
    VALUES (?, ?, ?, ?, ?, 'requested')
  `;
  const [result] = await pool.execute(query, [
    customer_id,
    vendor_id,
    part_id,
    sequence_number,
    is_locked ? 1 : 0
  ]);
  return result.insertId;
}

/**
 * Returns all requests submitted by a specific customer, joined with part and vendor details.
 */
async function getRequestsByCustomer(customer_id) {
  const query = `
    SELECT 
      r.id, r.sequence_number, r.is_locked, r.status, r.created_at,
      p.id as part_id, p.model_name, p.price, p.image_url,
      v.id as vendor_id, v.user_id as vendor_user_id, v.shop_name, v.city as vendor_city, v.address as vendor_address,
      b.name as brand_name, pt.name as part_type_name
    FROM requests r
    JOIN parts p ON r.part_id = p.id
    JOIN vendors v ON r.vendor_id = v.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN part_types pt ON p.part_type_id = pt.id
    WHERE r.customer_id = ?
    ORDER BY r.created_at DESC
  `;
  const [rows] = await pool.execute(query, [customer_id]);
  return rows;
}

/**
 * Retrieves a request by its ID.
 */
async function getRequestById(id) {
  const query = 'SELECT * FROM requests WHERE id = ?';
  const [rows] = await pool.execute(query, [id]);
  return rows[0] || null;
}

/**
 * Retrieves all requests sent to a specific vendor, joined with part and customer/user details.
 */
async function getVendorRequests(vendor_id) {
  const query = `
    SELECT 
      r.id, r.customer_id, r.vendor_id, r.part_id, r.sequence_number, r.is_locked, r.status, r.created_at,
      p.model_name, p.price, p.condition_type, p.image_url,
      u.id as customer_user_id, u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
      c.city as customer_city
    FROM requests r
    JOIN parts p ON r.part_id = p.id
    JOIN customers c ON r.customer_id = c.id
    JOIN users u ON c.user_id = u.id
    WHERE r.vendor_id = ?
    ORDER BY r.created_at DESC, r.id DESC
  `;
  const [rows] = await pool.execute(query, [vendor_id]);
  return rows;
}

/**
 * Unlocks all requests for a specific customer+vendor pair.
 */
async function unlockRequestsForCustomerVendor(customer_id, vendor_id) {
  const query = 'UPDATE requests SET is_locked = 0 WHERE customer_id = ? AND vendor_id = ?';
  await pool.execute(query, [customer_id, vendor_id]);
}

/**
 * Updates the status of a request ('available' or 'not_available').
 */
async function updateRequestStatus(requestId, status) {
  const query = 'UPDATE requests SET status = ? WHERE id = ?';
  await pool.execute(query, [status, requestId]);
}

module.exports = {
  findExistingRequestForCustomerVendor,
  countDistinctCustomersForVendor,
  createRequest,
  getRequestsByCustomer,
  getRequestById,
  getVendorRequests,
  unlockRequestsForCustomerVendor,
  updateRequestStatus
};
