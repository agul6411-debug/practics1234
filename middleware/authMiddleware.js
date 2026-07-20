const { verifyToken } = require('../utils/jwt');

/**
 * Authentication Middleware
 * Validates the JWT in the Authorization header and attaches the user payload to the request object.
 */
function verifyTokenMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded; // Attach { id, role } to req.user
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
}

/**
 * Authorization Role Middleware
 * Restricts access to routes based on user role.
 * @param {...string} allowedRoles - Roles allowed to access the route
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to perform this action.'
      });
    }
    next();
  };
}

module.exports = {
  verifyToken: verifyTokenMiddleware,
  authorizeRoles
};
