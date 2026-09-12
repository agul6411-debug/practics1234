const CommissionModel = require('../models/CommissionModel');
const VendorModel = require('../models/VendorModel');
const RequestModel = require('../models/RequestModel');
const NotificationModel = require('../models/NotificationModel');

/**
 * Allows a vendor to upload a payment proof URL for a commission.
 */
async function uploadProof(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const vendor = await VendorModel.findByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const commissionId = req.params.id;
    let proofUrl = (req.body.payment_proof_url && req.body.payment_proof_url.trim().length > 0)
      ? req.body.payment_proof_url.trim()
      : null;

    if (req.file) {
      proofUrl = '/uploads/commissions/' + req.file.filename;
    }

    if (!proofUrl) {
      res.status(400);
      throw new Error('Receipt image file is required');
    }

    // Get commission by ID
    const commission = await CommissionModel.findById(commissionId);
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

    if (commission.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This commission has already been verified and paid.'
      });
    }

    // Update payment proof and set status to pending for admin verification
    const updatedCommission = await CommissionModel.uploadProof(commissionId, proofUrl);

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
    const vendor = await VendorModel.findByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const { status } = req.query;
    const commissions = await CommissionModel.getByVendor(vendor.id, status);

    // Automatically mark vendor's commission notifications as read to stop repeated alerts
    await NotificationModel.markReadByType(userId, 'commission');

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
    const commissions = await CommissionModel.getAll(status);

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
    const commission = await CommissionModel.findById(commissionId);
    if (!commission) {
      res.status(404);
      throw new Error('Commission record not found');
    }

    if (commission.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This commission has already been verified and paid.'
      });
    }

    // Mark as paid
    await CommissionModel.verify(commissionId, adminUserId);

    // Fetch the linked request to unlock customer+vendor pair
    const request = await RequestModel.findById(commission.request_id);
    if (request) {
      await RequestModel.unlockLeads(request.customer_id, request.vendor_id);
    }

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await VendorModel.findById(commission.vendor_id);
      if (vendorRecord) {
        // Mark old commission notifications as read to prevent duplicate popup/alert spam
        await NotificationModel.markReadByType(vendorRecord.user_id, 'commission');

        await NotificationModel.create({
          userId: vendorRecord.user_id,
          message: 'Your commission payment was verified. Your leads with this customer are now unlocked.',
          type: 'commission',
          isRead: 0
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

    // Get commission by ID
    const commission = await CommissionModel.findById(commissionId);
    if (!commission) {
      res.status(404);
      throw new Error('Commission record not found');
    }

    // Mark as rejected
    await CommissionModel.reject(commissionId);

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await VendorModel.findById(commission.vendor_id);
      if (vendorRecord) {
        await NotificationModel.create({
          userId: vendorRecord.user_id,
          message: 'Your payment proof was rejected. Please resubmit.',
          type: 'commission',
          isRead: 0
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
