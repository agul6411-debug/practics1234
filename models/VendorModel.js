const pool = require('../db');

class VendorModel {
  static async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create({
    userId,
    shopName,
    verificationDocs,
    shopPhotoUrl,
    cnicPhotoUrl,
    city,
    address,
    latitude,
    longitude
  }) {
    const [result] = await pool.execute(
      `INSERT INTO vendors (user_id, shop_name, verification_docs, shop_photo_url, cnic_photo_url, city, address, latitude, longitude, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        shopName,
        verificationDocs || shopPhotoUrl || null,
        shopPhotoUrl,
        cnicPhotoUrl,
        city,
        address,
        latitude !== undefined && latitude !== null ? latitude : null,
        longitude !== undefined && longitude !== null ? longitude : null
      ]
    );
    return result.insertId;
  }

  static async updateProfile(userId, fields = {}) {
    const allowedFields = ['shop_name', 'city', 'address', 'latitude', 'longitude'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(fields[field]);
      }
    }

    if (updates.length > 0) {
      values.push(userId);
      await pool.execute(`UPDATE vendors SET ${updates.join(', ')} WHERE user_id = ?`, values);
    }
    return this.findByUserId(userId);
  }

  static async submitDepositProof(userId, proofUrl) {
    const vendorProfile = await this.findByUserId(userId);
    if (!vendorProfile) {
      await pool.execute(
        `INSERT INTO vendors (user_id, shop_name, city, address, verification_status, security_deposit_proof, security_deposit_status)
         VALUES (?, 'Vendor Shop', 'City', 'Address', 'approved', ?, 'pending_verification')`,
        [userId, proofUrl]
      );
    } else {
      await pool.execute(
        `UPDATE vendors 
         SET security_deposit_proof = ?, security_deposit_status = 'pending_verification' 
         WHERE user_id = ?`,
        [proofUrl, userId]
      );
    }
    return this.findByUserId(userId);
  }

  static async updateVerificationStatus(id, status) {
    const [result] = await pool.execute(
      'UPDATE vendors SET verification_status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  static async updateDepositStatus(id, status) {
    const [result] = await pool.execute(
      'UPDATE vendors SET security_deposit_status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  static async incrementCancellationCount(id) {
    await pool.execute(
      'UPDATE vendors SET cancellation_count = cancellation_count + 1 WHERE id = ?',
      [id]
    );
    return this.findById(id);
  }

  static async getAll({ status } = {}) {
    let query = `
      SELECT 
        v.id as vendor_id, v.user_id, v.shop_name, v.verification_docs, v.shop_photo_url, v.cnic_photo_url, v.city, v.address,
        v.latitude, v.longitude, v.verification_status, v.security_deposit_status,
        v.security_deposit_proof, v.security_deposit_amount, v.cancellation_count, v.created_at as vendor_created_at,
        u.name as owner_name, u.email as owner_email, u.phone as owner_phone, u.status as account_status
      FROM vendors v
      JOIN users u ON v.user_id = u.id
    `;
    const values = [];

    if (status) {
      query += ' WHERE v.verification_status = ?';
      values.push(status);
    }

    query += ' ORDER BY v.created_at DESC';
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async countAll() {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM vendors');
    return rows[0].count;
  }

  static async countPending() {
    const [rows] = await pool.execute("SELECT COUNT(*) as count FROM vendors WHERE verification_status = 'pending'");
    return rows[0].count;
  }
}

module.exports = VendorModel;
