const crypto = require('crypto');

/**
 * Generates an HMAC-SHA256 tamper-proof hex token for a part.
 * @param {number|string} partId - The ID of the part
 * @returns {string} The generated hex QR token string
 */
function generateQrToken(partId) {
  const secret = process.env.QR_SECRET || 'default_qr_secret_key_12345';
  const randomValue = crypto.randomBytes(8).toString('hex');
  const payload = `${partId}_${Date.now()}_${randomValue}`;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

module.exports = {
  generateQrToken
};
