const UserModel = require('../models/UserModel');
const VendorModel = require('../models/VendorModel');

/**
 * Gets the profile of the logged-in vendor.
 */
async function getMyProfile(req, res, next) {
  try {
    const userId = req.user.id;
    
    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404);
      throw new Error('User account not found');
    }

    // Find vendor profile
    const vendorProfile = await VendorModel.findByUserId(userId);
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
        security_deposit_amount: vendorProfile.security_deposit_amount || 500.00,
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
    const vendorProfile = await VendorModel.findByUserId(userId);
    if (!vendorProfile) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const { shop_name, city, address, latitude, longitude } = req.body;
    const updatedProfile = await VendorModel.updateProfile(userId, {
      shop_name,
      city,
      address,
      latitude,
      longitude
    });

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
      proofUrl = '/uploads/commissions/' + req.file.filename;
    }

    if (!proofUrl) {
      return res.status(400).json({
        success: false,
        message: 'Receipt image file is required.'
      });
    }

    const updatedProfile = await VendorModel.submitDepositProof(userId, proofUrl);

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
