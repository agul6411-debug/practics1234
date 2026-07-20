const userModel = require('../models/userModel');
const vendorModel = require('../models/vendorModel');
const adminModel = require('../models/adminModel');
const notificationModel = require('../models/notificationModel');

/**
 * Retrieves all vendors, optionally filtered by status ('pending', 'approved', 'rejected').
 */
async function getAllVendors(req, res, next) {
  try {
    const { status } = req.query;
    const vendors = await vendorModel.getAllVendors(status);
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
    await vendorModel.updateVerificationStatus(vendorId, 'approved');

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await vendorModel.getVendorById(vendorId);
      if (vendorRecord) {
        await notificationModel.createNotification({
          user_id: vendorRecord.user_id,
          message: 'Your shop has been approved. You can now list parts.',
          type: 'system'
        });
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
    await vendorModel.updateVerificationStatus(vendorId, 'rejected');

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await vendorModel.getVendorById(vendorId);
      if (vendorRecord) {
        await notificationModel.createNotification({
          user_id: vendorRecord.user_id,
          message: 'Your shop registration was rejected.',
          type: 'system'
        });
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
    const users = await userModel.getAllUsers(role);
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
    await userModel.updateUserStatus(userId, 'blocked');
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
    await userModel.updateUserStatus(userId, 'active');
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
      totalVendors,
      totalCustomers,
      totalParts,
      totalRequests,
      pendingVendorApprovals
    ] = await Promise.all([
      adminModel.countVendors(),
      adminModel.countCustomers(),
      adminModel.countParts(),
      adminModel.countRequests(),
      adminModel.countPendingVendorApprovals()
    ]);

    res.json({
      success: true,
      data: {
        totalVendors,
        totalCustomers,
        totalParts,
        totalRequests,
        pendingVendorApprovals
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllVendors,
  approveVendor,
  rejectVendor,
  getAllUsers,
  blockUser,
  unblockUser,
  getDashboardStats
};
