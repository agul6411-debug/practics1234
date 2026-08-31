const pool = require('../db');

/**
 * Retrieves all vendors, optionally filtered by status ('pending', 'approved', 'rejected').
 */
async function getAllVendors(req, res, next) {
  try {
    const { status } = req.query;

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

    // Update status - approve vendor shop (security deposit remains separate and must be paid/verified)
    await pool.execute(
      "UPDATE vendors SET verification_status = 'approved' WHERE id = ?",
      [vendorId]
    );

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

    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [vendorId]);
    const vendorRecord = vendRows[0] || null;
    if (!vendorRecord) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    if (vendorRecord.security_deposit_status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Vendor security deposit is already verified and marked as paid'
      });
    }

    await pool.execute('UPDATE vendors SET security_deposit_status = ? WHERE id = ?', ['paid', vendorId]);

    try {
      // Mark older deposit notifications as read to prevent spam
      await pool.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND message LIKE '%Security Deposit%'",
        [vendorRecord.user_id]
      );

      await pool.execute(
        `INSERT INTO notifications (user_id, message, type, is_read)
         VALUES (?, 'Your Security Deposit has been verified & approved! You can now respond to customer leads.', 'system', 0)`,
        [vendorRecord.user_id]
      );
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

/**
 * Sets vendor security_deposit_status to 'rejected'.
 */
async function rejectVendorDeposit(req, res, next) {
  try {
    const vendorId = req.params.id;

    await pool.execute('UPDATE vendors SET security_deposit_status = ? WHERE id = ?', ['rejected', vendorId]);

    try {
      const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [vendorId]);
      const vendorRecord = vendRows[0] || null;
      if (vendorRecord) {
        await pool.execute(
          `INSERT INTO notifications (user_id, message, type, is_read)
           VALUES (?, 'Your Security Deposit receipt photo was rejected. Please upload a valid JazzCash/EasyPaisa receipt photo.', 'system', 0)`,
          [vendorRecord.user_id]
        );
      }
    } catch (notifErr) {
      console.error('Notification creation failed in rejectVendorDeposit:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Vendor security deposit marked as rejected'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin Audit: View ALL system notification logs across all users
 */
async function getAllNotificationsAdmin(req, res, next) {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        n.id, n.user_id, n.message, n.type, n.is_read, n.created_at,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC, n.id DESC
    `);

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin Superior: Send/Broadcast custom notification to specific user or groups (vendors, customers, all)
 */
async function broadcastNotificationAdmin(req, res, next) {
  try {
    const { target_role, target_user_id, message, type } = req.body;

    if (!message || message.trim() === '') {
      res.status(400);
      throw new Error('Notification message content is required');
    }

    const notifType = type || 'system';
    const cleanMsg = message.trim();

    if (target_user_id) {
      await pool.execute(
        'INSERT INTO notifications (user_id, message, type, is_read) VALUES (?, ?, ?, 0)',
        [target_user_id, cleanMsg, notifType]
      );
    } else if (target_role === 'vendor' || target_role === 'customer') {
      const [users] = await pool.execute('SELECT id FROM users WHERE role = ?', [target_role]);
      for (const u of users) {
        await pool.execute(
          'INSERT INTO notifications (user_id, message, type, is_read) VALUES (?, ?, ?, 0)',
          [u.id, cleanMsg, notifType]
        );
      }
    } else {
      // Broadcast to ALL users
      const [users] = await pool.execute('SELECT id FROM users');
      for (const u of users) {
        await pool.execute(
          'INSERT INTO notifications (user_id, message, type, is_read) VALUES (?, ?, ?, 0)',
          [u.id, cleanMsg, notifType]
        );
      }
    }

    res.json({
      success: true,
      message: 'Notification broadcast successfully!'
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
  rejectVendorDeposit,
  getAllUsers,
  blockUser,
  unblockUser,
  getDashboardStats,
  getPublicSettings,
  updateSystemSettings,
  getAllNotificationsAdmin,
  broadcastNotificationAdmin
};
