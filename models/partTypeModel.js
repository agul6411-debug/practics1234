const pool = require('../config/db');

/**
 * Retrieves all part types from the part_types table.
 */
async function getAllPartTypes() {
  const query = 'SELECT * FROM part_types ORDER BY name ASC';
  const [rows] = await pool.execute(query);
  return rows;
}

/**
 * Creates a new part type.
 */
async function createPartType(name) {
  const query = 'INSERT INTO part_types (name) VALUES (?)';
  const [result] = await pool.execute(query, [name]);
  return result.insertId;
}

/**
 * Updates an existing part type's name.
 */
async function updatePartType(id, name) {
  const query = 'UPDATE part_types SET name = ? WHERE id = ?';
  await pool.execute(query, [name, id]);
}

/**
 * Deletes a part type by ID.
 */
async function deletePartType(id) {
  const query = 'DELETE FROM part_types WHERE id = ?';
  await pool.execute(query, [id]);
}

module.exports = {
  getAllPartTypes,
  createPartType,
  updatePartType,
  deletePartType
};
