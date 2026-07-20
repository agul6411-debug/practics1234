const vendorModel = require('../models/vendorModel');
const userModel = require('../models/userModel');

/**
 * Gets the profile of the logged-in vendor.
 */
async function getMyProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const user = await userModel.findUserById(userId);
    if (!user) {
      res.status(404);
      throw new Error('User account not found');
    }

    const vendorProfile = await vendorModel.findVendorByUserId(userId);
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
    const vendorProfile = await vendorModel.findVendorByUserId(userId);
    if (!vendorProfile) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const { shop_name, city, address, latitude, longitude } = req.body;

    await vendorModel.updateVendorProfileByUserId(userId, {
      shop_name,
      city,
      address,
      latitude,
      longitude
    });

    const updatedProfile = await vendorModel.findVendorByUserId(userId);

    res.json({
      success: true,
      message: 'Vendor profile updated successfully',
      data: updatedProfile
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile
};
