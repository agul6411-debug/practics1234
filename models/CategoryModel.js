const pool = require('../db');

class CategoryModel {
  static async getAllBrands() {
    const [rows] = await pool.execute('SELECT * FROM brands ORDER BY name ASC');
    return rows;
  }

  static async createBrand(name) {
    const [result] = await pool.execute('INSERT INTO brands (name) VALUES (?)', [name]);
    return { id: result.insertId, name };
  }

  static async updateBrand(id, name) {
    await pool.execute('UPDATE brands SET name = ? WHERE id = ?', [name, id]);
    return { id: parseInt(id, 10), name };
  }

  static async deleteBrand(id) {
    const [result] = await pool.execute('DELETE FROM brands WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getAllPartTypes() {
    const [rows] = await pool.execute('SELECT * FROM part_types ORDER BY name ASC');
    return rows;
  }

  static async createPartType(name) {
    const [result] = await pool.execute('INSERT INTO part_types (name) VALUES (?)', [name]);
    return { id: result.insertId, name };
  }

  static async updatePartType(id, name) {
    await pool.execute('UPDATE part_types SET name = ? WHERE id = ?', [name, id]);
    return { id: parseInt(id, 10), name };
  }

  static async deletePartType(id) {
    const [result] = await pool.execute('DELETE FROM part_types WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = CategoryModel;
