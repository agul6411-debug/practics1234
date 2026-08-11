const pool = require('../db');

/**
 * Creates a new request for a part, calculating sequence numbers and lead locking rules.
 */
async function createRequest(req, res, next) {
  try {
    const userId = req.user.id;

    // Find customer profile
    const [custRows] = await pool.execute('SELECT * FROM customers WHERE user_id = ?', [userId]);
    const customer = custRows[0] || null;
    if (!customer) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    const { part_id } = req.body;
    if (!part_id) {
      res.status(400);
      throw new Error('part_id is required');
    }

    // Get part by ID
    const [partRows] = await pool.execute('SELECT * FROM parts WHERE id = ?', [part_id]);
    const part = partRows[0] || null;
    if (!part) {
      res.status(404);
      throw new Error('Part not found');
    }

    const vendorId = part.vendor_id;

    // Check if this customer has previously contacted this vendor
    const [existingReqRows] = await pool.execute(
      `SELECT * FROM requests 
       WHERE customer_id = ? AND vendor_id = ? 
       ORDER BY created_at ASC 
       LIMIT 1`,
      [customer.id, vendorId]
    );
    const existingReq = existingReqRows[0] || null;

    let sequenceNumber;
    let isLocked;

    if (existingReq) {
      // Reuse sequence_number and is_locked status for known customers
      sequenceNumber = existingReq.sequence_number;
      isLocked = Boolean(existingReq.is_locked);
    } else {
      // First time contacting vendor: calculate nth distinct customer
      const [countRows] = await pool.execute(
        'SELECT COUNT(DISTINCT customer_id) as count FROM requests WHERE vendor_id = ?',
        [vendorId]
      );
      const distinctCount = countRows[0].count;
      sequenceNumber = distinctCount + 1;
      isLocked = sequenceNumber > 2; // Lock leads after first 2 free customers
    }

    // Create request
    const [requestResult] = await pool.execute(
      `INSERT INTO requests (customer_id, vendor_id, part_id, sequence_number, is_locked, status)
       VALUES (?, ?, ?, ?, ?, 'requested')`,
      [customer.id, vendorId, part_id, sequenceNumber, isLocked ? 1 : 0]
    );
    const requestId = requestResult.insertId;

    // If this is a brand new unique customer and sequence_number > 2 (locked), automatically create commission record
    if (!existingReq && isLocked) {
      let ratePercent = 10;
      try {
        const [rateRows] = await pool.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'commission_rate_percent'");
        if (rateRows.length > 0 && !isNaN(rateRows[0].setting_value)) {
          ratePercent = parseFloat(rateRows[0].setting_value);
        }
      } catch (err) {
        console.warn('System settings fetch error, using default 10% rate:', err.message);
      }

      const amount = Number((part.price * (ratePercent / 100)).toFixed(2));
      await pool.execute(
        `INSERT INTO commissions (request_id, vendor_id, amount, status)
         VALUES (?, ?, ?, 'pending')`,
         [requestId, vendorId, amount]
      );
    }

    // Trigger notification to vendor user (wrapped in try/catch)
    try {
      const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE id = ?', [vendorId]);
      const vendorRecord = vendRows[0] || null;
      if (vendorRecord) {
        const notifMsg = isLocked
          ? 'New request received — pay pending commission to view details'
          : `New request for ${part.model_name}`;
        await pool.execute(
          `INSERT INTO notifications (user_id, message, type, is_read)
           VALUES (?, ?, 'request', 0)`,
          [vendorRecord.user_id, notifMsg]
        );
      }
    } catch (notifErr) {
      console.error('Notification creation failed in createRequest:', notifErr.message);
    }

    // Get created request
    const [newRequestRows] = await pool.execute('SELECT * FROM requests WHERE id = ?', [requestId]);
    const newRequest = newRequestRows[0] || null;

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
    const [custRows] = await pool.execute('SELECT * FROM customers WHERE user_id = ?', [userId]);
    const customer = custRows[0] || null;
    if (!customer) {
      res.status(404);
      throw new Error('Customer profile not found');
    }

    // Get requests by customer
    const [requests] = await pool.execute(
      `SELECT 
        r.id, r.sequence_number, r.is_locked, r.status, r.created_at,
        p.id as part_id, p.model_name, p.price, p.image_url,
        v.id as vendor_id, v.user_id as vendor_user_id, v.shop_name, v.city as vendor_city, v.address as vendor_address,
        b.name as brand_name, pt.name as part_type_name
      FROM requests r
      JOIN parts p ON r.part_id = p.id
      JOIN vendors v ON r.vendor_id = v.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN part_types pt ON p.part_type_id = pt.id
      WHERE r.customer_id = ?
      ORDER BY r.created_at DESC`,
      [customer.id]
    );

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
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = vendRows[0] || null;
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    // Get vendor requests
    const [rawRequests] = await pool.execute(
      `SELECT 
        r.id, r.customer_id, r.vendor_id, r.part_id, r.sequence_number, r.is_locked, r.status, r.created_at,
        p.model_name, p.price, p.condition_type, p.image_url,
        u.id as customer_user_id, u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
        c.city as customer_city
      FROM requests r
      JOIN parts p ON r.part_id = p.id
      JOIN customers c ON r.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE r.vendor_id = ?
      ORDER BY r.created_at DESC, r.id DESC`,
      [vendor.id]
    );

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

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = vendRows[0] || null;
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
    const [requestRows] = await pool.execute('SELECT * FROM requests WHERE id = ?', [requestId]);
    const request = requestRows[0] || null;
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

    // Update request status
    await pool.execute('UPDATE requests SET status = ? WHERE id = ?', [status, requestId]);

    // Trigger notification to customer user (wrapped in try/catch)
    try {
      const [custRows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [request.customer_id]);
      const customerRecord = custRows[0] || null;

      const [partRows] = await pool.execute('SELECT * FROM parts WHERE id = ?', [request.part_id]);
      const part = partRows[0] || null;

      if (customerRecord && part) {
        const statusDisplay = status === 'available' ? 'Available' : 'Not Available';
        await pool.execute(
          `INSERT INTO notifications (user_id, message, type, is_read)
           VALUES (?, ?, 'response', 0)`,
          [customerRecord.user_id, `Vendor responded to your request for ${part.model_name}: ${statusDisplay}`]
        );
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
      const [reqRows] = await pool.execute(
        `SELECT r.*, p.barcode_number, p.id as p_id 
         FROM requests r 
         JOIN parts p ON r.part_id = p.id 
         WHERE r.id = ?`,
        [request_id]
      );
      if (reqRows.length > 0) {
        partId = reqRows[0].p_id;
        expectedBarcode = (reqRows[0].barcode_number || '').trim();
      }
    }

    if (partId && !expectedBarcode) {
      const [partRows] = await pool.execute('SELECT barcode_number FROM parts WHERE id = ?', [partId]);
      if (partRows.length > 0) {
        expectedBarcode = (partRows[0].barcode_number || '').trim();
      }
    }

    // SECURITY CHECK 1: Product Already Sold / Previously Verified Check across ALL orders
    const reqFilter = request_id ? 'AND r.id != ?' : '';
    const reqParams = request_id ? [cleanScanned, request_id] : [cleanScanned];

    const [prevReuseRows] = await pool.execute(
      `SELECT r.id, r.created_at, r.verified_at, p.model_name
       FROM requests r
       JOIN parts p ON r.part_id = p.id
       WHERE LOWER(TRIM(r.verified_barcode)) = LOWER(TRIM(?)) ${reqFilter}`,
      reqParams
    );

    if (prevReuseRows.length > 0) {
      const prevOrder = prevReuseRows[0];
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
    const partFilter = partId ? 'AND p.id != ?' : '';
    const partParams = partId ? [cleanScanned, partId] : [cleanScanned];

    const [otherPartRows] = await pool.execute(
      `SELECT p.id, p.model_name, v.shop_name
       FROM parts p
       JOIN vendors v ON p.vendor_id = v.id
       WHERE LOWER(TRIM(p.barcode_number)) = LOWER(TRIM(?)) ${partFilter}`,
      partParams
    );

    if (otherPartRows.length > 0) {
      const otherPart = otherPartRows[0];
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

    // UPDATE REQUEST AS VERIFIED (If request_id present)
    if (request_id) {
      await pool.execute(
        `UPDATE requests SET verified_barcode = ?, verified_at = NOW(), status = 'available' WHERE id = ?`,
        [cleanScanned, request_id]
      );
    }

    return res.status(200).json({
      success: true,
      is_match: true,
      is_duplicate_reuse: false,
      code_type: codeTypeLabel,
      message: `✅ Authentic Product Verified! This ${codeTypeLabel} is genuine and original. Go ahead.`
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
  verifyDelivery
};
