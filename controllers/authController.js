const pool = require('../db');
const { hashPassword, comparePassword, generateToken } = require('../utils');
const { sendOtpEmail } = require('../utils/emailService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generate6DigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Helper to validate user fields for registration
 */
function validateRegistration(res, { name, email, password }) {
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Required fields missing: name, email, password');
  }
  if (!EMAIL_REGEX.test(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters long');
  }
}

/**
 * Register a Customer
 */
async function registerCustomer(req, res, next) {
  try {
    const { name, email, password, phone, city } = req.body;

    validateRegistration(res, { name, email, password });
    if (!city) {
      res.status(400);
      throw new Error('City is required for customers');
    }

    // Check if email already exists
    const [existingUserRows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUserRows.length > 0) {
      res.status(409); // Conflict
      throw new Error('Email address already registered');
    }

    const otp = generate6DigitOtp();
    const hashedPassword = await hashPassword(password);
    const [userResult] = await pool.execute(
      `INSERT INTO users (name, email, password, phone, role, is_email_verified, email_otp, otp_expires_at) 
       VALUES (?, ?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [name, email, hashedPassword, phone || null, 'customer', otp]
    );
    const userId = userResult.insertId;

    // Create customer profile
    await pool.execute('INSERT INTO customers (user_id, city) VALUES (?, ?)', [userId, city]);

    // Send OTP via Mailtrap
    try {
      await sendOtpEmail(email, otp);
    } catch (mailErr) {
      console.error('Gmail OTP Send Failed:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      requires_email_verification: true,
      email: email,
      message: 'Customer registered! An OTP code has been sent to your email for verification.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Register a Vendor
 */
async function registerVendor(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      phone,
      shop_name,
      verification_docs,
      city,
      address,
      latitude,
      longitude
    } = req.body;

    validateRegistration(res, { name, email, password });
    if (!shop_name || !city || !address) {
      res.status(400);
      throw new Error('Required vendor fields missing: shop_name, city, address');
    }

    // Check if email already exists
    const [existingUserRows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUserRows.length > 0) {
      res.status(409);
      throw new Error('Email address already registered');
    }

    // Handle shopPhoto and cnicPhoto file uploads
    let shopPhotoUrl = null;
    let cnicPhotoUrl = null;

    if (req.files) {
      if (req.files.shopPhoto && req.files.shopPhoto[0]) {
        shopPhotoUrl = `/uploads/parts/${req.files.shopPhoto[0].filename}`;
      }
      if (req.files.cnicPhoto && req.files.cnicPhoto[0]) {
        cnicPhotoUrl = `/uploads/parts/${req.files.cnicPhoto[0].filename}`;
      }
    }

    const otp = generate6DigitOtp();
    const hashedPassword = await hashPassword(password);
    const [userResult] = await pool.execute(
      `INSERT INTO users (name, email, password, phone, role, is_email_verified, email_otp, otp_expires_at) 
       VALUES (?, ?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [name, email, hashedPassword, phone || null, 'vendor', otp]
    );
    const userId = userResult.insertId;

    // Create vendor profile with shop photo and CNIC photo
    await pool.execute(
      `INSERT INTO vendors (user_id, shop_name, verification_docs, shop_photo_url, cnic_photo_url, city, address, latitude, longitude, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        shop_name,
        verification_docs || shopPhotoUrl || null,
        shopPhotoUrl,
        cnicPhotoUrl,
        city,
        address,
        latitude !== undefined && latitude !== null ? latitude : null,
        longitude !== undefined && longitude !== null ? longitude : null
      ]
    );

    // Create initial Security Deposit notification
    try {
      await pool.execute(
        `INSERT INTO notifications (user_id, message, type, is_read)
         VALUES (?, '⚠️ SECURITY DEPOSIT REQUIRED: Please pay Rs. 500 refundable deposit via JazzCash/EasyPaisa (+92 311 7595866) to respond to customer part requests.', 'system', 0)`,
        [userId]
      );
    } catch (notifErr) {
      console.error('Notification creation failed for vendor deposit:', notifErr.message);
    }

    // Send OTP via Mailtrap
    try {
      await sendOtpEmail(email, otp);
    } catch (mailErr) {
      console.error('Gmail OTP Send Failed:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      requires_email_verification: true,
      email: email,
      message: 'Vendor registered! An OTP code has been sent to your email for verification.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resends / Sends a 6-digit Email Verification OTP
 */
async function sendOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400);
      throw new Error('Email is required');
    }

    const [userRows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (userRows.length === 0) {
      res.status(404);
      throw new Error('No account found with this email address');
    }

    const otp = generate6DigitOtp();
    await pool.execute(
      'UPDATE users SET email_otp = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ?',
      [otp, email]
    );

    await sendOtpEmail(email, otp);

    res.json({
      success: true,
      message: `Verification OTP code sent to ${email}`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verifies submitted Email OTP code
 */
async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400);
      throw new Error('Email and OTP code are required');
    }

    const [userRows] = await pool.execute(
      `SELECT * FROM users 
       WHERE email = ? AND email_otp = ? AND (otp_expires_at IS NULL OR otp_expires_at > NOW())`,
      [email, otp.trim()]
    );

    if (userRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: '🚨 Invalid or expired OTP code. Please request a new OTP.'
      });
    }

    const user = userRows[0];
    await pool.execute(
      'UPDATE users SET is_email_verified = 1, email_otp = NULL, otp_expires_at = NULL WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      message: '✅ Email address verified successfully! You can now login.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login User
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required');
    }

    // Search user by email
    const [userRows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = userRows[0] || null;
    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // Compare passwords
    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // Check user block status
    if (user.status === 'blocked') {
      res.status(403);
      throw new Error('Your account is blocked. Please contact an administrator.');
    }

    // Check Email OTP Verification status
    if (user.is_email_verified == 0 || user.is_email_verified == false) {
      const otp = generate6DigitOtp();
      await pool.execute(
        'UPDATE users SET email_otp = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
        [otp, user.id]
      );
      try {
        await sendOtpEmail(user.email, otp);
      } catch (mailErr) {
        console.error('Gmail OTP Send Failed on login:', mailErr.message);
      }

      return res.status(403).json({
        success: false,
        requires_email_verification: true,
        email: user.email,
        message: '🚨 Email address not verified yet! A new 6-digit OTP code has been sent to your email.'
      });
    }

    // Load respective profile info
    let profile = {};
    if (user.role === 'customer') {
      const [custRows] = await pool.execute('SELECT * FROM customers WHERE user_id = ?', [user.id]);
      const customerProfile = custRows[0] || null;
      if (customerProfile) {
        profile = {
          customer_id: customerProfile.id,
          city: customerProfile.city
        };
      }
    } else if (user.role === 'vendor') {
      const [vendRows] = await pool.execute('SELECT * FROM vendors WHERE user_id = ?', [user.id]);
      const vendorProfile = vendRows[0] || null;
      if (vendorProfile) {
        profile = {
          vendor_id: vendorProfile.id,
          shop_name: vendorProfile.shop_name,
          verification_docs: vendorProfile.verification_docs,
          shop_photo_url: vendorProfile.shop_photo_url || null,
          cnic_photo_url: vendorProfile.cnic_photo_url || null,
          city: vendorProfile.city,
          address: vendorProfile.address,
          latitude: vendorProfile.latitude,
          longitude: vendorProfile.longitude,
          verification_status: vendorProfile.verification_status,
          security_deposit_status: vendorProfile.security_deposit_status || 'unpaid',
          security_deposit_amount: vendorProfile.security_deposit_amount || 500.00,
          security_deposit_proof: vendorProfile.security_deposit_proof || null,
          created_at: vendorProfile.created_at
        };
      }
    }

    // Generate JWT token
    const token = generateToken({ id: user.id, role: user.role });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        ...profile
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Request Password Reset OTP
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || !EMAIL_REGEX.test(email.trim())) {
      res.status(400);
      throw new Error('Valid email address is required');
    }

    const [userRows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (userRows.length === 0) {
      res.status(404);
      throw new Error('No account found with this email address');
    }

    const otp = generate6DigitOtp();
    await pool.execute(
      'UPDATE users SET email_otp = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ?',
      [otp, email.trim()]
    );

    try {
      await sendOtpEmail(email.trim(), otp);
    } catch (mailErr) {
      console.error('Gmail Reset Password OTP Send Failed:', mailErr.message);
    }

    res.json({
      success: true,
      message: `Password reset OTP code has been sent to ${email.trim()}`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset Password with OTP Code
 */
async function resetPassword(req, res, next) {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      res.status(400);
      throw new Error('Required fields missing: email, otp, new_password');
    }

    if (new_password.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters long');
    }

    const [userRows] = await pool.execute(
      `SELECT * FROM users 
       WHERE email = ? AND email_otp = ? AND (otp_expires_at IS NULL OR otp_expires_at > NOW())`,
      [email.trim(), otp.trim()]
    );

    if (userRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: '🚨 Invalid or expired OTP code. Please request a new password reset.'
      });
    }

    const user = userRows[0];
    const hashedPassword = await hashPassword(new_password);

    await pool.execute(
      `UPDATE users 
       SET password = ?, is_email_verified = 1, email_otp = NULL, otp_expires_at = NULL 
       WHERE id = ?`,
      [hashedPassword, user.id]
    );

    res.json({
      success: true,
      message: '✅ Password reset successfully! You can now login with your new password.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registerCustomer,
  registerVendor,
  sendOtp,
  verifyOtp,
  login,
  forgotPassword,
  resetPassword
};
