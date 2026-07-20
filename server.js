/**
 * Server Entry Point
 * Tests database connection, starts the Express server, and listens on the configured port.
 */

require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 3000;

// Test the DB connection on startup and start the Express server
async function startServer() {
  try {
    // Perform simple SELECT 1 query to test the connection pool
    await pool.query('SELECT 1');
    console.log('Database connected successfully.');

    // Start listening on the specified PORT
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
    });
  } catch (error) {
    console.error('Database connection failed. Server startup aborted.');
    console.error(error);
    process.exit(1); // Exit process on database connection failure
  }
}

startServer();
