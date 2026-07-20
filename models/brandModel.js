const pool = require('../config/db');

/**
 * Retrieves all brands from the brands table.
 */
async function getAllBrands() {
  const query = 'SELECT * FROM brands ORDER BY name ASC';
  const [rows] = await pool.execute(query);
  return rows;
}

/**
 * Creates a new brand.
 */
async function createBrand(name) {
  const query = 'INSERT INTO brands (name) VALUES (?)';
  const [result] = await pool.execute(query, [name]);
  return result.insertId;
}

/**
 * Updates an existing brand's name.
 */
async function updateBrand(id, name) {
  const query = 'UPDATE brands SET name = ? WHERE id = ?';
  await pool.execute(query, [name, id]);
}

/**
 * Deletes a brand by ID.
 */
async function deleteBrand(id) {
  const query = 'DELETE FROM brands WHERE id = ?';
  await pool.execute(query, [id]);
}

module.exports = {
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand
};
