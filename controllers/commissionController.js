const vendorModel = require('../models/vendorModel');
const commissionModel = require('../models/commissionModel');
const requestModel = require('../models/requestModel');
const notificationModel = require('../models/notificationModel');

/**
 * Allows a vendor to upload a payment proof URL for a commission.
 */
async function uploadProof(req, res, next) {
  try {
    const userId = req.user.id;
    const vendor = await vendorModel.findVendorByUserId(userId);
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

    const commission = await commissionModel.getCommissionById(commissionId);
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

    await commissionModel.updateProof(commissionId, payment_proof_url.trim());
    const updatedCommission = await commissionModel.getCommissionById(commissionId);

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
    const vendor = await vendorModel.findVendorByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const { status } = req.query;
    const commissions = await commissionModel.getCommissionsByVendor(vendor.id, status);

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
    const commissions = await commissionModel.getAllCommissions(status);

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

    const commission = await commissionModel.getCommissionById(commissionId);
    if (!commission) {
      res.status(404);
      throw new Error('Commission record not found');
    }

    await commissionModel.markPaid(commissionId, adminUserId);

    // Fetch the linked request to unlock customer+vendor pair
    const request = await requestModel.getRequestById(commission.request_id);
    if (request) {
      await requestModel.unlockRequestsForCustomerVendor(request.customer_id, request.vendor_id);
    }

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await vendorModel.getVendorById(commission.vendor_id);
      if (vendorRecord) {
        await notificationModel.createNotification({
          user_id: vendorRecord.user_id,
          message: 'Your commission payment was verified. Your leads with this customer are now unlocked.',
          type: 'commission'
        });
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

    const commission = await commissionModel.getCommissionById(commissionId);
    if (!commission) {
      res.status(404);
      throw new Error('Commission record not found');
    }

    await commissionModel.markRejected(commissionId);

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await vendorModel.getVendorById(commission.vendor_id);
      if (vendorRecord) {
        await notificationModel.createNotification({
          user_id: vendorRecord.user_id,
          message: 'Your payment proof was rejected. Please resubmit.',
          type: 'commission'
        });
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
