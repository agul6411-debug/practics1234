const pool = require('../db');

/**
 * Allows a vendor to upload a payment proof URL for a commission.
 */
async function uploadProof(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = vendRows[0] || null;
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const commissionId = req.params.id;
    const { payment_proof_url } = req.body;

    if (!payment_proof_url || payment_proof_url.trim().length === 0) {
      res.status(400);
      throw new Error('payment_proof_url is required');
    }

    // Get commission by ID
    const [commRows] = await pool.execute('SELECT * FROM commissions WHERE id = ?', [commissionId]);
    const commission = commRows[0] || null;
    if (!commission) {
      res.status(404);
      throw new Error('Commission record not found');
    }

    // Ownership check
    if (commission.vendor_id !== vendor.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not own this commission record.'
      });
    }

    // Update payment proof
    await pool.execute(
      `UPDATE commissions 
       SET payment_proof_url = ?, 
           status = IF(status = 'rejected', 'pending', status)
       WHERE id = ?`,
      [payment_proof_url.trim(), commissionId]
    );

    // Get updated commission
    const [updatedCommRows] = await pool.execute('SELECT * FROM commissions WHERE id = ?', [commissionId]);
    const updatedCommission = updatedCommRows[0] || null;

    res.json({
      success: true,
      message: 'Payment proof submitted successfully',
      data: updatedCommission
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves commissions for the logged-in vendor.
 */
async function getMyCommissions(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = vendRows[0] || null;
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const { status } = req.query;

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
    const values = [vendor.id];

    if (status && status !== 'all') {
      query += ' AND c.status = ?';
      values.push(status);
    }

    query += ' ORDER BY c.id DESC';

    const [commissions] = await pool.execute(query, values);

    res.json({
      success: true,
      count: commissions.length,
      data: commissions
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to retrieve all commissions across all vendors.
 */
async function getAllCommissionsAdmin(req, res, next) {
  try {
    const { status } = req.query;

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

    const [commissions] = await pool.execute(query, values);

    res.json({
      success: true,
      count: commissions.length,
      data: commissions
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to verify and approve a commission payment proof, unlocking customer leads.
 */
async function verifyCommission(req, res, next) {
  try {
    const commissionId = req.params.id;
    const adminUserId = req.user.id;

    // Get commission by ID
    const [commRows] = await pool.execute('SELECT * FROM commissions WHERE id = ?', [commissionId]);
    const commission = commRows[0] || null;
    if (!commission) {
      res.status(404);
      throw new Error('Commission record not found');
    }

    // Mark as paid
    await pool.execute(
      `UPDATE commissions 
       SET status = 'paid', paid_at = NOW(), verified_by = ? 
       WHERE id = ?`,
      [adminUserId, commissionId]
    );

    // Fetch the linked request to unlock customer+vendor pair
    const [requestRows] = await pool.execute('SELECT * FROM requests WHERE id = ?', [commission.request_id]);
    const request = requestRows[0] || null;
    if (request) {
      await pool.execute(
        'UPDATE requests SET is_locked = 0 WHERE customer_id = ? AND vendor_id = ?',
        [request.customer_id, request.vendor_id]
      );
    }

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [commission.vendor_id]);
      const vendorRecord = vendRows[0] || null;
      if (vendorRecord) {
        await pool.execute(
          `INSERT INTO notifications (user_id, message, type, is_read)
           VALUES (?, 'Your commission payment was verified. Your leads with this customer are now unlocked.', 'commission', 0)`,
          [vendorRecord.user_id]
        );
      }
    } catch (notifErr) {
      console.error('Notification creation failed in verifyCommission:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Commission verified and customer leads unlocked'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to reject a commission payment proof.
 */
async function rejectCommission(req, res, next) {
  try {
    const commissionId = req.params.id;

    // Get commission by ID
    const [commRows] = await pool.execute('SELECT * FROM commissions WHERE id = ?', [commissionId]);
    const commission = commRows[0] || null;
    if (!commission) {
      res.status(404);
      throw new Error('Commission record not found');
    }

    // Mark as rejected
    await pool.execute("UPDATE commissions SET status = 'rejected' WHERE id = ?", [commissionId]);

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [commission.vendor_id]);
      const vendorRecord = vendRows[0] || null;
      if (vendorRecord) {
        await pool.execute(
          `INSERT INTO notifications (user_id, message, type, is_read)
           VALUES (?, 'Your payment proof was rejected. Please resubmit.', 'commission', 0)`,
          [vendorRecord.user_id]
        );
      }
    } catch (notifErr) {
      console.error('Notification creation failed in rejectCommission:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Commission payment proof rejected'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadProof,
  getMyCommissions,
  getAllCommissionsAdmin,
  verifyCommission,
  rejectCommission
};
