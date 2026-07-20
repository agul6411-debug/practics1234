const partModel = require('../models/partModel');
const vendorModel = require('../models/vendorModel');
const { generateQrToken } = require('../utils/qrToken');

/**
 * Add a new part (Vendor only)
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

    const { brand_id, part_type_id, model_name, price, condition_type, stock_quantity, image_url } = req.body;

    if (!brand_id || !part_type_id || !model_name || !price || !condition_type) {
      res.status(400);
      throw new Error('Required fields missing: brand_id, part_type_id, model_name, price, condition_type');
    }

    const partId = await partModel.createPart({
      vendor_id: vendor.id,
      brand_id,
      part_type_id,
      model_name,
      price,
      condition_type,
      stock_quantity: stock_quantity !== undefined ? stock_quantity : 1,
      image_url
    });

    // Generate tamper-proof QR token and store it
    const qrToken = generateQrToken(partId);
    await partModel.setQrToken(partId, qrToken);

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

    const { price, stock_quantity, condition_type, status, image_url, model_name } = req.body;

    await partModel.updatePart(partId, {
      price,
      stock_quantity,
      condition_type,
      status,
      image_url,
      model_name
    });

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
 * Public endpoint to verify part authenticity by scanning QR token
 */
async function verifyPartByToken(req, res, next) {
  try {
    const token = req.params.token;
    if (!token) {
      res.status(400);
      throw new Error('QR token parameter is required');
    }

    const result = await partModel.findByQrToken(token);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or fake QR code'
      });
    }

    res.json({
      success: true,
      data: {
        part: {
          id: result.id,
          model_name: result.model_name,
          brand_name: result.brand_name,
          part_type_name: result.part_type_name,
          price: result.price,
          condition_type: result.condition_type,
          stock_quantity: result.stock_quantity,
          image_url: result.image_url,
          qr_token: result.qr_token,
          status: result.status,
          created_at: result.created_at
        },
        vendor: {
          id: result.vendor_id,
          shop_name: result.shop_name,
          city: result.vendor_city,
          address: result.vendor_address
        }
      }
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
  verifyPartByToken
};
