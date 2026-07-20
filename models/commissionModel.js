const pool = require('../config/db');

/**
 * Creates a new commission record for a locked lead request.
 */
async function createCommission({ request_id, vendor_id, amount }) {
  const query = `
    INSERT INTO commissions (request_id, vendor_id, amount, status)
    VALUES (?, ?, ?, 'pending')
  `;
  const [result] = await pool.execute(query, [request_id, vendor_id, amount]);
  return result.insertId;
}

/**
 * Retrieves a commission record by request ID.
 */
async function getCommissionByRequestId(requestId) {
  const query = 'SELECT * FROM commissions WHERE request_id = ?';
  const [rows] = await pool.execute(query, [requestId]);
  return rows[0] || null;
}

/**
 * Retrieves a commission record by its ID.
 */
async function getCommissionById(id) {
  const query = 'SELECT * FROM commissions WHERE id = ?';
  const [rows] = await pool.execute(query, [id]);
  return rows[0] || null;
}

/**
 * Retrieves commissions for a specific vendor, joined with part & request info.
 */
async function getCommissionsByVendor(vendor_id, statusFilter) {
  let query = `
    SELECT 
      c.id, c.request_id, c.vendor_id, c.amount, c.payment_proof_url, c.status, c.paid_at,
      r.sequence_number, r.part_id,
      p.model_name, p.price as part_price
    FROM commissions c
    JOIN requests r ON c.request_id = r.id
    JOIN parts p ON r.part_id = p.id
    WHERE c.vendor_id = ?
  `;
  const values = [vendor_id];

  if (statusFilter && statusFilter !== 'all') {
    query += ' AND c.status = ?';
    values.push(statusFilter);
  }

  query += ' ORDER BY c.id DESC';
  const [rows] = await pool.execute(query, values);
  return rows;
}

/**
 * Retrieves all commissions across all vendors for admin review, joined with vendor shop details.
 */
async function getAllCommissions(statusFilter) {
  let query = `
    SELECT 
      c.id, c.request_id, c.vendor_id, c.amount, c.payment_proof_url, c.status, c.paid_at, c.verified_by,
      v.shop_name, v.city as vendor_city,
      p.model_name, p.price as part_price
    FROM commissions c
    JOIN vendors v ON c.vendor_id = v.id
    JOIN requests r ON c.request_id = r.id
    JOIN parts p ON r.part_id = p.id
  `;
  const values = [];

  if (statusFilter && statusFilter !== 'all') {
    query += ' WHERE c.status = ?';
    values.push(statusFilter);
  }

  query += ' ORDER BY c.id DESC';
  const [rows] = await pool.execute(query, values);
  return rows;
}

/**
 * Updates the payment proof URL for a commission. Resets status to 'pending' if previously 'rejected'.
 */
async function updateProof(id, proofUrl) {
  const query = `
    UPDATE commissions 
    SET payment_proof_url = ?, 
        status = IF(status = 'rejected', 'pending', status)
    WHERE id = ?
  `;
  await pool.execute(query, [proofUrl, id]);
}

/**
 * Marks a commission as paid and verified by an admin.
 */
async function markPaid(id, adminUserId) {
  const query = `
    UPDATE commissions 
    SET status = 'paid', paid_at = NOW(), verified_by = ? 
    WHERE id = ?
  `;
  await pool.execute(query, [adminUserId, id]);
}

/**
 * Marks a commission payment proof as rejected.
 */
async function markRejected(id) {
  const query = "UPDATE commissions SET status = 'rejected' WHERE id = ?";
  await pool.execute(query, [id]);
}

module.exports = {
  createCommission,
  getCommissionByRequestId,
  getCommissionById,
  getCommissionsByVendor,
  getAllCommissions,
  updateProof,
  markPaid,
  markRejected
};
