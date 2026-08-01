const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_987654';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Hashes a plain text password using bcrypt.
 */
async function hashPassword(plain) {
  return await bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compares a plain text password with a hashed password.
 */
async function comparePassword(plain, hashed) {
  return await bcrypt.compare(plain, hashed);
}

/**
 * Generates a signed JSON Web Token (JWT) with the given payload.
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies a JSON Web Token (JWT).
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken
};
