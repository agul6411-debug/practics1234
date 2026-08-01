const pool = require('../db');

/**
 * Public controller to get all brands.
 */
async function getBrands(req, res, next) {
  try {
    const [brands] = await pool.execute('SELECT * FROM brands ORDER BY name ASC');
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
    const [partTypes] = await pool.execute('SELECT * FROM part_types ORDER BY name ASC');
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
    if (!name || name.trim() === "") {
      res.status(400);
      throw new Error('Brand name is required');
    }

    const [result] = await pool.execute('INSERT INTO brands (name) VALUES (?)', [name.trim()]);
    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: { id: result.insertId, name: name.trim() }
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
    if (!name || name.trim() === "") {
      res.status(400);
      throw new Error('Brand name is required');
    }

    await pool.execute('UPDATE brands SET name = ? WHERE id = ?', [name.trim(), brandId]);
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
    await pool.execute('DELETE FROM brands WHERE id = ?', [brandId]);
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
    if (!name || name.trim() === "") {
      res.status(400);
      throw new Error('Part type name is required');
    }

    const [result] = await pool.execute('INSERT INTO part_types (name) VALUES (?)', [name.trim()]);
    res.status(201).json({
      success: true,
      message: 'Part type created successfully',
      data: { id: result.insertId, name: name.trim() }
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
    if (!name || name.trim() === "") {
      res.status(400);
      throw new Error('Part type name is required');
    }

    await pool.execute('UPDATE part_types SET name = ? WHERE id = ?', [name.trim(), partTypeId]);
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
    await pool.execute('DELETE FROM part_types WHERE id = ?', [partTypeId]);
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
