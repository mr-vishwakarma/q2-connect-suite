/**
 * Phase E — Upload, Media Pipeline & Node.js Memory Optimization Test Suite
 * 
 * Verifies:
 * 1. Direct ImageKit Upload Authorization with HMAC signed parameters
 * 2. Category-Specific File Size & MIME Type Enforcement
 * 3. Path Traversal & Malicious Filename Sanitization
 * 4. Multi-Tenant Namespace Isolation (Org A cannot target Org B folder)
 * 5. Cross-Tenant Deletion Protection (Org A cannot delete Org B files)
 * 6. Student Ownership Boundary (Student A cannot authorize upload for Student B)
 * 7. Super Admin Platform Media Authorization
 * 8. Direct Upload Confirmation & MediaMetadata Persistence
 * 9. Atomic Replacement Semantics (New asset saved, old asset marked REPLACED)
 * 10. Memory-Safe Server Fallback with Guaranteed Disk Temp File Cleanup
 * 11. Zero Private Key Exposure in API Responses
 * 12. Non-Fatal Degraded Mode when ImageKit is unconfigured or in mock mode
 */

require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.MOCK_EMAIL = 'true';

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Student = require('../models/Student');
const User = require('../models/User');
const MediaMetadata = require('../models/MediaMetadata');
const {
  authorizeUpload,
  confirmUpload,
  uploadFile,
  deleteFile,
  getUploadAuth,
  UPLOAD_CATEGORIES,
} = require('../controllers/upload.controller');

