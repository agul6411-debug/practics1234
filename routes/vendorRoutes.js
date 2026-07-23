const express = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { getMyProfile, updateMyProfile } = require('../controllers/vendorController');
const {
  addPart,
  getMyParts,
  updatePart,
  deletePart
} = require('../controllers/partController');
const { getVendorRequests, respondToRequest } = require('../controllers/requestController');
const { uploadProof, getMyCommissions } = require('../controllers/commissionController');

const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Apply auth and vendor role checks across vendor endpoints
router.use(verifyToken, authorizeRoles('vendor'));

// Vendor Profile Routes
router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);

// Vendor Parts Management Routes
router.post('/parts', upload.fields([{ name: 'originalPhoto', maxCount: 1 }, { name: 'barcodePhoto', maxCount: 1 }]), addPart);
router.get('/parts', getMyParts);
router.put('/parts/:id', upload.fields([{ name: 'originalPhoto', maxCount: 1 }, { name: 'barcodePhoto', maxCount: 1 }]), updatePart);
router.delete('/parts/:id', deletePart);

// Vendor Request & Lead Routes
router.get('/requests', getVendorRequests);
router.put('/requests/:id/respond', respondToRequest);

// Vendor Commission Routes
router.get('/commissions', getMyCommissions);
router.post('/commissions/:id/proof', uploadProof);

module.exports = router;
