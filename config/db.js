/**
 * Database Configuration
 * Configures and exports a MySQL connection pool using the mysql2/promise client.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool configuration using environment variables
const poolConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'phone_parts_finder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create the promise-based connection pool
const pool = mysql.createPool(poolConfig);

// Export the pool for use in models and during server startup check
module.exports = pool;
