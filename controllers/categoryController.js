const brandModel = require('../models/brandModel');
const partTypeModel = require('../models/partTypeModel');

/**
 * Public controller to get all brands.
 */
async function getBrands(req, res, next) {
  try {
    const brands = await brandModel.getAllBrands();
    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public controller to get all part types.
 */
async function getPartTypes(req, res, next) {
  try {
    const partTypes = await partTypeModel.getAllPartTypes();
    res.json({
      success: true,
      data: partTypes
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to add a brand.
 */
async function addBrand(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || name.trim().isEmpty) {
      res.status(400);
      throw new Error('Brand name is required');
    }

    const brandId = await brandModel.createBrand(name.trim());
    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: { id: brandId, name: name.trim() }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to update a brand.
 */
async function updateBrand(req, res, next) {
  try {
    const brandId = req.params.id;
    const { name } = req.body;
    if (!name || name.trim().isEmpty) {
      res.status(400);
      throw new Error('Brand name is required');
    }

    await brandModel.updateBrand(brandId, name.trim());
    res.json({
      success: true,
      message: 'Brand updated successfully',
      data: { id: parseInt(brandId, 10), name: name.trim() }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to delete a brand.
 */
async function deleteBrand(req, res, next) {
  try {
    const brandId = req.params.id;
    await brandModel.deleteBrand(brandId);
    res.json({
      success: true,
      message: 'Brand deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to add a part type.
 */
async function addPartType(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || name.trim().isEmpty) {
      res.status(400);
      throw new Error('Part type name is required');
    }

    const partTypeId = await partTypeModel.createPartType(name.trim());
    res.status(201).json({
      success: true,
      message: 'Part type created successfully',
      data: { id: partTypeId, name: name.trim() }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to update a part type.
 */
async function updatePartType(req, res, next) {
  try {
    const partTypeId = req.params.id;
    const { name } = req.body;
    if (!name || name.trim().isEmpty) {
      res.status(400);
      throw new Error('Part type name is required');
    }

    await partTypeModel.updatePartType(partTypeId, name.trim());
    res.json({
      success: true,
      message: 'Part type updated successfully',
      data: { id: parseInt(partTypeId, 10), name: name.trim() }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin controller to delete a part type.
 */
async function deletePartType(req, res, next) {
  try {
    const partTypeId = req.params.id;
    await partTypeModel.deletePartType(partTypeId);
    res.json({
      success: true,
      message: 'Part type deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBrands,
  getPartTypes,
  addBrand,
  updateBrand,
  deleteBrand,
  addPartType,
  updatePartType,
  deletePartType
};
