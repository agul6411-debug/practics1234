/**
 * Global Error Handling Middleware
 * Catches all errors thrown in routes or controllers, logs them to the console,
 * and returns a standardized JSON response.
 */
function errorHandler(err, req, res, next) {
  // Log the stack trace for debugging
  console.error('Error caught by global handler:', err);

  // Set response status code (default to 500 internal server error)
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected server error occurred'
  });
}

module.exports = errorHandler;
