const pool = require('../db');

async function deleteAllParts() {
  try {
    console.log('🗑️ Starting cleanup: Deleting all entered parts and related order requests...');

    // 1. Delete reviews referencing requests
    await pool.query('DELETE FROM reviews');
    console.log('Deleted all reviews.');

    // 2. Delete reports referencing requests
    await pool.query('DELETE FROM reports WHERE request_id IS NOT NULL');
    console.log('Deleted all request reports.');

    // 3. Delete commissions referencing requests
    await pool.query('DELETE FROM commissions');
    console.log('Deleted all commissions.');

    // 4. Delete requests referencing parts
    await pool.query('DELETE FROM requests');
    console.log('Deleted all requests.');

    // 5. Delete all parts
    const [result] = await pool.query('DELETE FROM parts');
    console.log(`Deleted ${result.affectedRows} parts from parts table.`);

    console.log('✅ Success: All parts deleted cleanly from database!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Deletion failed:', error);
    process.exit(1);
  }
}

deleteAllParts();
