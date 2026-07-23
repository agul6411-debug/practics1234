const pool = require('../config/db');

/**
 * Executes parts search with optional filters and vendor details aggregation.
 */
async function executeSearch({ brandId, partTypeId, model, city }) {
  const conditions = ["v.verification_status = 'approved'", "p.status = 'available'"];
  const values = [];

  if (brandId) {
    conditions.push('p.brand_id = ?');
    values.push(brandId);
  }

  if (partTypeId) {
    conditions.push('p.part_type_id = ?');
    values.push(partTypeId);
  }

  if (model) {
    conditions.push('p.model_name LIKE ?');
    values.push(`%${model}%`);
  }

  if (city) {
    conditions.push('v.city = ?');
    values.push(city);
  }

  const query = `
    SELECT 
      p.id, p.model_name, p.price, p.condition_type, p.stock_quantity, p.image_url, p.original_photo_url, p.barcode_photo_url, p.barcode_number, p.status, p.created_at,
      b.id as brand_id, b.name as brand_name,
      pt.id as part_type_id, pt.name as part_type_name,
      v.id as vendor_id, v.shop_name, v.city as vendor_city, v.address as vendor_address, v.latitude, v.longitude,
      COALESCE(ROUND(AVG(rv.rating), 1), 0) as average_rating,
      COUNT(rv.id) as review_count
    FROM parts p
    JOIN vendors v ON p.vendor_id = v.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN part_types pt ON p.part_type_id = pt.id
    LEFT JOIN reviews rv ON rv.vendor_id = v.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;

  const [rows] = await pool.execute(query, values);
  return rows;
}

/**
 * Searches parts matching filters, falling back to other cities if no local results found.
 */
async function searchParts(req, res, next) {
  try {
    const { brandId, partTypeId, model, city } = req.query;

    // 1. Initial search (with city filter if provided)
    let results = await executeSearch({ brandId, partTypeId, model, city });
    let fallback = false;
    let message = 'Parts retrieved successfully';

    // 2. City Fallback: if city was specified but yielded no results, search without city filter
    if (city && results.length === 0) {
      results = await executeSearch({ brandId, partTypeId, model, city: null });
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
