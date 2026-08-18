const pool = require('../db');

async function migrateEmailOtp() {
  try {
    console.log('Running Email OTP verification migration...');

    // Add is_email_verified, email_otp, otp_expires_at columns to users table
    const userColumns = [
      "ALTER TABLE users ADD COLUMN is_email_verified TINYINT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN email_otp VARCHAR(10) DEFAULT NULL",
      "ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP NULL DEFAULT NULL"
    ];

    for (const queryStr of userColumns) {
      try {
        await pool.query(queryStr);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) {
          console.warn('Warning updating users schema:', err.message);
        }
      }
    }

    // Default existing admin and test users to verified
    await pool.query("UPDATE users SET is_email_verified = 1 WHERE is_email_verified IS NULL OR is_email_verified = 0");
    console.log('Updated existing users as email verified.');

    console.log('Email OTP Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateEmailOtp();
