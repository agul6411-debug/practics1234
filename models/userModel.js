const pool = require('../config/db');

/**
 * Inserts a new user record into the users table.
 * @param {object} userData
 * @param {string} userData.name
 * @param {string} userData.email
 * @param {string} userData.password - Already hashed password
 * @param {string} [userData.phone]
 * @param {string} userData.role - 'admin', 'vendor', 'customer'
 * @returns {Promise<number>} The inserted user's ID
 */
async function createUser({ name, email, password, phone, role }) {
  const query = `
    INSERT INTO users (name, email, password, phone, role)
    VALUES (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(query, [
    name,
    email,
    password,
    phone || null,
    role
  ]);
  return result.insertId;
}

/**
 * Finds a user by their email address.
 * @param {string} email
 * @returns {Promise<object|null>} The user record, or null if not found
 */
async function findUserByEmail(email) {
  const query = 'SELECT * FROM users WHERE email = ?';
  const [rows] = await pool.execute(query, [email]);
  return rows[0] || null;
}

/**
 * Finds a user by their ID.
 * @param {number} id
 * @returns {Promise<object|null>} The user record, or null if not found
 */
async function findUserById(id) {
  const query = 'SELECT * FROM users WHERE id = ?';
  const [rows] = await pool.execute(query, [id]);
  return rows[0] || null;
}

/**
 * Retrieves all users, optionally filtered by role.
 */
async function getAllUsers(roleFilter) {
  let query = 'SELECT id, name, email, phone, role, status, created_at FROM users';
  const values = [];
  if (roleFilter) {
    query += ' WHERE role = ?';
    values.push(roleFilter);
  }
  query += ' ORDER BY created_at DESC';
  const [rows] = await pool.execute(query, values);
  return rows;
}

/**
 * Updates a user's status ('active' or 'blocked').
 */
async function updateUserStatus(userId, status) {
  const query = 'UPDATE users SET status = ? WHERE id = ?';
  await pool.execute(query, [status, userId]);
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  getAllUsers,
  updateUserStatus
};
