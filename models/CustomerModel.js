const pool = require('../db');

class CustomerModel {
  static async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM customers WHERE user_id = ?', [userId]);
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create({ userId, city }) {
    const [result] = await pool.execute(
      'INSERT INTO customers (user_id, city) VALUES (?, ?)',
      [userId, city]
    );
    return result.insertId;
  }

  static async findOrCreate(userId, defaultCity = 'City') {
    let customer = await this.findByUserId(userId);
    if (!customer) {
      const insertId = await this.create({ userId, city: defaultCity });
      customer = { id: insertId, user_id: userId, city: defaultCity };
    }
    return customer;
  }

  static async updateCity(userId, city) {
    await pool.execute('UPDATE customers SET city = ? WHERE user_id = ?', [city, userId]);
    return this.findByUserId(userId);
  }

  static async countAll() {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM customers');
    return rows[0].count;
  }
}

module.exports = CustomerModel;
