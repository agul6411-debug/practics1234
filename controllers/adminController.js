const pool = require('../db');

/**
 * Retrieves all vendors, optionally filtered by status ('pending', 'approved', 'rejected').
 */
async function getAllVendors(req, res, next) {
  try {
    const { status } = req.query;

    let query = `
      SELECT 
        v.id as vendor_id, v.user_id, v.shop_name, v.verification_docs, v.city, v.address,
        v.latitude, v.longitude, v.verification_status, v.security_deposit_status,
        v.security_deposit_proof, v.security_deposit_amount, v.created_at as vendor_created_at,
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

    const [vendors] = await pool.execute(query, values);

    res.json({
      success: true,
      count: vendors.length,
      data: vendors
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Sets vendor verification status to 'approved'.
 */
async function approveVendor(req, res, next) {
  try {
    const vendorId = req.params.id;

    // Update status
    await pool.execute('UPDATE vendors SET verification_status = ? WHERE id = ?', ['approved', vendorId]);

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [vendorId]);
      const vendorRecord = vendRows[0] || null;
      if (vendorRecord) {
        await pool.execute(
          `INSERT INTO notifications (user_id, message, type, is_read)
           VALUES (?, 'Your shop has been approved. You can now list parts.', 'system', 0)`,
          [vendorRecord.user_id]
        );
      }
    } catch (notifErr) {
      console.error('Notification creation failed in approveVendor:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Vendor approved successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Sets vendor verification status to 'rejected'.
 */
async function rejectVendor(req, res, next) {
  try {
    const vendorId = req.params.id;

    // Update status
    await pool.execute('UPDATE vendors SET verification_status = ? WHERE id = ?', ['rejected', vendorId]);

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [vendorId]);
      const vendorRecord = vendRows[0] || null;
      if (vendorRecord) {
        await pool.execute(
          `INSERT INTO notifications (user_id, message, type, is_read)
           VALUES (?, 'Your shop registration was rejected.', 'system', 0)`,
          [vendorRecord.user_id]
        );
      }
    } catch (notifErr) {
      console.error('Notification creation failed in rejectVendor:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Vendor rejected successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves all registered users, optionally filtered by role ('vendor' or 'customer').
 */
async function getAllUsers(req, res, next) {
  try {
    const { role } = req.query;

    let query = 'SELECT id, name, email, phone, role, status, created_at FROM users';
    const values = [];

    if (role) {
      query += ' WHERE role = ?';
      values.push(role);
    }

    query += ' ORDER BY created_at DESC';

    const [users] = await pool.execute(query, values);

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Blocks a user account by setting status to 'blocked'.
 */
async function blockUser(req, res, next) {
  try {
    const userId = req.params.id;
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', ['blocked', userId]);
    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unblocks a user account by setting status to 'active'.
 */
async function unblockUser(req, res, next) {
  try {
    const userId = req.params.id;
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', ['active', userId]);
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns dashboard statistical counters.
 */
async function getDashboardStats(req, res, next) {
  try {
    const [
      [vendorsCountRows],
      [customersCountRows],
      [partsCountRows],
      [requestsCountRows],
      [pendingCountRows]
    ] = await Promise.all([
      pool.execute('SELECT COUNT(*) as count FROM vendors'),
      pool.execute('SELECT COUNT(*) as count FROM customers'),
      pool.execute('SELECT COUNT(*) as count FROM parts'),
      pool.execute('SELECT COUNT(*) as count FROM requests'),
      pool.execute("SELECT COUNT(*) as count FROM vendors WHERE verification_status = 'pending'")
    ]);

    res.json({
      success: true,
      data: {
        totalVendors: vendorsCountRows[0].count,
        totalCustomers: customersCountRows[0].count,
        totalParts: partsCountRows[0].count,
        totalRequests: requestsCountRows[0].count,
        pendingVendorApprovals: pendingCountRows[0].count
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public & Vendor endpoint to fetch current system settings
 */
async function getPublicSettings(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT * FROM system_settings');
    const settingsMap = {
      security_deposit_amount: '500',
      security_deposit_phone: '+92 311 7595866',
      commission_rate_percent: '10'
    };
    rows.forEach(r => settingsMap[r.setting_key] = r.setting_value);

    res.json({
      success: true,
      data: settingsMap
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin updates system settings (Security Deposit Amount, Phone, Commission Rate %)
 */
async function updateSystemSettings(req, res, next) {
  try {
    const { security_deposit_amount, security_deposit_phone, commission_rate_percent } = req.body;

    if (security_deposit_amount !== undefined) {
      await pool.execute(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES ('security_deposit_amount', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(security_deposit_amount)]
      );
    }

    if (security_deposit_phone !== undefined) {
      await pool.execute(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES ('security_deposit_phone', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(security_deposit_phone)]
      );
    }

    if (commission_rate_percent !== undefined) {
      await pool.execute(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES ('commission_rate_percent', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(commission_rate_percent)]
      );
    }

    const [rows] = await pool.execute('SELECT * FROM system_settings');
    const settingsMap = {};
    rows.forEach(r => settingsMap[r.setting_key] = r.setting_value);

    res.json({
      success: true,
      message: 'System settings updated successfully',
      data: settingsMap
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Sets vendor security_deposit_status to 'paid'.
 */
async function verifyVendorDeposit(req, res, next) {
  try {
    const vendorId = req.params.id;

    await pool.execute('UPDATE vendors SET security_deposit_status = ? WHERE id = ?', ['paid', vendorId]);

    try {
      const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [vendorId]);
      const vendorRecord = vendRows[0] || null;
      if (vendorRecord) {
        await pool.execute(
          `INSERT INTO notifications (user_id, message, type, is_read)
           VALUES (?, 'Your Security Deposit has been verified & approved! You can now respond to customer leads.', 'system', 0)`,
          [vendorRecord.user_id]
        );
      }
    } catch (notifErr) {
      console.error('Notification creation failed in verifyVendorDeposit:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Vendor security deposit verified and marked as paid successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllVendors,
  approveVendor,
  rejectVendor,
  verifyVendorDeposit,
  getAllUsers,
  blockUser,
  unblockUser,
  getDashboardStats,
  getPublicSettings,
  updateSystemSettings
};
