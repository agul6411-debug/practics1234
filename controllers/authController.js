const userModel = require('../models/userModel');
const vendorModel = require('../models/vendorModel');
const customerModel = require('../models/customerModel');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateToken } = require('../utils/jwt');

// Simple email regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    // Validate fields
    validateRegistration(res, { name, email, password });
    if (!city) {
      res.status(400);
      throw new Error('City is required for customers');
    }

    // Check if email already exists
    const existingUser = await userModel.findUserByEmail(email);
    if (existingUser) {
      res.status(409); // Conflict
      throw new Error('Email address already registered');
    }

    // Hash password and create user record
    const hashedPassword = await hashPassword(password);
    const userId = await userModel.createUser({
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'customer'
    });

    // Create customer profile
    await customerModel.createCustomerProfile({
      user_id: userId,
      city
    });

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully. Please login to continue.'
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

    // Validate fields
    validateRegistration(res, { name, email, password });
    if (!shop_name || !city || !address) {
      res.status(400);
      throw new Error('Required vendor fields missing: shop_name, city, address');
    }

    // Check if email already exists
    const existingUser = await userModel.findUserByEmail(email);
    if (existingUser) {
      res.status(409);
      throw new Error('Email address already registered');
    }

    // Hash password and create user record
    const hashedPassword = await hashPassword(password);
    const userId = await userModel.createUser({
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'vendor'
    });

    // Create vendor profile
    await vendorModel.createVendorProfile({
      user_id: userId,
      shop_name,
      verification_docs,
      city,
      address,
      latitude,
      longitude
    });

    res.status(201).json({
      success: true,
      message: 'Vendor registered successfully. Please login to continue.'
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
    const user = await userModel.findUserByEmail(email);
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

    // Load respective profile info
    let profile = {};
    if (user.role === 'customer') {
      const customerProfile = await customerModel.findCustomerByUserId(user.id);
      if (customerProfile) {
        profile = {
          customer_id: customerProfile.id,
          city: customerProfile.city
        };
      }
    } else if (user.role === 'vendor') {
      const vendorProfile = await vendorModel.findVendorByUserId(user.id);
      if (vendorProfile) {
        profile = {
          vendor_id: vendorProfile.id,
          shop_name: vendorProfile.shop_name,
          verification_docs: vendorProfile.verification_docs,
          city: vendorProfile.city,
          address: vendorProfile.address,
          latitude: vendorProfile.latitude,
          longitude: vendorProfile.longitude,
          verification_status: vendorProfile.verification_status
        };
      }
    }

    // Generate JWT token
    const token = generateToken({ id: user.id, role: user.role });

    // Respond with token and user profile object
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        ...profile
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registerCustomer,
  registerVendor,
  login
};