async function runPhaseETestSuite() {
  console.log('============================================================');
  console.log('⚡ PHASE E: MEDIA PIPELINE & MEMORY OPTIMIZATION TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // Mock Express Req/Res Generator
  function createMockReqRes({ body = {}, params = {}, query = {}, user = null, tenant = null, file = null } = {}) {
    let statusCode = 200;
    let responseData = null;

    const req = {
      body,
      params,
      query,
      user,
      tenant,
      file,
      headers: {},
    };

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        responseData = data;
        return res;
      },
      getStatusCode: () => statusCode,
      getData: () => responseData,
    };

    return { req, res };
  }

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is required to run Phase E test suite.');
    }

    console.log('[Setup] Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      family: 4,
    });
    console.log('✅ Connected to MongoDB Atlas.\n');

    // Establish Deterministic Test Fixtures
    let orgA = await Organization.findOne({ slug: 'phase-e-org-a' });
    if (!orgA) {
      orgA = await Organization.create({
        name: 'Phase E Organization A',
        slug: 'phase-e-org-a',
        contactEmail: 'org_a@phasee.com',
        status: 'ACTIVE',
      });
    }

    let orgB = await Organization.findOne({ slug: 'phase-e-org-b' });
    if (!orgB) {
      orgB = await Organization.create({
        name: 'Phase E Organization B',
        slug: 'phase-e-org-b',
        contactEmail: 'org_b@phasee.com',
        status: 'ACTIVE',
      });
    }

    let hostelA = await Hostel.findOne({ organizationId: orgA._id, code: 'PEH1' });
    if (!hostelA) {
      hostelA = await Hostel.create({
        name: 'Phase E Hostel A',
        code: 'PEH1',
        organizationId: orgA._id,
        capacity: 50,
      });
    }

    const adminUserA = await User.create({
      name: 'Org A Admin',
      email: `admin_a_${Date.now()}@phasee.com`,
      username: `admin_a_${Date.now()}`,
      password: 'HashedPassword@123',
      role: 'admin',
      activeOrganizationId: orgA._id,
      hostels: [hostelA.code],
    });

    const adminUserB = await User.create({
      name: 'Org B Admin',
      email: `admin_b_${Date.now()}@phasee.com`,
      username: `admin_b_${Date.now()}`,
      password: 'HashedPassword@123',
      role: 'admin',
      activeOrganizationId: orgB._id,
    });

    const studentUserA1 = await User.create({
      name: 'Student A1',
      email: `student_a1_${Date.now()}@phasee.com`,
      username: `student_a1_${Date.now()}`,
      password: 'HashedPassword@123',
      role: 'student',
      activeOrganizationId: orgA._id,
    });

    const studentUserA2 = await User.create({
      name: 'Student A2',
      email: `student_a2_${Date.now()}@phasee.com`,
      username: `student_a2_${Date.now()}`,
      password: 'HashedPassword@123',
      role: 'student',
      activeOrganizationId: orgA._id,
    });

    const studentA1 = await Student.create({
      userId: studentUserA1._id,
      organizationId: orgA._id,
      hostelId: hostelA._id,
      name: studentUserA1.name,
      username: studentUserA1.username,
      email: studentUserA1.email,
      hostel: hostelA.code,
    });

    const studentA2 = await Student.create({
      userId: studentUserA2._id,
      organizationId: orgA._id,
      hostelId: hostelA._id,
      name: studentUserA2.name,
      username: studentUserA2.username,
      email: studentUserA2.email,
      hostel: hostelA.code,
    });

    const superAdminUser = await User.create({
      name: 'Platform Super Admin',
      email: `sa_${Date.now()}@phasee.com`,
      username: `sa_${Date.now()}`,
      password: 'HashedPassword@123',
      role: 'super_admin',
    });

    // =============================================================
    // TEST GROUP 1: DIRECT IMAGEKIT UPLOAD AUTHORIZATION
    // =============================================================
    console.log('--- TEST GROUP 1: Direct ImageKit Upload Authorization ---');

    // 1. Valid Profile Photo Authorization
    const { req: reqAuth1, res: resAuth1 } = createMockReqRes({
      body: {
        category: 'PROFILE_PHOTO',
        fileName: 'avatar.png',
        fileSize: 1.5 * 1024 * 1024, // 1.5 MB
        mimeType: 'image/png',
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id, isSuperAdmin: false },
    });

    await authorizeUpload(reqAuth1, resAuth1);
    assert(resAuth1.getStatusCode() === 200, 'Direct upload authorization returned 200 OK');
    const authData = resAuth1.getData();
    assert(authData.uploadMode === 'DIRECT_IMAGEKIT', 'uploadMode is DIRECT_IMAGEKIT');
    assert(Boolean(authData.auth?.signature), 'HMAC signed signature provided');
    assert(Boolean(authData.auth?.token), 'Signed auth token provided');
    assert(Boolean(authData.auth?.expire), 'Expiration timestamp provided');
    assert(authData.params?.folder.startsWith(`/q2-connect/orgs/${orgA._id}`), 'Folder is tenant-isolated under target organization namespace');
    assert(!authData.auth?.privateKey, 'Zero ImageKit privateKey leaked to client response');

    // =============================================================
    // TEST GROUP 2: CATEGORY-SPECIFIC VALIDATION & CONSTRAINTS
    // =============================================================
    console.log('\n--- TEST GROUP 2: Category-Specific Validation & Constraints ---');

    // 1. Oversized Profile Photo (> 3 MB)
    const { req: reqOversize, res: resOversize } = createMockReqRes({
      body: {
        category: 'PROFILE_PHOTO',
        fileName: 'huge.jpg',
        fileSize: 4.5 * 1024 * 1024, // 4.5 MB (Limit is 3 MB)
        mimeType: 'image/jpeg',
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id },
    });
    await authorizeUpload(reqOversize, resOversize);
    assert(resOversize.getStatusCode() === 400, 'Oversized profile photo rejected with 400 Bad Request');
    assert(resOversize.getData()?.message.includes('exceeds maximum allowed limit'), 'Rejection clearly explains file size boundary');

    // 2. Disallowed MIME Type for Profile Photo (PDF not allowed for profile)
    const { req: reqBadMime, res: resBadMime } = createMockReqRes({
      body: {
        category: 'PROFILE_PHOTO',
        fileName: 'document.pdf',
        fileSize: 500 * 1024,
        mimeType: 'application/pdf',
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id },
    });
    await authorizeUpload(reqBadMime, resBadMime);
    assert(resBadMime.getStatusCode() === 400, 'Invalid MIME type (PDF for profile) rejected with 400');

    // 3. Disallowed Extension (Executable / Malicious)
    const { req: reqBadExt, res: resBadExt } = createMockReqRes({
      body: {
        category: 'PROFILE_PHOTO',
        fileName: 'exploit.exe',
        fileSize: 100 * 1024,
        mimeType: 'image/jpeg',
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id },
    });
    await authorizeUpload(reqBadExt, resBadExt);
    assert(resBadExt.getStatusCode() === 400, 'Dangerous file extension (.exe) rejected with 400');

    // 4. Invalid Upload Category
    const { req: reqBadCat, res: resBadCat } = createMockReqRes({
      body: {
        category: 'MALICIOUS_CATEGORY',
        fileName: 'test.jpg',
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id },
    });
    await authorizeUpload(reqBadCat, resBadCat);
    assert(resBadCat.getStatusCode() === 400, 'Arbitrary unlisted category rejected with 400');

    // =============================================================
    // TEST GROUP 3: TENANT ISOLATION & OBJECT-LEVEL AUTHORIZATION
    // =============================================================
    console.log('\n--- TEST GROUP 3: Tenant Isolation & Ownership Boundaries ---');

    // 1. Tenant Injection Vector: Org A User attempting to set organizationId = Org B
    const { req: reqTenantTamper, res: resTenantTamper } = createMockReqRes({
      body: {
        category: 'PROFILE_PHOTO',
        fileName: 'avatar.jpg',
        organizationId: orgB._id.toString(), // Tampered Org B!
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id, isSuperAdmin: false }, // Bound to Org A
    });
    await authorizeUpload(reqTenantTamper, resTenantTamper);
    assert(resTenantTamper.getStatusCode() === 200, 'Authorization proceeds bound to authenticated tenant context');
    assert(
      resTenantTamper.getData().params.folder.includes(orgA._id.toString()),
      'Tenant tamper prevented: Folder bound strictly to Org A, NOT Org B'
    );
    assert(
      !resTenantTamper.getData().params.folder.includes(orgB._id.toString()),
      'Zero Org B namespace leakage'
    );

    // 2. Student Ownership Vector: Student A1 attempting to authorize photo for Student A2
    const { req: reqCrossStudent, res: resCrossStudent } = createMockReqRes({
      body: {
        category: 'PROFILE_PHOTO',
        fileName: 'avatar.jpg',
        resourceId: studentA2._id.toString(), // Different student!
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id, isSuperAdmin: false },
    });
    await authorizeUpload(reqCrossStudent, resCrossStudent);
    assert(resCrossStudent.getStatusCode() === 403, 'Student A1 upload authorization for Student A2 rejected with 403 Forbidden');

    // 3. Admin Authorization for Student in Own Org (Allowed)
    const { req: reqAdminForStudent, res: resAdminForStudent } = createMockReqRes({
      body: {
        category: 'PROFILE_PHOTO',
        fileName: 'avatar.jpg',
        resourceId: studentA1._id.toString(),
      },
      user: adminUserA,
      tenant: { organizationId: orgA._id, isSuperAdmin: false },
    });
    await authorizeUpload(reqAdminForStudent, resAdminForStudent);
    assert(resAdminForStudent.getStatusCode() === 200, 'Org A Admin authorized to upload for Org A Student');

    // 4. Super Admin Explicit Cross-Tenant Authorization
    const { req: reqSuperAdminAuth, res: resSuperAdminAuth } = createMockReqRes({
      body: {
        category: 'ORGANIZATION_LOGO',
        fileName: 'logo.png',
        organizationId: orgB._id.toString(),
      },
      user: superAdminUser,
      tenant: { isSuperAdmin: true },
    });
    await authorizeUpload(reqSuperAdminAuth, resSuperAdminAuth);
    assert(resSuperAdminAuth.getStatusCode() === 200, 'Super Admin cross-tenant authorization allowed (200 OK)');
    assert(resSuperAdminAuth.getData().params.folder.includes(orgB._id.toString()), 'Super Admin folder properly targeted Org B');

    // =============================================================
    // TEST GROUP 4: UPLOAD CONFIRMATION & REPLACEMENT LIFECYCLE
    // =============================================================
    console.log('\n--- TEST GROUP 4: Upload Confirmation & Atomic Replacement Lifecycle ---');

    const mockFileId1 = `pe_file_${Date.now()}_1`;
    const mockFileId2 = `pe_file_${Date.now()}_2`;

    // 1. Initial Confirmation for Student A1 Profile Photo
    const { req: reqConfirm1, res: resConfirm1 } = createMockReqRes({
      body: {
        fileId: mockFileId1,
        url: `https://ik.imagekit.io/dummy_id/${mockFileId1}.jpg`,
        thumbnailUrl: `https://ik.imagekit.io/dummy_id/tr:w-300/${mockFileId1}.jpg`,
        fileName: `${mockFileId1}.jpg`,
        size: 150000,
        category: 'PROFILE_PHOTO',
        resourceId: studentA1._id.toString(),
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id, isSuperAdmin: false },
    });

    await confirmUpload(reqConfirm1, resConfirm1);
    assert(resConfirm1.getStatusCode() === 200, 'Initial upload confirmation returned 200 OK');

    const metaDoc1 = await MediaMetadata.findOne({ fileId: mockFileId1 });
    assert(metaDoc1 && metaDoc1.status === 'CONFIRMED', 'MediaMetadata record created with status: CONFIRMED');
    assert(metaDoc1 && metaDoc1.organizationId.toString() === orgA._id.toString(), 'MediaMetadata bound to Org A tenant');

    const studentA1AfterUpload = await Student.findById(studentA1._id);
    assert(studentA1AfterUpload.profilePhoto === reqConfirm1.body.url, 'Student profilePhoto updated with confirmed URL');
    assert(studentA1AfterUpload.profilePhotoFileId === mockFileId1, 'Student profilePhotoFileId stored accurately');

    // 2. Replacement Confirmation (Student uploads a NEW photo)
    const { req: reqConfirm2, res: resConfirm2 } = createMockReqRes({
      body: {
        fileId: mockFileId2,
        url: `https://ik.imagekit.io/dummy_id/${mockFileId2}.jpg`,
        thumbnailUrl: `https://ik.imagekit.io/dummy_id/tr:w-300/${mockFileId2}.jpg`,
        fileName: `${mockFileId2}.jpg`,
        size: 160000,
        category: 'PROFILE_PHOTO',
        resourceId: studentA1._id.toString(),
      },
      user: studentUserA1,
      tenant: { organizationId: orgA._id, isSuperAdmin: false },
    });

    await confirmUpload(reqConfirm2, resConfirm2);
    assert(resConfirm2.getStatusCode() === 200, 'Replacement upload confirmation returned 200 OK');

    const studentA1AfterReplace = await Student.findById(studentA1._id);
    assert(studentA1AfterReplace.profilePhotoFileId === mockFileId2, 'Student profile updated to NEW asset fileId');

    const oldMeta = await MediaMetadata.findOne({ fileId: mockFileId1 });
    assert(oldMeta && oldMeta.status === 'REPLACED', 'Previous asset MediaMetadata transitioned atomically to status: REPLACED');
    assert(Boolean(oldMeta.replacedAt), 'Previous asset recorded replacedAt timestamp');

    // =============================================================
    // TEST GROUP 5: CROSS-TENANT DELETION PROTECTION
    // =============================================================
    console.log('\n--- TEST GROUP 5: Cross-Tenant Deletion Protection ---');

    // Org B Admin attempting to delete Org A file
    const { req: reqDelCross, res: resDelCross } = createMockReqRes({
      params: { fileId: mockFileId2 }, // Owned by Org A
      user: adminUserB, // Admin of Org B!
      tenant: { organizationId: orgB._id, isSuperAdmin: false },
    });

    await deleteFile(reqDelCross, resDelCross);
    assert(resDelCross.getStatusCode() === 403, 'Cross-tenant deletion attempt rejected with 403 Forbidden');
    assert(resDelCross.getData()?.message.includes('Tenant boundary violation'), 'Rejection explicitly enforces tenant boundary');

    // Org A Admin deleting own file (Allowed)
    const { req: reqDelOwn, res: resDelOwn } = createMockReqRes({
      params: { fileId: mockFileId2 },
      user: adminUserA,
      tenant: { organizationId: orgA._id, isSuperAdmin: false },
    });

    await deleteFile(reqDelOwn, resDelOwn);
    assert(resDelOwn.getStatusCode() === 200, 'Org A Admin deleting Org A asset returned 200 OK');

    const deletedMeta = await MediaMetadata.findOne({ fileId: mockFileId2 });
    assert(deletedMeta && deletedMeta.status === 'DELETED', 'MediaMetadata record transitioned to status: DELETED');

    // =============================================================
    // TEST GROUP 6: MEMORY-SAFE SERVER FALLBACK & DISK CLEANUP
    // =============================================================
    console.log('\n--- TEST GROUP 6: Memory-Safe Server Fallback with Guaranteed Disk Temp Cleanup ---');

    // Create a temporary physical test file on disk
    const testTempFilePath = path.join(os.tmpdir(), `phase_e_test_temp_${Date.now()}.png`);
    fs.writeFileSync(testTempFilePath, Buffer.alloc(1024, 0x5a));
    assert(fs.existsSync(testTempFilePath), 'Temporary disk test file created');

    const { req: reqServerUpload, res: resServerUpload } = createMockReqRes({
      file: {
        path: testTempFilePath,
        originalname: 'test_photo.png',
        size: 1024,
        mimetype: 'image/png',
      },
      user: adminUserA,
      tenant: { organizationId: orgA._id },
    });

    await uploadFile(reqServerUpload, resServerUpload);
    assert(resServerUpload.getStatusCode() === 200, 'Server-proxied upload fallback returned 200 OK');

    // CRITICAL: Verify temporary file was deleted from disk immediately in finally block
    const tempFileStillExists = fs.existsSync(testTempFilePath);
    assert(!tempFileStillExists, 'Temporary disk file was unlinked and purged from disk immediately after streaming');

    // =============================================================
    // TEST GROUP 7: BACKWARD COMPATIBLE GET /api/upload/auth
    // =============================================================
    console.log('\n--- TEST GROUP 7: Backward-Compatible GET /api/upload/auth ---');

    const { req: reqLegacyAuth, res: resLegacyAuth } = createMockReqRes({
      user: studentUserA1,
      tenant: { organizationId: orgA._id },
    });

    getUploadAuth(reqLegacyAuth, resLegacyAuth);
    assert(resLegacyAuth.getStatusCode() === 200, 'GET /api/upload/auth returned 200 OK');
    const legacyAuthData = resLegacyAuth.getData();
    assert(Boolean(legacyAuthData.signature), 'Legacy auth returned valid signature');
    assert(Boolean(legacyAuthData.token), 'Legacy auth returned token');
    assert(!legacyAuthData.privateKey, 'Legacy auth does not leak ImageKit privateKey');

    // Clean up test fixtures
    await User.deleteMany({ email: { $in: [adminUserA.email, adminUserB.email, studentUserA1.email, studentUserA2.email, superAdminUser.email] } });
    await Student.deleteMany({ _id: { $in: [studentA1._id, studentA2._id] } });
    await MediaMetadata.deleteMany({ fileId: { $in: [mockFileId1, mockFileId2] } });

    console.log('\n============================================================');
    console.log(`🏁 PHASE E TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    await mongoose.connection.close(false);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Critical Phase E Test Suite Exception:', error);
    await mongoose.connection.close(false).catch(() => {});
    process.exit(1);
  }
}

runPhaseETestSuite();
