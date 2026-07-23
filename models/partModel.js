const pool = require('../config/db');

/**
 * Inserts a new part into the parts table.
 * @param {object} partData
 * @returns {Promise<number>} The inserted part ID
 */
async function createPart({
  vendor_id,
  brand_id,
  part_type_id,
  model_name,
  price,
  condition_type,
  stock_quantity,
  image_url,
  barcode_number,
  original_photo_url,
  barcode_photo_url
}) {
  const query = `
    INSERT INTO parts (vendor_id, brand_id, part_type_id, model_name, price, condition_type, stock_quantity, image_url, barcode_number, original_photo_url, barcode_photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(query, [
    vendor_id,
    brand_id,
    part_type_id,
    model_name,
    price,
    condition_type,
    stock_quantity !== undefined ? stock_quantity : 1,
    image_url || null,
    barcode_number || null,
    original_photo_url || null,
    barcode_photo_url || null
  ]);
  return result.insertId;
}


/**
 * Retrieves all parts owned by a specific vendor.
 * @param {number} vendor_id
 * @returns {Promise<Array>} List of parts with brand and part type names
 */
async function getPartsByVendor(vendor_id) {
  const query = `
    SELECT p.*, b.name as brand_name, pt.name as part_type_name
    FROM parts p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN part_types pt ON p.part_type_id = pt.id
    WHERE p.vendor_id = ? AND p.status = 'available'
    ORDER BY p.created_at DESC
  `;
  const [rows] = await pool.execute(query, [vendor_id]);
  return rows;
}

/**
 * Retrieves a single part by ID.
 * @param {number} partId
 * @returns {Promise<object|null>} The part record, or null if not found
 */
async function getPartById(partId) {
  const query = 'SELECT * FROM parts WHERE id = ?';
  const [rows] = await pool.execute(query, [partId]);
  return rows[0] || null;
}

/**
 * Updates specific fields of a part.
 * @param {number} partId
 * @param {object} fields
 * @returns {Promise<boolean>} True if updated, false if no fields updated
 */
async function updatePart(partId, fields) {
  const allowedFields = ['price', 'stock_quantity', 'condition_type', 'status', 'image_url', 'model_name', 'barcode_number', 'original_photo_url', 'barcode_photo_url'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(fields[field]);
    }
  }

  if (updates.length === 0) return false;

  values.push(partId);
  const query = `UPDATE parts SET ${updates.join(', ')} WHERE id = ?`;
  await pool.execute(query, values);
  return true;
}

/**
 * Deletes a part by ID or marks it as out of stock if referenced by existing requests.
 * @param {number} partId
 */
async function deletePart(partId) {
  try {
    const query = 'DELETE FROM parts WHERE id = ?';
    await pool.execute(query, [partId]);
    return { deleted: true };
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      const softDeleteQuery = "UPDATE parts SET status = 'out_of_stock', stock_quantity = 0 WHERE id = ?";
      await pool.execute(softDeleteQuery, [partId]);
      return { deleted: false, softDeleted: true };
    }
    throw err;
  }
}

/**
 * Retrieves a single part by ID joined with vendor shop details.
 * @param {number} partId
 * @returns {Promise<object|null>} The part and vendor details
 */
async function getPartPublic(partId) {
  const query = `
    SELECT 
      p.*,
      b.name as brand_name,
      pt.name as part_type_name,
      v.user_id as vendor_user_id, v.shop_name, v.city as vendor_city, v.address as vendor_address
    FROM parts p
    JOIN vendors v ON p.vendor_id = v.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN part_types pt ON p.part_type_id = pt.id
    WHERE p.id = ?
  `;
  const [rows] = await pool.execute(query, [partId]);
  return rows[0] || null;
}

module.exports = {
  createPart,
  getPartsByVendor,
  getPartById,
  updatePart,
  deletePart,
  getPartPublic
};
