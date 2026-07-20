const pool = require('../config/db');

async function countVendors() {
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM vendors');
  return rows[0].count;
}

async function countCustomers() {
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM customers');
  return rows[0].count;
}

async function countParts() {
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM parts');
  return rows[0].count;
}

async function countRequests() {
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM requests');
  return rows[0].count;
}

async function countPendingVendorApprovals() {
  const [rows] = await pool.execute("SELECT COUNT(*) as count FROM vendors WHERE verification_status = 'pending'");
  return rows[0].count;
}

module.exports = {
  countVendors,
  countCustomers,
  countParts,
  countRequests,
  countPendingVendorApprovals
};
