const pool = require('../db');

async function deleteAllVendors() {
  try {
    console.log('🗑️ Starting cleanup: Deleting all vendor records from system database...');

    // 1. Get all vendor user IDs
    const [vendorUsers] = await pool.query("SELECT id FROM users WHERE role = 'vendor'");
    const userIds = vendorUsers.map(u => u.id);

    // 2. Get all vendor IDs from vendors table
    const [vendorProfiles] = await pool.query("SELECT id FROM vendors");
    const vendorIds = vendorProfiles.map(v => v.id);

    console.log(`Found ${userIds.length} vendor users and ${vendorIds.length} vendor profiles.`);

    if (vendorIds.length > 0) {
      const vPlaceholders = vendorIds.map(() => '?').join(',');

      // Delete linked commissions
      await pool.query(`DELETE FROM commissions WHERE vendor_id IN (${vPlaceholders})`, vendorIds);
      console.log('Deleted vendor commissions.');

      // Delete linked requests
      await pool.query(`DELETE FROM requests WHERE vendor_id IN (${vPlaceholders})`, vendorIds);
      console.log('Deleted vendor lead requests.');

      // Delete linked parts
      await pool.query(`DELETE FROM parts WHERE vendor_id IN (${vPlaceholders})`, vendorIds);
      console.log('Deleted vendor product parts.');

      // Delete vendor profiles
      await pool.query(`DELETE FROM vendors WHERE id IN (${vPlaceholders})`, vendorIds);
      console.log('Deleted vendor profiles.');
    }

    if (userIds.length > 0) {
      const uPlaceholders = userIds.map(() => '?').join(',');

      // Delete notifications for vendor users
      await pool.query(`DELETE FROM notifications WHERE user_id IN (${uPlaceholders})`, userIds);
      console.log('Deleted vendor user notifications.');

      // Delete vendor user accounts
      await pool.query(`DELETE FROM users WHERE role = 'vendor'`);
      console.log('Deleted all vendor accounts from users table.');
    } else {
      await pool.query("DELETE FROM users WHERE role = 'vendor'");
      console.log('Deleted all vendor accounts from users table.');
    }

    console.log('✅ Success: All vendors deleted cleanly from users table!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Deletion failed:', error);
    process.exit(1);
  }
}

deleteAllVendors();
