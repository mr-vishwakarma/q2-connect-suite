const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Hostel = require('../models/Hostel');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const Complaint = require('../models/Complaint');
const Expense = require('../models/Expense');
const LaundrySlot = require('../models/LaundrySlot');
const MessRequest = require('../models/MessRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');

const isDryRun = process.argv.includes('--dry-run');

async function migrateCanonicalHostelIdentity() {
  console.log('=================================================================');
  console.log(`Starting Hostel Canonical Identity Migration ${isDryRun ? '(DRY RUN - No DB changes)' : '(LIVE MODE)'}`);
  console.log('=================================================================\n');

  await connectDB();

  // Step 1: Ensure all Hostels have valid code, slug, organizationId
  console.log('--- Step 1: Verifying & Normalizing Hostels ---');
  const allHostels = await Hostel.find({});
  console.log(`Found ${allHostels.length} total Hostels in database.`);

  let hostelsNormalized = 0;
  for (const h of allHostels) {
    let changed = false;
    if (!h.code) {
      h.code = (h.name || 'BRANCH').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
      changed = true;
    }
    if (!h.slug) {
      h.slug = (h.name || h.code).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      changed = true;
    }
    if (changed && !isDryRun) {
      await h.save();
      hostelsNormalized++;
    }
  }
  console.log(`Hostels normalized with missing codes/slugs: ${hostelsNormalized}\n`);

  // Build lookup index: orgId -> Map of (code/name lower -> hostelId)
  const orgHostelMap = new Map();
  // Also global lookup by code or normalized name as fallback
  const globalCodeMap = new Map();

  allHostels.forEach((h) => {
    const orgIdStr = String(h.organizationId);
    if (!orgHostelMap.has(orgIdStr)) {
      orgHostelMap.set(orgIdStr, new Map());
    }
    const map = orgHostelMap.get(orgIdStr);
    if (h.code) map.set(h.code.trim().toUpperCase(), h._id);
    if (h.name) map.set(h.name.trim().toLowerCase(), h._id);
    if (h.slug) map.set(h.slug.trim().toLowerCase(), h._id);

    // Common abbreviations
    const codeUpper = (h.code || '').trim().toUpperCase();
    if (codeUpper) {
      if (!globalCodeMap.has(codeUpper)) globalCodeMap.set(codeUpper, h._id);
    }
  });

  const findHostelId = (orgId, rawString) => {
    if (!rawString) return null;
    const str = String(rawString).trim();
    if (mongoose.Types.ObjectId.isValid(str)) {
      // Check if it's already an ObjectId pointing to a valid hostel
      const matched = allHostels.find((h) => String(h._id) === str);
      if (matched) return matched._id;
    }

    const orgIdStr = orgId ? String(orgId) : null;
    if (orgIdStr && orgHostelMap.has(orgIdStr)) {
      const map = orgHostelMap.get(orgIdStr);
      if (map.has(str.toUpperCase())) return map.get(str.toUpperCase());
      if (map.has(str.toLowerCase())) return map.get(str.toLowerCase());
      // Match partial names (e.g. 'Gachibowli' or 'Q2.0')
      for (const [key, id] of map.entries()) {
        if (key.includes(str.toLowerCase()) || str.toLowerCase().includes(key)) {
          return id;
        }
      }
    }

    // Global fallback by exact code
    if (globalCodeMap.has(str.toUpperCase())) {
      return globalCodeMap.get(str.toUpperCase());
    }

    // Special Q2 Suite defaults for legacy records
    if (str.toUpperCase() === 'Q2') {
      const q2Hostel = allHostels.find((h) => h.code === 'Q2');
      if (q2Hostel) return q2Hostel._id;
    }
    if (str.toUpperCase() === 'Q2.0') {
      const q20Hostel = allHostels.find((h) => h.code === 'Q2.0');
      if (q20Hostel) return q20Hostel._id;
    }
    if (str.toUpperCase() === 'Q2.1') {
      const q21Hostel = allHostels.find((h) => h.code === 'Q2.1');
      if (q21Hostel) return q21Hostel._id;
    }

    return null;
  };

  const results = [];

  // Helper migration runner
  async function migrateCollection(name, Model, stringField = 'hostel') {
    process.stdout.write(`Migrating ${name}... `);
    const total = await Model.countDocuments({});
    const alreadyHad = await Model.countDocuments({ hostelId: { $ne: null } });
    const docs = await Model.find({ $or: [{ hostelId: null }, { hostelId: { $exists: false } }] }).lean();
    let migrated = 0;
    let unmatched = 0;

    const updates = [];

    for (const doc of docs) {
      const rawVal = doc[stringField];
      const targetOrg = doc.organizationId;
      const matchedId = findHostelId(targetOrg, rawVal);

      if (matchedId) {
        migrated++;
        updates.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { hostelId: matchedId } },
          },
        });
      } else {
        unmatched++;
      }
    }

    if (!isDryRun && updates.length > 0) {
      for (let i = 0; i < updates.length; i += 500) {
        const chunk = updates.slice(i, i + 500);
        await Model.bulkWrite(chunk);
      }
    }

    console.log(`Done! (Total: ${total}, Already had: ${alreadyHad}, Migrated: ${migrated}, Unmatched: ${unmatched})`);

    results.push({
      Collection: name,
      'Total Records': total,
      Migrated: migrated,
      'Already Had hostelId': alreadyHad,
      'Unmatched / Skipped': unmatched,
    });
  }

  console.log('--- Step 2: Backfilling hostelId Across Collections ---');
  await migrateCollection('Student', Student, 'hostel');
  await migrateCollection('Room', Room, 'hostel');
  await migrateCollection('Fee', Fee, 'hostel');
  await migrateCollection('Attendance', Attendance, 'hostel');
  await migrateCollection('Complaint', Complaint, 'hostel');
  await migrateCollection('Expense', Expense, 'hostel');
  await migrateCollection('LaundrySlot', LaundrySlot, 'hostel');
  await migrateCollection('MessRequest', MessRequest, 'hostel');
  await migrateCollection('Notification', Notification, 'hostel');

  // Step 3: Migrate Users
  process.stdout.write('Migrating Users (activeHostelId)... ');
  const studentRecords = await Student.find({ hostelId: { $ne: null } }).select('userId hostelId').lean();
  const studentUserHostelMap = new Map();
  studentRecords.forEach((s) => {
    if (s.userId) studentUserHostelMap.set(String(s.userId), s.hostelId);
  });

  const totalUsers = await User.countDocuments({});
  const userAlreadyHad = await User.countDocuments({ activeHostelId: { $ne: null } });
  const users = await User.find({ $or: [{ activeHostelId: null }, { activeHostelId: { $exists: false } }] }).populate('studentId').lean();
  let userMigrated = 0;
  let userUnmatched = 0;

  const userUpdates = [];
  for (const u of users) {
    let matchedId = null;
    if (studentUserHostelMap.has(String(u._id))) {
      matchedId = studentUserHostelMap.get(String(u._id));
    } else if (u.studentId && u.studentId.hostelId) {
      matchedId = u.studentId.hostelId;
    } else if (u.hostels && u.hostels.length > 0) {
      matchedId = findHostelId(u.activeOrganizationId, u.hostels[0]);
    } else if (u.registrationDetails?.hostel) {
      matchedId = findHostelId(u.activeOrganizationId, u.registrationDetails.hostel);
    }

    if (matchedId) {
      userMigrated++;
      userUpdates.push({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { activeHostelId: matchedId } },
        },
      });
    } else {
      userUnmatched++;
    }
  }

  if (!isDryRun && userUpdates.length > 0) {
    for (let i = 0; i < userUpdates.length; i += 500) {
      await User.bulkWrite(userUpdates.slice(i, i + 500));
    }
  }

  console.log(`Done! (Total: ${totalUsers}, Already had: ${userAlreadyHad}, Migrated: ${userMigrated}, Unmatched: ${userUnmatched})`);

  results.push({
    Collection: 'User (activeHostelId)',
    'Total Records': totalUsers,
    Migrated: userMigrated,
    'Already Had hostelId': userAlreadyHad,
    'Unmatched / Skipped': userUnmatched,
  });

  console.log('\n--- Step 4: Migration Summary ---');
  console.table(results);

  console.log('\nMigration completed successfully.');
  process.exit(0);
}

migrateCanonicalHostelIdentity().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
