const express = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getBrands,
  getPartTypes,
  addBrand,
  updateBrand,
  deleteBrand,
  addPartType,
  updatePartType,
  deletePartType
} = require('../controllers/categoryController');

const router = express.Router();

// Public routes for fetching dropdown data
router.get('/brands', getBrands);
router.get('/part-types', getPartTypes);

// Admin-only category management routes
router.post('/brands', verifyToken, authorizeRoles('admin'), addBrand);
router.put('/brands/:id', verifyToken, authorizeRoles('admin'), updateBrand);
router.delete('/brands/:id', verifyToken, authorizeRoles('admin'), deleteBrand);

router.post('/part-types', verifyToken, authorizeRoles('admin'), addPartType);
router.put('/part-types/:id', verifyToken, authorizeRoles('admin'), updatePartType);
router.delete('/part-types/:id', verifyToken, authorizeRoles('admin'), deletePartType);

module.exports = router;
