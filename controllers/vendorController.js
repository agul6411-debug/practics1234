const pool = require('../db');

/**
 * Gets the profile of the logged-in vendor.
 */
async function getMyProfile(req, res, next) {
  try {
    const userId = req.user.id;
    
    // Find user
    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    const user = userRows[0] || null;
    if (!user) {
      res.status(404);
      throw new Error('User account not found');
    }

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendorProfile = vendRows[0] || null;
    if (!vendorProfile) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        vendor_id: vendorProfile.id,
        shop_name: vendorProfile.shop_name,
        verification_docs: vendorProfile.verification_docs,
        city: vendorProfile.city,
        address: vendorProfile.address,
        latitude: vendorProfile.latitude,
        longitude: vendorProfile.longitude,
        verification_status: vendorProfile.verification_status,
        security_deposit_status: vendorProfile.security_deposit_status || 'unpaid',
        security_deposit_amount: vendorProfile.security_deposit_amount || 5000.00,
        security_deposit_proof: vendorProfile.security_deposit_proof || null,
        created_at: vendorProfile.created_at
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates profile fields for the logged-in vendor.
 */
async function updateMyProfile(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendorProfile = vendRows[0] || null;
    if (!vendorProfile) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const { shop_name, city, address, latitude, longitude } = req.body;

    const allowedFields = ['shop_name', 'city', 'address', 'latitude', 'longitude'];
    const updates = [];
    const values = [];
    const fields = { shop_name, city, address, latitude, longitude };

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

    // Get updated profile
    const [updatedRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const updatedProfile = updatedRows[0] || null;

    res.json({
      success: true,
      message: 'Vendor profile updated successfully',
      data: updatedProfile
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submits vendor security deposit receipt URL.
 */
async function submitSecurityDepositProof(req, res, next) {
  try {
    const userId = req.user.id;
    let proofUrl = (req.body.deposit_proof_url && req.body.deposit_proof_url.trim().length > 0)
      ? req.body.deposit_proof_url.trim()
      : null;

    if (req.file) {
      proofUrl = '/uploads/parts/' + req.file.filename;
    }

    if (!proofUrl) {
      return res.status(400).json({
        success: false,
        message: 'Receipt image file is required.'
      });
    }

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendorProfile = vendRows[0] || null;

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

    // Get updated profile
    const [updatedRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const updatedProfile = updatedRows[0] || null;

    res.json({
      success: true,
      message: 'Security deposit proof submitted successfully! Verification pending admin review.',
      data: updatedProfile
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  submitSecurityDepositProof
};
