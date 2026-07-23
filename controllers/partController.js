const partModel = require('../models/partModel');
const vendorModel = require('../models/vendorModel');

/**
 * Add a new part (Vendor only, expects multipart/form-data)
 */
async function addPart(req, res, next) {
  try {
    const userId = req.user.id;
    const vendor = await vendorModel.findVendorByUserId(userId);
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

    const { brand_id, part_type_id, model_name, price, condition_type, stock_quantity, barcode_number } = req.body;

    if (!brand_id || !part_type_id || !model_name || !price || !condition_type || !barcode_number) {
      res.status(400);
      throw new Error('Required fields missing: brand_id, part_type_id, model_name, price, condition_type, barcode_number');
    }

    if (!req.files || !req.files['originalPhoto'] || !req.files['barcodePhoto']) {
      res.status(400);
      throw new Error('Required authenticity files missing: originalPhoto and barcodePhoto must be uploaded');
    }

    const originalPhotoFile = req.files['originalPhoto'][0];
    const barcodePhotoFile = req.files['barcodePhoto'][0];

    const original_photo_url = `/uploads/parts/${originalPhotoFile.filename}`;
    const barcode_photo_url = `/uploads/parts/${barcodePhotoFile.filename}`;

    const partId = await partModel.createPart({
      vendor_id: vendor.id,
      brand_id: parseInt(brand_id, 10),
      part_type_id: parseInt(part_type_id, 10),
      model_name,
      price: parseFloat(price),
      condition_type,
      stock_quantity: stock_quantity !== undefined ? parseInt(stock_quantity, 10) : 1,
      image_url: original_photo_url,
      barcode_number,
      original_photo_url,
      barcode_photo_url
    });

    const createdPart = await partModel.getPartById(partId);

    res.status(201).json({
      success: true,
      message: 'Part added successfully',
      data: createdPart
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all parts for the logged-in vendor
 */
async function getMyParts(req, res, next) {
  try {
    const userId = req.user.id;
    const vendor = await vendorModel.findVendorByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const parts = await partModel.getPartsByVendor(vendor.id);

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
    const vendor = await vendorModel.findVendorByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const partId = req.params.id;
    const part = await partModel.getPartById(partId);

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

    const fieldsToUpdate = {};
    if (price !== undefined) fieldsToUpdate.price = parseFloat(price);
    if (stock_quantity !== undefined) fieldsToUpdate.stock_quantity = parseInt(stock_quantity, 10);
    if (condition_type !== undefined) fieldsToUpdate.condition_type = condition_type;
    if (status !== undefined) fieldsToUpdate.status = status;
    if (model_name !== undefined) fieldsToUpdate.model_name = model_name;
    if (barcode_number !== undefined) fieldsToUpdate.barcode_number = barcode_number;

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

    await partModel.updatePart(partId, fieldsToUpdate);

    const updatedPart = await partModel.getPartById(partId);

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
    const vendor = await vendorModel.findVendorByUserId(userId);
    if (!vendor) {
      res.status(404);
      throw new Error('Vendor profile not found');
    }

    const partId = req.params.id;
    const part = await partModel.getPartById(partId);

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

    await partModel.deletePart(partId);

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
    const part = await partModel.getPartPublic(partId);

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
