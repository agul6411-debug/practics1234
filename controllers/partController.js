const PartModel = require('../models/PartModel');
const VendorModel = require('../models/VendorModel');
const RequestModel = require('../models/RequestModel');

/**
 * Add a new part (Vendor only, expects multipart/form-data)
 */
async function addPart(req, res, next) {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const vendor = await VendorModel.findByUserId(userId);
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

    if (!cleanBarcode) {
      // Auto-generate unique Authenticity / QR Token for standard/used products without OEM barcode
      cleanBarcode = `PPF-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    }

    if (!req.files || !req.files['originalPhoto']) {
      res.status(400);
      throw new Error('Part photo (originalPhoto) must be uploaded');
    }

    if (cleanBarcode) {
      const existingPart = await PartModel.findByBarcode(cleanBarcode);
      const existingRequest = await RequestModel.findByVerifiedBarcode(cleanBarcode);

      if (existingPart || existingRequest) {
        return res.status(400).json({
          success: false,
          message: 'Security Alert: This Barcode/QR number has already been registered or sold in the system for another product listing. Duplicate/copied barcodes are strictly prohibited.'
        });
      }
    }

    const originalPhotoFile = req.files['originalPhoto'][0];
    const original_photo_url = `/uploads/parts/${originalPhotoFile.filename}`;
    
    // If vendor provided a separate barcode photo, use it; otherwise fallback to the part photo
    const barcodePhotoFile = req.files['barcodePhoto'] ? req.files['barcodePhoto'][0] : null;
    const barcode_photo_url = barcodePhotoFile 
      ? `/uploads/parts/${barcodePhotoFile.filename}`
      : original_photo_url;

    const createdPart = await PartModel.create({
      vendorId: vendor.id,
      brandId: brand_id,
      partTypeId: part_type_id,
      modelName: model_name,
      price: price,
      conditionType: condition_type,
      stockQuantity: stock_quantity,
      imageUrl: original_photo_url,
      barcodeNumber: cleanBarcode,
      originalPhotoUrl: original_photo_url,
      barcodePhotoUrl: barcode_photo_url
    });

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
    const vendor = await VendorModel.findByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const parts = await PartModel.findByVendorId(vendor.id);

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
    const vendor = await VendorModel.findByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const partId = req.params.id;

    // Get part by ID
    const part = await PartModel.findById(partId);
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
      const existingPart = await PartModel.findByBarcode(cleanBarcode, partId);
      const existingRequest = await RequestModel.findByVerifiedBarcode(cleanBarcode);

      if (existingPart || existingRequest) {
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

    const updatedPart = await PartModel.update(partId, fieldsToUpdate);

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
    const vendor = await VendorModel.findByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const partId = req.params.id;

    // Get part by ID
    const part = await PartModel.findById(partId);
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

    await PartModel.delete(partId);

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
    const part = await PartModel.findDetailsWithVendor(partId);

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
