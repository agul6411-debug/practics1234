const VendorModel = require('../models/VendorModel');
const UserModel = require('../models/UserModel');
const PartModel = require('../models/PartModel');
const RequestModel = require('../models/RequestModel');
const SystemSettingModel = require('../models/SystemSettingModel');
const NotificationModel = require('../models/NotificationModel');

/**
 * Retrieves all vendors, optionally filtered by status ('pending', 'approved', 'rejected').
 */
async function getAllVendors(req, res, next) {
  try {
    const { status } = req.query;
    const vendors = await VendorModel.getAll({ status });

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

    await VendorModel.updateVerificationStatus(vendorId, 'approved');

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await VendorModel.findById(vendorId);
      if (vendorRecord) {
        await NotificationModel.create({
          userId: vendorRecord.user_id,
          message: 'Your shop has been approved. You can now list parts.',
          type: 'system',
          isRead: 0
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

    await VendorModel.updateVerificationStatus(vendorId, 'rejected');

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await VendorModel.findById(vendorId);
      if (vendorRecord) {
        await NotificationModel.create({
          userId: vendorRecord.user_id,
          message: 'Your shop registration was rejected.',
          type: 'system',
          isRead: 0
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
    const users = await UserModel.getAll({ role });

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
    await UserModel.updateStatus(userId, 'blocked');
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
    await UserModel.updateStatus(userId, 'active');
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
    const [totalVendors, totalCustomers, totalParts, totalRequests, pendingVendorApprovals] =
      await Promise.all([
        VendorModel.countAll(),
        UserModel.countByRole('customer'),
        PartModel.countAll(),
        RequestModel.countAll(),
        VendorModel.countPending()
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

/**
 * Public & Vendor endpoint to fetch current system settings
 */
async function getPublicSettings(req, res, next) {
  try {
    const settingsMap = await SystemSettingModel.getPublicSettings();
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
    const settingsMap = await SystemSettingModel.updateMultipleSettings({
      security_deposit_amount,
      security_deposit_phone,
      commission_rate_percent
    });

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
    const vendorRecord = await VendorModel.findById(vendorId);
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

    await VendorModel.updateDepositStatus(vendorId, 'paid');

    try {
      // Mark older deposit notifications as read to prevent spam
      await NotificationModel.markReadByMessagePattern(vendorRecord.user_id, '%Security Deposit%');

      await NotificationModel.create({
        userId: vendorRecord.user_id,
        message: 'Your Security Deposit has been verified & approved! You can now respond to customer leads.',
        type: 'system',
        isRead: 0
      });
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
    await VendorModel.updateDepositStatus(vendorId, 'rejected');

    try {
      const vendorRecord = await VendorModel.findById(vendorId);
      if (vendorRecord) {
        await NotificationModel.create({
          userId: vendorRecord.user_id,
          message: 'Your Security Deposit receipt photo was rejected. Please upload a valid JazzCash receipt photo.',
          type: 'system',
          isRead: 0
        });
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
    const rows = await NotificationModel.getAllAdmin();
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
      await NotificationModel.broadcastToUser(target_user_id, cleanMsg, notifType);
    } else if (target_role === 'vendor' || target_role === 'customer') {
      await NotificationModel.broadcastToRole(target_role, cleanMsg, notifType);
    } else {
      await NotificationModel.broadcastToAll(cleanMsg, notifType);
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
