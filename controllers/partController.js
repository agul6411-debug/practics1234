const pool = require('../db');

/**
 * Add a new part (Vendor only, expects multipart/form-data)
 */
async function addPart(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = vendRows[0] || null;
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    if (vendor.verification_status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your shop is not approved yet'
      });
    }

    const { brand_id, part_type_id, model_name, price, condition_type, stock_quantity, barcode_number, code_type } = req.body;

    if (!brand_id || !part_type_id || !model_name || !price || !condition_type) {
      res.status(400);
      throw new Error('Required fields missing: brand_id, part_type_id, model_name, price, condition_type');
    }

    let cleanBarcode = (barcode_number && barcode_number.trim() !== '' && barcode_number !== 'null')
      ? barcode_number.trim()
      : null;

    const isQrType = code_type === 'qr' || (cleanBarcode && (cleanBarcode.toLowerCase().startsWith('qr') || cleanBarcode.includes(':') || cleanBarcode.length > 20));

    if (!isQrType && (!cleanBarcode || cleanBarcode === '')) {
      return res.status(400).json({
        success: false,
        message: 'Barcode number is strictly required when listing a Barcode product.'
      });
    }

    if (!cleanBarcode) {
      // Auto-generate unique QR Code Token for QR products
      cleanBarcode = `QR-PART-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (!req.files || !req.files['originalPhoto'] || !req.files['barcodePhoto']) {
      res.status(400);
      throw new Error('Required authenticity files missing: originalPhoto and barcodePhoto must be uploaded');
    }

    if (cleanBarcode) {
      const [existingParts] = await pool.execute(
        'SELECT id FROM parts WHERE LOWER(TRIM(barcode_number)) = LOWER(TRIM(?))',
        [cleanBarcode]
      );
      const [existingRequests] = await pool.execute(
        'SELECT id FROM requests WHERE LOWER(TRIM(verified_barcode)) = LOWER(TRIM(?))',
        [cleanBarcode]
      );

      if (existingParts.length > 0 || existingRequests.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Security Alert: This Barcode/QR number has already been registered or sold in the system for another product listing. Duplicate/copied barcodes are strictly prohibited.'
        });
      }
    }

    const originalPhotoFile = req.files['originalPhoto'][0];
    const barcodePhotoFile = req.files['barcodePhoto'][0];

    const original_photo_url = `/uploads/parts/${originalPhotoFile.filename}`;
    const barcode_photo_url = `/uploads/parts/${barcodePhotoFile.filename}`;

    // Create part record
    const [result] = await pool.execute(
      `INSERT INTO parts (vendor_id, brand_id, part_type_id, model_name, price, condition_type, stock_quantity, image_url, barcode_number, original_photo_url, barcode_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendor.id,
        parseInt(brand_id, 10),
        parseInt(part_type_id, 10),
        model_name,
        parseFloat(price),
        condition_type,
        stock_quantity !== undefined ? parseInt(stock_quantity, 10) : 1,
        original_photo_url,
        cleanBarcode,
        original_photo_url,
        barcode_photo_url
      ]
    );
    const partId = result.insertId;

    // Get created part
    const [partRows] = await pool.execute('SELECT * FROM parts WHERE id = ?', [partId]);
    const createdPart = partRows[0] || null;

    res.status(201).json({
      success: true,
      message: 'Part added successfully',
      data: createdPart
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(400).json({
        success: false,
        message: 'Security Alert: This Barcode/QR number has already been registered for another product listing.'
      });
    }
    next(error);
  }
}

/**
 * Get all parts for the logged-in vendor
 */
