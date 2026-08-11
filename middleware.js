const { verifyToken } = require('./utils');
const multer = require('multer');
const path = require('path');

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

const fs = require('fs');

/**
 * Configure disk storage for Multer uploads
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'parts');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext || ext === '') {
      ext = '.jpg';
    }
    cb(null, uniqueSuffix + ext);
  }
});

/**
 * Validate image extensions for uploads
 */
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpe?g|png|webp|gif|bmp/i;
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ext || ext === '' || allowedExtensions.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and WEBP images are allowed.'));
  }
};

/**
 * Multer upload middleware instance (5MB file size limit)
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

/**
 * Global Error Handling Middleware
 * Catches all errors thrown in routes or controllers and returns a standardized JSON response.
 */
function errorHandler(err, req, res, next) {
  console.error('Error caught by global handler:', err);
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected server error occurred'
  });
}

module.exports = {
  verifyToken: verifyTokenMiddleware,
  authorizeRoles,
  upload,
  errorHandler
};
