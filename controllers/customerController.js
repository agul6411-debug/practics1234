const UserModel = require('../models/UserModel');
const CustomerModel = require('../models/CustomerModel');

/**
 * Gets the profile of the logged-in customer.
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

    // Find customer profile
    const customerProfile = await CustomerModel.findByUserId(userId);
    if (!customerProfile) {
      res.status(404);
      throw new Error('Customer profile not found');
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
        customer_id: customerProfile.id,
        city: customerProfile.city,
        created_at: customerProfile.created_at
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates the city for the logged-in customer.
 */
async function updateMyProfile(req, res, next) {
  try {
    const userId = req.user.id;

    // Find customer profile
    const customerProfile = await CustomerModel.findByUserId(userId);
    if (!customerProfile) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    const { city } = req.body;
    if (!city) {
      res.status(400);
      throw new Error('City is required');
    }

    const updatedProfile = await CustomerModel.updateCity(userId, city);

    res.json({
      success: true,
      message: 'Customer profile updated successfully',
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
