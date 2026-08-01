const pool = require('../db');

async function migrate() {
  try {
    console.log('Running security & QR verification migration...');

    // 1. Convert empty string barcode_numbers to NULL in parts table
    await pool.query("UPDATE parts SET barcode_number = NULL WHERE TRIM(barcode_number) = '' OR barcode_number = 'null'");
    console.log('Cleaned empty string barcodes to NULL.');

    // 2. Add UNIQUE constraint to barcode_number in parts table if not present
    try {
      await pool.query('ALTER TABLE parts ADD UNIQUE INDEX idx_unique_barcode (barcode_number)');
      console.log('Added unique index idx_unique_barcode to parts table.');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061) {
        console.log('Unique index idx_unique_barcode already exists.');
      } else {
        console.warn('Warning adding unique index:', err.message);
      }
    }

    // 3. Add verified_barcode & verified_at columns to requests table if not present
    try {
      await pool.query('ALTER TABLE requests ADD COLUMN verified_barcode VARCHAR(100) DEFAULT NULL');
      console.log('Added verified_barcode column to requests table.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log('Column verified_barcode already exists in requests table.');
      } else {
        throw err;
      }
    }

    try {
      await pool.query('ALTER TABLE requests ADD COLUMN verified_at TIMESTAMP NULL DEFAULT NULL');
      console.log('Added verified_at column to requests table.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log('Column verified_at already exists in requests table.');
      } else {
        throw err;
      }
    }

    console.log('Security & QR verification migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