async function getMyParts(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = vendRows[0] || null;
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    // Get parts by vendor
    const [parts] = await pool.execute(
      `SELECT p.*, b.name as brand_name, pt.name as part_type_name
       FROM parts p
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN part_types pt ON p.part_type_id = pt.id
       WHERE p.vendor_id = ? AND p.status = 'available'
       ORDER BY p.created_at DESC`,
      [vendor.id]
    );

    res.json({
      success: true,
      data: parts
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a part owned by the logged-in vendor
 */
async function updatePart(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = vendRows[0] || null;
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const partId = req.params.id;

    // Get part by ID
    const [partRows] = await pool.execute('SELECT * FROM parts WHERE id = ?', [partId]);
    const part = partRows[0] || null;

    if (!part) {
      res.status(404);
      throw new Error('Part not found');
    }

    if (part.vendor_id !== vendor.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not own this part.'
      });
    }

    const { price, stock_quantity, condition_type, status, model_name, barcode_number } = req.body;

    let cleanBarcode = undefined;
    if (barcode_number !== undefined) {
      cleanBarcode = (barcode_number && barcode_number.trim() !== '' && barcode_number !== 'null')
        ? barcode_number.trim()
        : null;
    }

    if (cleanBarcode) {
      const [existingParts] = await pool.execute(
        'SELECT id FROM parts WHERE LOWER(TRIM(barcode_number)) = LOWER(TRIM(?)) AND id != ?',
        [cleanBarcode, partId]
      );
      const [existingRequests] = await pool.execute(
        'SELECT id FROM requests WHERE LOWER(TRIM(verified_barcode)) = LOWER(TRIM(?))',
        [cleanBarcode]
      );

      if (existingParts.length > 0 || existingRequests.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Security Alert: This Barcode/QR number has already been registered or sold in the system for another product listing.'
        });
      }
    }

    const fieldsToUpdate = {};
    if (price !== undefined) fieldsToUpdate.price = parseFloat(price);
    if (stock_quantity !== undefined) fieldsToUpdate.stock_quantity = parseInt(stock_quantity, 10);
    if (condition_type !== undefined) fieldsToUpdate.condition_type = condition_type;
    if (status !== undefined) fieldsToUpdate.status = status;
    if (model_name !== undefined) fieldsToUpdate.model_name = model_name;
    if (barcode_number !== undefined) fieldsToUpdate.barcode_number = cleanBarcode;

    if (req.files) {
      if (req.files['originalPhoto']) {
        const file = req.files['originalPhoto'][0];
        fieldsToUpdate.original_photo_url = `/uploads/parts/${file.filename}`;
        fieldsToUpdate.image_url = `/uploads/parts/${file.filename}`;
      }
      if (req.files['barcodePhoto']) {
        const file = req.files['barcodePhoto'][0];
        fieldsToUpdate.barcode_photo_url = `/uploads/parts/${file.filename}`;
      }
    }

    const allowedFields = ['price', 'stock_quantity', 'condition_type', 'status', 'image_url', 'model_name', 'barcode_number', 'original_photo_url', 'barcode_photo_url'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (fieldsToUpdate[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(fieldsToUpdate[field]);
      }
    }

    if (updates.length > 0) {
      values.push(partId);
      await pool.execute(`UPDATE parts SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Get updated part
    const [updatedPartRows] = await pool.execute('SELECT * FROM parts WHERE id = ?', [partId]);
    const updatedPart = updatedPartRows[0] || null;

    res.json({
      success: true,
      message: 'Part updated successfully',
      data: updatedPart
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a part owned by the logged-in vendor
 */
async function deletePart(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = vendRows[0] || null;
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const partId = req.params.id;

    // Get part by ID
    const [partRows] = await pool.execute('SELECT * FROM parts WHERE id = ?', [partId]);
    const part = partRows[0] || null;

    if (!part) {
      res.status(404);
      throw new Error('Part not found');
    }

    if (part.vendor_id !== vendor.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not own this part.'
      });
    }

    // Try deleting part
    try {
      await pool.execute('DELETE FROM parts WHERE id = ?', [partId]);
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
        await pool.execute("UPDATE parts SET status = 'out_of_stock', stock_quantity = 0 WHERE id = ?", [partId]);
      } else {
        throw err;
      }
    }

    res.json({
      success: true,
      message: 'Part deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public detail/verification endpoint (No Auth Required)
 */
async function getPartDetails(req, res, next) {
  try {
    const partId = req.params.id;

    // Public detail query joined with vendor shop details
    const [rows] = await pool.execute(
      `SELECT 
        p.*,
        b.name as brand_name,
        pt.name as part_type_name,
        v.user_id as vendor_user_id, v.shop_name, v.city as vendor_city, v.address as vendor_address
      FROM parts p
      JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN part_types pt ON p.part_type_id = pt.id
      WHERE p.id = ?`,
      [partId]
    );
    const part = rows[0] || null;

    if (!part) {
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
    }

    res.json({
      success: true,
      data: part
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  addPart,
  getMyParts,
  updatePart,
  deletePart,
  getPartDetails
};
