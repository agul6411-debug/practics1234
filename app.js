/**
 * Express Application Configuration
 * Sets up middleware, base routes, health-check routes, and global error handling.
 */

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const partRoutes = require('./routes/partRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const customerRoutes = require('./routes/customerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Base Route
app.get('/', (req, res) => {
  res.json({ message: "Phone Parts Finder API is running" });
});

// Authentication Routes
app.use('/api/auth', authRoutes);

// Vendor, Parts, Category, Customer, Admin, Notification & Report Routes
app.use('/api/vendor', vendorRoutes);
app.use('/api/parts', partRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

// Health-Check Route
app.get('/api/health', async (req, res) => {
  try {
    // Perform a simple query to verify database connectivity
    await pool.query('SELECT 1');
    res.json({
      status: "ok",
      db: "connected"
    });
  } catch (error) {
    console.error('Database connection test failed in health check:', error.message);
    res.status(500).json({
      status: "error",
      db: "disconnected"
    });
  }
});

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
