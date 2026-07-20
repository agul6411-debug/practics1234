const bcrypt = require('bcrypt');

// Number of salt rounds for bcrypt hashing
const SALT_ROUNDS = 10;

/**
 * Hashes a plain text password using bcrypt.
 * @param {string} plain - The plain text password
 * @returns {Promise<string>} The hashed password
 */
async function hashPassword(plain) {
  return await bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compares a plain text password with a hashed password.
 * @param {string} plain - The plain text password
 * @param {string} hashed - The hashed password
 * @returns {Promise<boolean>} True if match, false otherwise
 */
async function comparePassword(plain, hashed) {
  return await bcrypt.compare(plain, hashed);
}

module.exports = {
  hashPassword,
  comparePassword
};
