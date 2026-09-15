const pool = require('../db');

class UserModel {
  static async findByEmail(email) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create({ name, email, password, phone, role, otp }) {
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, phone, role, is_email_verified, email_otp, otp_expires_at) 
       VALUES (?, ?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [name, email, password, phone || null, role, otp]
    );
    return result.insertId;
  }

  static async updateOtpByEmail(email, otp) {
    const [result] = await pool.execute(
      'UPDATE users SET email_otp = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ?',
      [otp, email]
    );
    return result.affectedRows > 0;
  }

  static async updateOtpById(id, otp) {
    const [result] = await pool.execute(
      'UPDATE users SET email_otp = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
      [otp, id]
    );
    return result.affectedRows > 0;
  }

  static async findValidOtpUser(email, otp) {
    const [rows] = await pool.execute(
      `SELECT * FROM users 
       WHERE email = ? AND email_otp = ? AND (otp_expires_at IS NULL OR otp_expires_at > NOW())`,
      [email, otp]
    );
    return rows[0] || null;
  }

  static async markEmailVerified(id) {
    const [result] = await pool.execute(
      'UPDATE users SET is_email_verified = 1, email_otp = NULL, otp_expires_at = NULL WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async resetPassword(id, hashedPassword) {
    const [result] = await pool.execute(
      `UPDATE users 
       SET password = ?, is_email_verified = 1, email_otp = NULL, otp_expires_at = NULL 
       WHERE id = ?`,
      [hashedPassword, id]
    );
    return result.affectedRows > 0;
  }

  static async getAll({ role } = {}) {
    let query = 'SELECT id, name, email, phone, role, status, is_email_verified, created_at FROM users';
    const values = [];

    if (role) {
      query += ' WHERE role = ?';
      values.push(role);
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async updateStatus(id, status) {
    const [result] = await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows > 0;
  }

  static async getAdminUsers() {
    const [rows] = await pool.execute("SELECT id FROM users WHERE role = 'admin'");
    return rows;
  }

  static async getAllUserIds() {
    const [rows] = await pool.execute('SELECT id FROM users');
    return rows;
  }

  static async getUserIdsByRole(role) {
    const [rows] = await pool.execute('SELECT id FROM users WHERE role = ?', [role]);
    return rows;
  }

  static async requestDeletion(userId, reason) {
    try {
      await pool.execute(
        `UPDATE users SET status = 'deletion_pending' WHERE id = ?`,
        [userId]
      );
    } catch (_) {}
    return true;
  }

  static async deleteUserCascade(userId) {
    const user = await this.findById(userId);
    if (!user) return false;

    if (user.role === 'vendor') {
      const [vendors] = await pool.execute('SELECT id FROM vendors WHERE user_id = ?', [userId]);
      if (vendors.length > 0) {
        const vendorId = vendors[0].id;
        try { await pool.execute('DELETE FROM commissions WHERE vendor_id = ?', [vendorId]); } catch (_) {}
        try { await pool.execute('DELETE FROM reviews WHERE vendor_id = ?', [vendorId]); } catch (_) {}
        try { await pool.execute('DELETE FROM requests WHERE vendor_id = ?', [vendorId]); } catch (_) {}
        try { await pool.execute('DELETE FROM chat_rooms WHERE vendor_id = ?', [vendorId]); } catch (_) {}
        try { await pool.execute('DELETE FROM parts WHERE vendor_id = ?', [vendorId]); } catch (_) {}
        try { await pool.execute('DELETE FROM vendors WHERE id = ?', [vendorId]); } catch (_) {}
      }
    } else if (user.role === 'customer') {
      const [customers] = await pool.execute('SELECT id FROM customers WHERE user_id = ?', [userId]);
      if (customers.length > 0) {
        const customerId = customers[0].id;
        try { await pool.execute('DELETE FROM reviews WHERE customer_id = ?', [customerId]); } catch (_) {}
        try { await pool.execute('DELETE FROM requests WHERE customer_id = ?', [customerId]); } catch (_) {}
        try { await pool.execute('DELETE FROM chat_rooms WHERE customer_id = ?', [customerId]); } catch (_) {}
        try { await pool.execute('DELETE FROM customers WHERE id = ?', [customerId]); } catch (_) {}
      }
    }

    try { await pool.execute('DELETE FROM chat_messages WHERE sender_id = ?', [userId]); } catch (_) {}
    try { await pool.execute('DELETE FROM notifications WHERE user_id = ?', [userId]); } catch (_) {}
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    return result.affectedRows > 0;
  }

  static async getVendor360(userId) {
    const [vendorRows] = await pool.execute(`
      SELECT 
        v.*,
        u.name as owner_name,
        u.email as owner_email,
        u.phone as owner_phone,
        u.status as user_status,
        u.is_email_verified,
        u.created_at as registered_at
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE v.user_id = ? OR v.id = ?
    `, [userId, userId]);

    if (vendorRows.length === 0) return null;
    const vendor = vendorRows[0];
    const vendorId = vendor.id;

    // 1. Total Parts in Inventory
    const [partsCount] = await pool.execute('SELECT COUNT(*) as count FROM parts WHERE vendor_id = ?', [vendorId]);
    const totalParts = partsCount[0].count;

    // 2. Parts Sold (Delivered)
    const [soldCount] = await pool.execute(
      "SELECT COUNT(*) as count FROM requests WHERE vendor_id = ? AND (status = 'delivered' OR verified_at IS NOT NULL)",
      [vendorId]
    );
    const totalSold = soldCount[0].count;

    // 3. Gross Earnings (Delivered parts total revenue)
    const [earnings] = await pool.execute(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM requests WHERE vendor_id = ? AND (status = 'delivered' OR verified_at IS NOT NULL)",
      [vendorId]
    );
    const totalEarnings = parseFloat(earnings[0].total) || 0.0;

    // 4. Commission Breakdown
    const [commPayable] = await pool.execute('SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE vendor_id = ?', [vendorId]);
    const totalCommissionPayable = parseFloat(commPayable[0].total) || 0.0;

    const [commPaid] = await pool.execute("SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE vendor_id = ? AND status = 'paid'", [vendorId]);
    const totalCommissionPaid = parseFloat(commPaid[0].total) || 0.0;
    const commissionPending = Math.max(0, totalCommissionPayable - totalCommissionPaid);

    // 5. Parts List
    const [partsList] = await pool.execute(`
      SELECT p.*, b.name as brand_name, pt.name as part_type_name
      FROM parts p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN part_types pt ON p.part_type_id = pt.id
      WHERE p.vendor_id = ?
      ORDER BY p.created_at DESC
    `, [vendorId]);

    // 6. Requests / Leads List
    const [requestsList] = await pool.execute(`
      SELECT r.*, p.model_name, p.price as part_price, u.name as customer_name, u.phone as customer_phone
      FROM requests r
      JOIN parts p ON r.part_id = p.id
      JOIN customers c ON r.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE r.vendor_id = ?
      ORDER BY r.created_at DESC
    `, [vendorId]);

    return {
      vendor,
      stats: {
        totalParts,
        totalSold,
        totalEarnings,
        cancellationsCount: vendor.cancellation_count || 0,
        totalCommissionPayable,
        totalCommissionPaid,
        commissionPending,
        securityDepositStatus: vendor.security_deposit_status || 'unpaid',
        securityDepositAmount: vendor.security_deposit_amount || 500.0,
      },
      parts: partsList,
      requests: requestsList,
    };
  }

  static async getCustomer360(userId) {
    const [custRows] = await pool.execute(`
      SELECT 
        c.*,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.is_email_verified,
        u.created_at as registered_at
      FROM customers c
      JOIN users u ON c.user_id = u.id
      WHERE c.user_id = ? OR c.id = ?
    `, [userId, userId]);

    if (custRows.length === 0) return null;
    const customer = custRows[0];
    const customerId = customer.id;

    // 1. Total Requests Placed
    const [reqCount] = await pool.execute('SELECT COUNT(*) as count FROM requests WHERE customer_id = ?', [customerId]);
    const totalRequests = reqCount[0].count;

    // 2. Completed / Delivered Purchases
    const [completedCount] = await pool.execute(
      "SELECT COUNT(*) as count FROM requests WHERE customer_id = ? AND (status = 'delivered' OR verified_at IS NOT NULL)",
      [customerId]
    );
    const totalCompleted = completedCount[0].count;

    // 3. Total Money Spent (Rs.)
    const [spentTotal] = await pool.execute(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM requests WHERE customer_id = ? AND (status = 'delivered' OR verified_at IS NOT NULL)",
      [customerId]
    );
    const totalSpent = parseFloat(spentTotal[0].total) || 0.0;

    // 4. Reviews Submitted Count
    const [revCount] = await pool.execute('SELECT COUNT(*) as count FROM reviews WHERE customer_id = ?', [customerId]);
    const totalReviews = revCount[0].count;

    // 5. Purchase / Request History
    const [ordersList] = await pool.execute(`
      SELECT 
        r.*,
        p.model_name,
        p.price as part_price,
        p.image_url,
        p.original_photo_url,
        b.name as brand_name,
        pt.name as part_type_name,
        v.shop_name,
        v.city as vendor_city
      FROM requests r
      JOIN parts p ON r.part_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN part_types pt ON p.part_type_id = pt.id
      JOIN vendors v ON r.vendor_id = v.id
      WHERE r.customer_id = ?
      ORDER BY r.created_at DESC
    `, [customerId]);

    return {
      customer,
      stats: {
        totalRequests,
        totalCompleted,
        totalSpent,
        totalReviews,
      },
      orders: ordersList,
    };
  }
}

module.exports = UserModel;


