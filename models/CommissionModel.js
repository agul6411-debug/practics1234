const pool = require('../db');

class CommissionModel {
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM commissions WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create({ requestId, vendorId, amount, status = 'pending' }) {
    const [result] = await pool.execute(
      `INSERT INTO commissions (request_id, vendor_id, amount, status)
       VALUES (?, ?, ?, ?)`,
      [requestId, vendorId, amount, status]
    );
    return this.findById(result.insertId);
  }

  static async getByVendor(vendorId, status = null) {
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
    const values = [vendorId];

    if (status && status !== 'all') {
      query += ' AND c.status = ?';
      values.push(status);
    }

    query += ' ORDER BY c.id DESC';
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async getAll(status = null) {
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

    if (status && status !== 'all') {
      query += ' WHERE c.status = ?';
      values.push(status);
    }

    query += ' ORDER BY c.id DESC';
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async uploadProof(commissionId, proofUrl) {
    await pool.execute(
      `UPDATE commissions 
       SET payment_proof_url = ?, 
           status = 'pending'
       WHERE id = ?`,
      [proofUrl, commissionId]
    );
    return this.findById(commissionId);
  }

  static async verify(commissionId, adminUserId) {
    await pool.execute(
      `UPDATE commissions 
       SET status = 'paid', paid_at = NOW(), verified_by = ? 
       WHERE id = ?`,
      [adminUserId, commissionId]
    );
    return this.findById(commissionId);
  }

  static async reject(commissionId) {
    await pool.execute("UPDATE commissions SET status = 'rejected' WHERE id = ?", [commissionId]);
    return this.findById(commissionId);
  }
}

module.exports = CommissionModel;
