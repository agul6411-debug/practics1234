const express = require('express');
const { getPartDetails } = require('../controllers/partController');
const { searchParts } = require('../controllers/searchController');

const router = express.Router();

// Public Routes: Search parts (OLX-style catalog) & Fetch part details
router.get('/search', searchParts);
router.get('/:id', getPartDetails);

module.exports = router;
