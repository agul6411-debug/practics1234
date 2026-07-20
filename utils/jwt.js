const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_987654';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generates a signed JSON Web Token (JWT) with the given payload.
 * @param {object} payload - The token payload (e.g. { id, role })
 * @returns {string} The signed token string
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies a JSON Web Token (JWT).
 * @param {string} token - The signed token string
 * @returns {object} The decoded token payload
 * @throws {Error} If verification fails (e.g. token expired, invalid secret)
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken
};
