const customerModel = require('../models/customerModel');
const vendorModel = require('../models/vendorModel');
const partModel = require('../models/partModel');
const requestModel = require('../models/requestModel');
const commissionModel = require('../models/commissionModel');
const notificationModel = require('../models/notificationModel');

/**
 * Creates a new request for a part, calculating sequence numbers and lead locking rules.
 */
async function createRequest(req, res, next) {
  try {
    const userId = req.user.id;
    const customer = await customerModel.findCustomerByUserId(userId);
    if (!customer) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    const { part_id } = req.body;
    if (!part_id) {
      res.status(400);
      throw new Error('part_id is required');
    }

    const part = await partModel.getPartById(part_id);
    if (!part) {
      res.status(404);
      throw new Error('Part not found');
    }

    const vendorId = part.vendor_id;

    // Check if this customer has previously contacted this vendor
    const existingReq = await requestModel.findExistingRequestForCustomerVendor(customer.id, vendorId);

    let sequenceNumber;
    let isLocked;

    if (existingReq) {
      // Reuse sequence_number and is_locked status for known customers
      sequenceNumber = existingReq.sequence_number;
      isLocked = Boolean(existingReq.is_locked);
    } else {
      // First time contacting vendor: calculate nth distinct customer
      const distinctCount = await requestModel.countDistinctCustomersForVendor(vendorId);
      sequenceNumber = distinctCount + 1;
      isLocked = sequenceNumber > 2; // Lock leads after first 2 free customers
    }

    const requestId = await requestModel.createRequest({
      customer_id: customer.id,
      vendor_id: vendorId,
      part_id,
      sequence_number: sequenceNumber,
      is_locked: isLocked
    });

    // If this is a brand new unique customer and sequence_number > 2 (locked), automatically create a 10% commission record
    if (!existingReq && isLocked) {
      const amount = Number((part.price * 0.10).toFixed(2));
      await commissionModel.createCommission({
        request_id: requestId,
        vendor_id: vendorId,
        amount
      });
    }

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await vendorModel.getVendorById(vendorId);
      if (vendorRecord) {
        const notifMsg = isLocked
          ? 'New request received — pay pending commission to view details'
          : `New request for ${part.model_name}`;
        await notificationModel.createNotification({
          user_id: vendorRecord.user_id,
          message: notifMsg,
          type: 'request'
        });
      }
    } catch (notifErr) {
      console.error('Notification creation failed in createRequest:', notifErr.message);
    }

    const newRequest = await requestModel.getRequestById(requestId);

    res.status(201).json({
      success: true,
      message: 'Request created successfully',
      data: newRequest
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves all requests submitted by the logged-in customer.
 */
async function getMyRequests(req, res, next) {
  try {
    const userId = req.user.id;
    const customer = await customerModel.findCustomerByUserId(userId);
    if (!customer) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    const requests = await requestModel.getRequestsByCustomer(customer.id);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves all requests received by the logged-in vendor. Obfuscates customer details if locked.
 */
async function getVendorRequests(req, res, next) {
  try {
    const userId = req.user.id;
    const vendor = await vendorModel.findVendorByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const rawRequests = await requestModel.getVendorRequests(vendor.id);

    const formattedRequests = rawRequests.map((reqItem) => {
      const isLocked = reqItem.is_locked == 1 || reqItem.is_locked == true;
      if (isLocked) {
        return {
          id: reqItem.id,
          vendor_id: reqItem.vendor_id,
          part_id: reqItem.part_id,
          sequence_number: reqItem.sequence_number,
          is_locked: true,
          status: reqItem.status,
          created_at: reqItem.created_at,
          model_name: reqItem.model_name,
          price: reqItem.price,
          condition_type: reqItem.condition_type,
          image_url: reqItem.image_url,
          message: 'Pay commission to view customer details'
        };
      } else {
        return {
          id: reqItem.id,
          customer_id: reqItem.customer_id,
          customer_user_id: reqItem.customer_user_id,
          vendor_id: reqItem.vendor_id,
          part_id: reqItem.part_id,
          sequence_number: reqItem.sequence_number,
          is_locked: false,
          status: reqItem.status,
          created_at: reqItem.created_at,
          model_name: reqItem.model_name,
          price: reqItem.price,
          condition_type: reqItem.condition_type,
          image_url: reqItem.image_url,
          customer_name: reqItem.customer_name,
          customer_phone: reqItem.customer_phone,
          customer_email: reqItem.customer_email,
          customer_city: reqItem.customer_city
        };
      }
    });

    res.json({
      success: true,
      count: formattedRequests.length,
      data: formattedRequests
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Responds to a customer request ('available' or 'not_available'). Rejects if request is locked.
 */
async function respondToRequest(req, res, next) {
  try {
    const userId = req.user.id;
    const vendor = await vendorModel.findVendorByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const requestId = req.params.id;
    const { status } = req.body;

    if (!status || (status !== 'available' && status !== 'not_available')) {
      res.status(400);
      throw new Error("status must be either 'available' or 'not_available'");
    }

    const request = await requestModel.getRequestById(requestId);
    if (!request) {
      res.status(404);
      throw new Error('Request not found');
    }

    // Ownership check
    if (request.vendor_id !== vendor.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not own this request.'
      });
    }

    // Lock check
    const isLocked = request.is_locked == 1 || request.is_locked == true;
    if (isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Pay the pending commission to respond to this request'
      });
    }

    await requestModel.updateRequestStatus(requestId, status);

    // Trigger notification to customer user (wrapped in try/catch)
    try {
      const customerRecord = await customerModel.getCustomerById(request.customer_id);
      const part = await partModel.getPartById(request.part_id);
      if (customerRecord && part) {
        const statusDisplay = status === 'available' ? 'Available' : 'Not Available';
        await notificationModel.createNotification({
          user_id: customerRecord.user_id,
          message: `Vendor responded to your request for ${part.model_name}: ${statusDisplay}`,
          type: 'response'
        });
      }
    } catch (notifErr) {
      console.error('Notification creation failed in respondToRequest:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Request response submitted successfully',
      data: { id: parseInt(requestId, 10), status }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRequest,
  getMyRequests,
  getVendorRequests,
  respondToRequest
};
