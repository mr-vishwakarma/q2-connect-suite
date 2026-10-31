/**
 * Legacy compatibility alias for bootstrapSuperAdmin.js
 * Delegates directly to the secure bootstrapSuperAdmin script.
 */

const { bootstrapSuperAdmin } = require('./bootstrapSuperAdmin');

if (require.main === module) {
  bootstrapSuperAdmin().catch((err) => {
    console.error(`❌ Super Admin seeding failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { bootstrapSuperAdmin };
