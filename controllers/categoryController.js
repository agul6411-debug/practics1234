const CategoryModel = require('../models/CategoryModel');

/**
 * Public controller to get all brands.
 */
async function getBrands(req, res, next) {
  try {
    const brands = await CategoryModel.getAllBrands();
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
    const partTypes = await CategoryModel.getAllPartTypes();
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
    if (!name || name.trim() === '') {
      res.status(400);
      throw new Error('Brand name is required');
    }

    const created = await CategoryModel.createBrand(name.trim());
    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: created
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
    if (!name || name.trim() === '') {
      res.status(400);
      throw new Error('Brand name is required');
    }

    const updated = await CategoryModel.updateBrand(brandId, name.trim());
    res.json({
      success: true,
      message: 'Brand updated successfully',
      data: updated
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
    await CategoryModel.deleteBrand(brandId);
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
    if (!name || name.trim() === '') {
      res.status(400);
      throw new Error('Part type name is required');
    }

    const created = await CategoryModel.createPartType(name.trim());
    res.status(201).json({
      success: true,
      message: 'Part type created successfully',
      data: created
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
    if (!name || name.trim() === '') {
      res.status(400);
      throw new Error('Part type name is required');
    }

    const updated = await CategoryModel.updatePartType(partTypeId, name.trim());
    res.json({
      success: true,
      message: 'Part type updated successfully',
      data: updated
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
    await CategoryModel.deletePartType(partTypeId);
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
