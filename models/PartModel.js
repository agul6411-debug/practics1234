const pool = require('../db');

class PartModel {
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM parts WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByBarcode(barcodeNumber, excludeId = null) {
    if (!barcodeNumber) return null;
    let query = 'SELECT id FROM parts WHERE LOWER(TRIM(barcode_number)) = LOWER(TRIM(?))';
    const values = [barcodeNumber];

    if (excludeId) {
      query += ' AND id != ?';
      values.push(excludeId);
    }

    const [rows] = await pool.execute(query, values);
    return rows[0] || null;
  }

  static async findOtherPartByBarcode(barcodeNumber, excludeId = null) {
    if (!barcodeNumber) return null;
    let query = `
      SELECT p.id, p.model_name, v.shop_name
      FROM parts p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE LOWER(TRIM(p.barcode_number)) = LOWER(TRIM(?))
    `;
    const values = [barcodeNumber];

    if (excludeId) {
      query += ' AND p.id != ?';
      values.push(excludeId);
    }

    const [rows] = await pool.execute(query, values);
    return rows[0] || null;
  }

  static async create({
    vendorId,
    brandId,
    partTypeId,
    modelName,
    price,
    conditionType,
    stockQuantity = 1,
    imageUrl,
    barcodeNumber,
    originalPhotoUrl,
    barcodePhotoUrl
  }) {
    const [result] = await pool.execute(
      `INSERT INTO parts (vendor_id, brand_id, part_type_id, model_name, price, condition_type, stock_quantity, image_url, barcode_number, original_photo_url, barcode_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendorId,
        parseInt(brandId, 10),
        parseInt(partTypeId, 10),
        modelName,
        parseFloat(price),
        conditionType,
        stockQuantity !== undefined ? parseInt(stockQuantity, 10) : 1,
        imageUrl || originalPhotoUrl,
        barcodeNumber,
        originalPhotoUrl,
        barcodePhotoUrl
      ]
    );
    return this.findById(result.insertId);
  }

  static async findByVendorId(vendorId) {
    const [rows] = await pool.execute(
      `SELECT p.*, b.name as brand_name, pt.name as part_type_name
       FROM parts p
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN part_types pt ON p.part_type_id = pt.id
       WHERE p.vendor_id = ? AND p.status = 'available'
       ORDER BY p.created_at DESC`,
      [vendorId]
    );
    return rows;
  }

  static async update(id, fields = {}) {
    const allowedFields = [
      'price',
      'stock_quantity',
      'condition_type',
      'status',
      'image_url',
      'model_name',
      'barcode_number',
      'original_photo_url',
      'barcode_photo_url'
    ];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(fields[field]);
      }
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE parts SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    return this.findById(id);
  }

  static async delete(id) {
    try {
      const [result] = await pool.execute('DELETE FROM parts WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
        await pool.execute("UPDATE parts SET status = 'out_of_stock', stock_quantity = 0 WHERE id = ?", [id]);
        return true;
      }
      throw err;
    }
  }

  static async markOutOfStock(id) {
    await pool.execute(
      "UPDATE parts SET status = 'out_of_stock', stock_quantity = 0 WHERE id = ?",
      [id]
    );
  }

  static async decrementStock(id, newStock, newStatus) {
    await pool.execute(
      'UPDATE parts SET stock_quantity = ?, status = ? WHERE id = ?',
      [newStock, newStatus, id]
    );
  }

  static async restoreStock(id) {
    await pool.execute(
      `UPDATE parts 
       SET stock_quantity = stock_quantity + 1, status = IF(status = 'out_of_stock', 'available', status) 
       WHERE id = ?`,
      [id]
    );
  }

  static async findDetailsWithVendor(partId) {
    const [rows] = await pool.execute(
      `SELECT 
        p.*,
        b.name as brand_name,
        pt.name as part_type_name,
        v.user_id as vendor_user_id, v.shop_name, v.city as vendor_city, v.address as vendor_address,
        COALESCE(ROUND(AVG(rv.rating), 1), 0) as average_rating,
        COUNT(rv.id) as review_count
      FROM parts p
      JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN part_types pt ON p.part_type_id = pt.id
      LEFT JOIN reviews rv ON rv.vendor_id = v.id
      WHERE p.id = ?
      GROUP BY p.id, b.id, pt.id, v.id`,
      [partId]
    );
    return rows[0] || null;
  }

  static async search({ brandId, partTypeId, model, city }) {
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
      GROUP BY p.id, b.id, pt.id, v.id
      ORDER BY p.created_at DESC
    `;

    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async countAll() {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM parts');
    return rows[0].count;
  }
}

module.exports = PartModel;
