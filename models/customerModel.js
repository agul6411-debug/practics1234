const pool = require('../config/db');

/**
 * Creates a new customer profile in the customers table.
 * @param {object} customerData
 * @param {number} customerData.user_id
 * @param {string} customerData.city
 * @returns {Promise<number>} The inserted customer record's ID
 */
async function createCustomerProfile({ user_id, city }) {
  const query = `
    INSERT INTO customers (user_id, city)
    VALUES (?, ?)
  `;
  const [result] = await pool.execute(query, [user_id, city]);
  return result.insertId;
}

/**
 * Finds a customer profile by user ID.
 * @param {number} user_id
 * @returns {Promise<object|null>} The customer record, or null if not found
 */
async function findCustomerByUserId(user_id) {
  const query = 'SELECT * FROM customers WHERE user_id = ?';
  const [rows] = await pool.execute(query, [user_id]);
  return rows[0] || null;
}

/**
 * Updates a customer profile city by user ID.
 */
async function updateCustomerProfileByUserId(user_id, { city }) {
  const query = 'UPDATE customers SET city = ? WHERE user_id = ?';
  await pool.execute(query, [city, user_id]);
}

/**
 * Retrieves a customer profile by customer ID.
 */
async function getCustomerById(customerId) {
  const query = 'SELECT * FROM customers WHERE id = ?';
  const [rows] = await pool.execute(query, [customerId]);
  return rows[0] || null;
}

module.exports = {
  createCustomerProfile,
  findCustomerByUserId,
  updateCustomerProfileByUserId,
  getCustomerById
};
