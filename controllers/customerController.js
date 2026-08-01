const pool = require('../db');

/**
 * Gets the profile of the logged-in customer.
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

    // Find customer profile
    const [custRows] = await pool.execute('SELECT * FROM customers WHERE user_id = ?', [userId]);
    const customerProfile = custRows[0] || null;
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
    const [custRows] = await pool.execute('SELECT * FROM customers WHERE user_id = ?', [userId]);
    const customerProfile = custRows[0] || null;
    if (!customerProfile) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    const { city } = req.body;
    if (!city) {
      res.status(400);
      throw new Error('City is required');
    }

    await pool.execute('UPDATE customers SET city = ? WHERE user_id = ?', [city, userId]);

    // Find updated customer profile
    const [updatedRows] = await pool.execute('SELECT * FROM customers WHERE user_id = ?', [userId]);
    const updatedProfile = updatedRows[0] || null;

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
