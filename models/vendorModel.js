const pool = require('../config/db');

/**
 * Creates a new vendor profile in the vendors table.
 * @param {object} vendorData
 * @param {number} vendorData.user_id
 * @param {string} vendorData.shop_name
 * @param {string} [vendorData.verification_docs]
 * @param {string} vendorData.city
 * @param {string} vendorData.address
 * @param {number|null} [vendorData.latitude]
 * @param {number|null} [vendorData.longitude]
 * @returns {Promise<number>} The inserted vendor record's ID
 */
async function createVendorProfile({
  user_id,
  shop_name,
  verification_docs,
  city,
  address,
  latitude,
  longitude
}) {
  const query = `
    INSERT INTO vendors (user_id, shop_name, verification_docs, city, address, latitude, longitude, verification_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `;
  const [result] = await pool.execute(query, [
    user_id,
    shop_name,
    verification_docs || null,
    city,
    address,
    latitude !== undefined && latitude !== null ? latitude : null,
    longitude !== undefined && longitude !== null ? longitude : null
  ]);
  return result.insertId;
}

/**
 * Finds a vendor profile by user ID.
 * @param {number} user_id
 * @returns {Promise<object|null>} The vendor record, or null if not found
 */
async function findVendorByUserId(user_id) {
  const query = 'SELECT * FROM vendors WHERE user_id = ?';
  const [rows] = await pool.execute(query, [user_id]);
  return rows[0] || null;
}

/**
 * Updates vendor profile fields by user ID.
 * @param {number} user_id
 * @param {object} fields
 * @returns {Promise<boolean>} True if updated
 */
async function updateVendorProfileByUserId(user_id, fields) {
  const allowedFields = ['shop_name', 'city', 'address', 'latitude', 'longitude', 'verification_docs'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(fields[field]);
    }
  }

  if (updates.length === 0) return false;

  values.push(user_id);
  const query = `UPDATE vendors SET ${updates.join(', ')} WHERE user_id = ?`;
  await pool.execute(query, values);
  return true;
}

/**
 * Retrieves all vendors joined with linked user account info, optionally filtered by verification_status.
 */
async function getAllVendors(statusFilter) {
  let query = `
    SELECT 
      v.id as vendor_id, v.user_id, v.shop_name, v.verification_docs, v.city, v.address,
      v.latitude, v.longitude, v.verification_status, v.created_at as vendor_created_at,
      u.name as owner_name, u.email as owner_email, u.phone as owner_phone, u.status as account_status
    FROM vendors v
    JOIN users u ON v.user_id = u.id
  `;
  const values = [];

  if (statusFilter) {
    query += ' WHERE v.verification_status = ?';
    values.push(statusFilter);
  }

  query += ' ORDER BY v.created_at DESC';
  const [rows] = await pool.execute(query, values);
  return rows;
}

/**
 * Updates a vendor's verification status ('approved' or 'rejected').
 */
async function updateVerificationStatus(vendorId, status) {
  const query = 'UPDATE vendors SET verification_status = ? WHERE id = ?';
  await pool.execute(query, [status, vendorId]);
}

/**
 * Retrieves a vendor record by vendor ID.
 */
async function getVendorById(vendorId) {
  const query = 'SELECT * FROM vendors WHERE id = ?';
  const [rows] = await pool.execute(query, [vendorId]);
  return rows[0] || null;
}

module.exports = {
  createVendorProfile,
  findVendorByUserId,
  updateVendorProfileByUserId,
  getAllVendors,
  updateVerificationStatus,
  getVendorById
};
