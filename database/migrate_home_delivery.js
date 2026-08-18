const pool = require('../db');

async function migrateHomeDelivery() {
  try {
    console.log('Running Home Delivery & Vendor Cancellation migration...');

    // 1. Add cancellation_count to vendors table
    try {
      await pool.query("ALTER TABLE vendors ADD COLUMN cancellation_count INT DEFAULT 0");
      console.log('Added cancellation_count column to vendors table.');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) {
        console.warn('Warning adding cancellation_count:', err.message);
      }
    }

    // 2. Add Home Delivery and Cancellation fields to requests table
    const requestFields = [
      "ALTER TABLE requests ADD COLUMN delivery_type VARCHAR(50) DEFAULT 'shop_pickup'",
      "ALTER TABLE requests ADD COLUMN delivery_address VARCHAR(255) DEFAULT NULL",
      "ALTER TABLE requests ADD COLUMN delivery_city VARCHAR(100) DEFAULT NULL",
      "ALTER TABLE requests ADD COLUMN delivery_phone VARCHAR(50) DEFAULT NULL",
      "ALTER TABLE requests ADD COLUMN delivery_notes TEXT DEFAULT NULL",
      "ALTER TABLE requests ADD COLUMN cancellation_reason VARCHAR(255) DEFAULT NULL",
      "ALTER TABLE requests ADD COLUMN cancelled_by VARCHAR(50) DEFAULT NULL",
      "ALTER TABLE requests ADD COLUMN cancelled_at TIMESTAMP NULL DEFAULT NULL"
    ];

    for (const queryStr of requestFields) {
      try {
        await pool.query(queryStr);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) {
          console.warn('Warning updating requests schema:', err.message);
        }
      }
    }
    console.log('Added Home Delivery and Cancellation columns to requests table.');

    // 3. Seed max_vendor_cancellations setting if not present
    try {
      await pool.query(`
        INSERT INTO system_settings (setting_key, setting_value) VALUES 
        ('max_vendor_cancellations', '3')
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `);
      console.log('Seeded max_vendor_cancellations in system_settings.');
    } catch (err) {
      console.warn('Warning setting system_settings:', err.message);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateHomeDelivery();
