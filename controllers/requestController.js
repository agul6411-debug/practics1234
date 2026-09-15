const RequestModel = require('../models/RequestModel');
const PartModel = require('../models/PartModel');
const VendorModel = require('../models/VendorModel');
const CustomerModel = require('../models/CustomerModel');
const CommissionModel = require('../models/CommissionModel');
const SystemSettingModel = require('../models/SystemSettingModel');
const NotificationModel = require('../models/NotificationModel');
const UserModel = require('../models/UserModel');

/**
 * Creates a new request for a part, calculating sequence numbers and lead locking rules.
 */
async function createRequest(req, res, next) {
  try {
    const userId = req.user.id;

    // Find customer profile (auto-create fallback if missing)
    const customer = await CustomerModel.findOrCreate(userId, 'City');

    const { part_id, delivery_type, delivery_address, delivery_city, delivery_phone, delivery_notes } = req.body;
    if (!part_id) {
      res.status(400);
      throw new Error('part_id is required');
    }

    // Get part by ID
    const part = await PartModel.findById(part_id);
    if (!part) {
      res.status(404);
      throw new Error('Part not found');
    }

    // Stock Quantity & Sold Out Check
    if (part.stock_quantity <= 0 || part.status === 'out_of_stock') {
      return res.status(400).json({
        success: false,
        message: '🚨 PRODUCT SOLD OUT! This product is out of stock and cannot be requested.'
      });
    }

    // Decrement stock quantity by 1
    const newStock = Math.max(0, part.stock_quantity - 1);
    const newStatus = newStock === 0 ? 'out_of_stock' : part.status;
    await PartModel.decrementStock(part_id, newStock, newStatus);

    const vendorId = part.vendor_id;

    // Check if this customer has previously contacted this vendor
    const existingReq = await RequestModel.findByCustomerAndVendor(customer.id, vendorId);

    let sequenceNumber;
    let isLocked;

    if (existingReq) {
      // Reuse sequence_number and is_locked status for known customer-vendor pairs
      sequenceNumber = existingReq.sequence_number;
      isLocked = (existingReq.is_locked == 1 || existingReq.is_locked == true);
    } else {
      // First time contacting vendor: calculate nth distinct customer
      const distinctCount = await RequestModel.countDistinctCustomersForVendor(vendorId);
      sequenceNumber = distinctCount + 1;
      isLocked = sequenceNumber > 2; // Lock leads after first 2 free customers
    }

    const delType = delivery_type === 'home_delivery' ? 'home_delivery' : 'shop_pickup';
    const delAddress = delivery_address && delivery_address.trim() !== '' ? delivery_address.trim() : null;
    const delCity = delivery_city && delivery_city.trim() !== '' ? delivery_city.trim() : null;
    const delPhone = delivery_phone && delivery_phone.trim() !== '' ? delivery_phone.trim() : null;
    const delNotes = delivery_notes && delivery_notes.trim() !== '' ? delivery_notes.trim() : null;

    // Calculate delivery fee (Rs. 200 for home delivery) & total bill amount
    const partPrice = Number(part.price) || 0.00;
    const deliveryFee = delType === 'home_delivery' ? 200.00 : 0.00;
    const totalAmount = Number((partPrice + deliveryFee).toFixed(2));

    // Create request with Home Delivery details and Total Bill
    const newRequest = await RequestModel.create({
      customerId: customer.id,
      vendorId,
      partId: part_id,
      sequenceNumber,
      isLocked,
      deliveryType: delType,
      deliveryAddress: delAddress,
      deliveryCity: delCity,
      deliveryPhone: delPhone,
      deliveryNotes: delNotes,
      deliveryFee,
      totalAmount
    });

    // If this is a brand new unique customer and sequence_number > 2 (locked), automatically create commission record
    if (!existingReq && isLocked) {
      let ratePercent = 10;
      try {
        const val = await SystemSettingModel.getSettingValue('commission_rate_percent');
        if (val && !isNaN(val)) {
          ratePercent = parseFloat(val);
        }
      } catch (err) {
        console.warn('System settings fetch error, using default 10% rate:', err.message);
      }

      const amount = Number((part.price * (ratePercent / 100)).toFixed(2));
      await CommissionModel.create({
        requestId: newRequest.id,
        vendorId,
        amount,
        status: 'pending'
      });
    }

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const vendorRecord = await VendorModel.findById(vendorId);
      if (vendorRecord) {
        const notifMsg = isLocked
          ? `New ${delType === 'home_delivery' ? 'Home Delivery' : 'Pickup'} request received — pay pending commission to view details`
          : `New ${delType === 'home_delivery' ? 'Home Delivery' : 'Pickup'} request for ${part.model_name}`;
        await NotificationModel.create({
          userId: vendorRecord.user_id,
          message: notifMsg,
          type: 'request',
          isRead: 0
        });
      }
    } catch (notifErr) {
      console.error('Notification creation failed in createRequest:', notifErr.message);
    }

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

    // Find customer profile
    const customer = await CustomerModel.findByUserId(userId);
    if (!customer) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    const requests = await RequestModel.getByCustomerId(customer.id);

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

    // Find vendor profile
    const vendor = await VendorModel.findByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const rawRequests = await RequestModel.getByVendorId(vendor.id);

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
          delivery_type: reqItem.delivery_type,
          delivery_fee: reqItem.delivery_fee,
          total_amount: reqItem.total_amount,
          created_at: reqItem.created_at,
          model_name: reqItem.model_name,
          price: reqItem.price,
          condition_type: reqItem.condition_type,
          image_url: reqItem.image_url,
          cancellation_reason: reqItem.cancellation_reason,
          cancelled_by: reqItem.cancelled_by,
          cancelled_at: reqItem.cancelled_at,
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
          delivery_type: reqItem.delivery_type,
          delivery_address: reqItem.delivery_address,
          delivery_city: reqItem.delivery_city,
          delivery_phone: reqItem.delivery_phone,
          delivery_notes: reqItem.delivery_notes,
          delivery_fee: reqItem.delivery_fee,
          total_amount: reqItem.total_amount,
          cancellation_reason: reqItem.cancellation_reason,
          cancelled_by: reqItem.cancelled_by,
          cancelled_at: reqItem.cancelled_at,
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

    // Find vendor profile
    const vendor = await VendorModel.findByUserId(userId);
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

    // Find request by ID
    const request = await RequestModel.findById(requestId);
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

    // Security Deposit Check
    if ((vendor.security_deposit_status || '').toLowerCase() !== 'paid') {
      return res.status(403).json({
        success: false,
        message: 'Security Deposit Required. You must have an approved and paid Security Deposit to respond to customer leads.'
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

    // Update request status — use 'responded' for available so customer sees Review button
    const dbStatus = status === 'available' ? 'responded' : 'not_available';
    await RequestModel.updateStatus(requestId, dbStatus);

    // Trigger notification to customer user (wrapped in try/catch)
    try {
      const customerRecord = await CustomerModel.findById(request.customer_id);
      const part = await PartModel.findById(request.part_id);

      if (customerRecord && part) {
        const statusDisplay = status === 'available' ? 'Available ✅' : 'Not Available ❌';
        await NotificationModel.create({
          userId: customerRecord.user_id,
          message: `Vendor responded to your request for ${part.model_name}: ${statusDisplay}`,
          type: 'response',
          isRead: 0
        });
      }
    } catch (notifErr) {
      console.error('Notification creation failed in respondToRequest:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Request response submitted successfully',
      data: { id: parseInt(requestId, 10), status: dbStatus }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Customer & System Delivery Verification (Auto-Detects Barcode vs QR Code, Checks Reuse & Authenticity)
 */
async function verifyDelivery(req, res, next) {
  try {
    const { part_id, request_id, scanned_barcode } = req.body;
    if (!scanned_barcode || scanned_barcode.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: scanned_barcode.'
      });
    }

    const cleanScanned = scanned_barcode.trim();

    // Auto-detect Code Format (Barcode vs QR Code)
    const isQrCode = cleanScanned.includes('http://') || 
                     cleanScanned.includes('https://') || 
                     cleanScanned.startsWith('{') || 
                     cleanScanned.toLowerCase().startsWith('qr') || 
                     cleanScanned.length > 20 || 
                     cleanScanned.includes(':');
    const codeTypeLabel = isQrCode ? 'QR Code' : 'Barcode';

    let partId = part_id ? parseInt(part_id, 10) : null;
    let expectedBarcode = '';

    if (request_id) {
      const reqWithPart = await RequestModel.findWithPartAndBarcode(request_id);
      if (reqWithPart) {
        partId = reqWithPart.p_id;
        expectedBarcode = (reqWithPart.barcode_number || '').trim();
      }
    }

    if (partId && !expectedBarcode) {
      const part = await PartModel.findById(partId);
      if (part) {
        expectedBarcode = (part.barcode_number || '').trim();
      }
    }

    // SECURITY CHECK 1: Product Already Sold / Previously Verified Check across ALL orders
    const prevOrder = await RequestModel.findByVerifiedBarcode(cleanScanned, request_id);

    if (prevOrder) {
      return res.status(200).json({
        success: false,
        is_match: false,
        is_duplicate_reuse: true,
        is_already_sold: true,
        code_type: codeTypeLabel,
        previous_request_id: prevOrder.id,
        message: `🚨 FRAUD WARNING: PRODUCT ALREADY SOLD!\nThis original product with ${codeTypeLabel} (${cleanScanned}) was ALREADY sold and verified in a previous completed order (#${prevOrder.id}). The ${codeTypeLabel} label attached to this package is FAKE or COPIED!`
      });
    }

    // SECURITY CHECK 2: Copied Code Check across OTHER registered parts in system
    const otherPart = await PartModel.findOtherPartByBarcode(cleanScanned, partId);

    if (otherPart) {
      return res.status(200).json({
        success: false,
        is_match: false,
        is_duplicate_reuse: true,
        is_already_sold: false,
        code_type: codeTypeLabel,
        message: `🚨 FRAUD WARNING: COPIED / FAKE ${codeTypeLabel.toUpperCase()} DETECTED!\nThis ${codeTypeLabel} belongs to another product listing (${otherPart.model_name} from ${otherPart.shop_name}). The vendor attached a duplicate/fake ${codeTypeLabel} label to this package!`
      });
    }

    // SECURITY CHECK 3: Match against declared product code
    const isMatch = cleanScanned.toLowerCase() === expectedBarcode.toLowerCase();

    if (!isMatch) {
      return res.status(200).json({
        success: false,
        is_match: false,
        is_duplicate_reuse: false,
        code_type: codeTypeLabel,
        message: `Mismatch — Scanned ${codeTypeLabel} (${cleanScanned}) does not match declared product ${codeTypeLabel} (${expectedBarcode || 'N/A'}).`
      });
    }

    // UPDATE REQUEST AS VERIFIED & EXPIRE QR CODE (If request_id present)
    if (request_id) {
      await RequestModel.verifyDelivery(request_id, cleanScanned);

      // Expire QR code / barcode token and set part to sold out
      if (partId) {
        await PartModel.markOutOfStock(partId);
      }
    }

    return res.status(200).json({
      success: true,
      is_match: true,
      is_duplicate_reuse: false,
      code_type: codeTypeLabel,
      message: `✅ Authentic Product Verified! This ${codeTypeLabel} is genuine. The ${codeTypeLabel} has now been marked as EXPIRED & INACTIVE.`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Vendor Online Order Cancellation with Admin Notification & Counter Auto-Block (Limit: 3)
 */
async function cancelRequestByVendor(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const vendor = await VendorModel.findByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const requestId = req.params.id;
    const { reason } = req.body;
    const cancelReason = reason && reason.trim() !== '' ? reason.trim() : 'Vendor cancelled order online';

    // Find request by ID
    const request = await RequestModel.findById(requestId);
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

    if (request.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This request has already been cancelled.'
      });
    }

    // 1. Update Request status to cancelled
    await RequestModel.cancelByVendor(requestId, cancelReason);

    // 2. Restore Part Stock Quantity
    await PartModel.restoreStock(request.part_id);

    // 3. Increment Vendor Cancellation Counter
    const updatedVendor = await VendorModel.incrementCancellationCount(vendor.id);
    const newCancelCount = updatedVendor.cancellation_count || 1;

    let maxLimit = 3;
    try {
      const val = await SystemSettingModel.getSettingValue('max_vendor_cancellations');
      if (val && !isNaN(val)) {
        maxLimit = parseInt(val, 10);
      }
    } catch (_) {}

    const isAutoBlocked = newCancelCount >= maxLimit;

    // 4. Auto-block Vendor if cancellation count reaches limit (3 or 4)
    if (isAutoBlocked) {
      await UserModel.updateStatus(vendor.user_id, 'blocked');

      try {
        await NotificationModel.create({
          userId: vendor.user_id,
          message: `🚨 ACCOUNT AUTOMATICALLY BLOCKED: Your vendor account has been blocked because you cancelled ${newCancelCount} orders (Cancellation Limit: ${maxLimit}). Reason: Exceeded online order cancellation limit.`,
          type: 'system',
          isRead: 0
        });
      } catch (notifErr) {
        console.error('Failed to notify vendor of auto-block:', notifErr.message);
      }
    }

    // 5. Notify Customer about cancellation
    try {
      const customerRecord = await CustomerModel.findById(request.customer_id);
      const part = await PartModel.findById(request.part_id);
      const partModelName = part ? part.model_name : 'product';

      if (customerRecord) {
        await NotificationModel.create({
          userId: customerRecord.user_id,
          message: `Your order #${requestId} for ${partModelName} was cancelled by the vendor. Reason: ${cancelReason}`,
          type: 'response',
          isRead: 0
        });
      }
    } catch (notifErr) {
      console.error('Customer notification failed on cancellation:', notifErr.message);
    }

    // 6. Notify All Admins about Vendor Cancellation & Auto-Block Status
    try {
      const adminUsers = await UserModel.getAdminUsers();
      const part = await PartModel.findById(request.part_id);
      const partModelName = part ? part.model_name : 'product';

      const adminMsg = isAutoBlocked
        ? `🚨 VENDOR AUTO-BLOCKED: Vendor '${updatedVendor.shop_name}' (ID: ${vendor.id}) cancelled Order #${requestId} (${partModelName}) and was AUTOMATICALLY BLOCKED after reaching ${newCancelCount}/${maxLimit} order cancellations!`
        : `⚠️ ORDER CANCELLED BY VENDOR: Vendor '${updatedVendor.shop_name}' cancelled Order #${requestId} (${partModelName}). Reason: ${cancelReason}. Vendor total cancellations: ${newCancelCount}/${maxLimit}.`;

      for (const adminUser of adminUsers) {
        await NotificationModel.create({
          userId: adminUser.id,
          message: adminMsg,
          type: 'system',
          isRead: 0
        });
      }
    } catch (adminNotifErr) {
      console.error('Admin notification failed on cancellation:', adminNotifErr.message);
    }

    res.json({
      success: true,
      is_auto_blocked: isAutoBlocked,
      cancellation_count: newCancelCount,
      message: isAutoBlocked
        ? `Order cancelled. 🚨 WARNING: Your account has been AUTOMATICALLY BLOCKED due to reaching the cancellation limit of ${maxLimit} orders.`
        : `Order cancelled successfully. Total vendor cancellations: ${newCancelCount}/${maxLimit}.`,
      data: { id: parseInt(requestId, 10), status: 'cancelled', cancellation_count: newCancelCount }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Customer confirms receipt of part delivery (Option 2 - Manual Confirmation)
 */
async function confirmDeliveryManual(req, res, next) {
  try {
    const userId = req.user.id;
    const customer = await CustomerModel.findByUserId(userId);
    if (!customer) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    const requestId = req.params.id;
    const request = await RequestModel.findById(requestId);
    if (!request) {
      res.status(404);
      throw new Error('Request not found');
    }

    if (request.customer_id !== customer.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not own this order.'
      });
    }

    if (request.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'This delivery has already been confirmed as delivered.'
      });
    }

    await RequestModel.confirmDeliveryCustomer(requestId, customer.id);
    await PartModel.markOutOfStock(request.part_id);

    // Notify Vendor
    try {
      const vendor = await VendorModel.findById(request.vendor_id);
      const part = await PartModel.findById(request.part_id);
      if (vendor) {
        await NotificationModel.create({
          userId: vendor.user_id,
          message: `✅ Order #${requestId} (${part ? part.model_name : 'Component'}) delivery was confirmed by the customer! Sale completed.`,
          type: 'response',
          isRead: 0
        });
      }
    } catch (_) {}

    res.json({
      success: true,
      message: 'Delivery confirmed successfully! You can now leave a review for this vendor.',
      data: { id: parseInt(requestId, 10), status: 'delivered' }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRequest,
  getMyRequests,
  getVendorRequests,
  respondToRequest,
  cancelRequestByVendor,
  verifyDelivery,
  confirmDeliveryManual
};

