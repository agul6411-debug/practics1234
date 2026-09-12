const PartModel = require('../models/PartModel');

/**
 * Searches parts matching filters, falling back to other cities if no local results found.
 */
async function searchParts(req, res, next) {
  try {
    const { brandId, partTypeId, model, city } = req.query;

    // 1. Initial search (with city filter if provided)
    let results = await PartModel.search({ brandId, partTypeId, model, city });
    let fallback = false;
    let message = 'Parts retrieved successfully';

    // 2. City Fallback: if city was specified but yielded no results, search without city filter
    if (city && results.length === 0) {
      results = await PartModel.search({ brandId, partTypeId, model, city: null });
      fallback = true;
      message = 'No parts found in your city, showing results from other locations';
    }

    res.json({
      success: true,
      fallback,
      message,
      count: results.length,
      data: results
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  searchParts
};
