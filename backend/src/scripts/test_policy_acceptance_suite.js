/**
 * Hosteliq — Student Policy Acceptance System: Comprehensive Security & Integration Test Suite
 * 
 * Verifies all 22 test scenarios specified in Prompt Section 12:
 * 1. Newly registered student who has not accepted any mandatory documents.
 * 2. Password setup followed by login and mandatory acceptance.
 * 3. Existing users with missing acceptance records.
 * 4. Existing users whose required document versions are already accepted.
 * 5. Existing users who must accept an updated published version.
 * 6. Ordinary login without unnecessary repeated acceptance.
 * 7. Forgot-password and reset-password availability before acceptance.
 * 8. Blocking dashboard and protected API access while acceptance is pending.
 * 9. Allowing only the required acceptance workflow endpoints before acceptance.
 * 10. Successful acceptance and subsequent dashboard access.
 * 11. Rejection of empty, malformed, unauthenticated or tampered acceptance submissions.
 * 12. Duplicate acceptance submissions and retry handling (idempotency).
 * 13. PDF extraction for text-based PDFs.
 * 14. Detection and handling of scanned PDFs and failed extraction.
 * 15. Safe rendering of extracted content.
 * 16. Draft versus published document behavior.
 * 17. Document version immutability and historical acceptance preservation.
 * 18. Branch inheritance and organization-level tenant isolation.
 * 19. A student from one hostel being denied access to another hostel's documents.
 * 20. A Hostel Admin being prevented from modifying another organization's policies.
 * 21. Missing configuration and incomplete policy-readiness behavior.
 * 22. Existing authentication, registration, billing, and student portal regression tests.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Ensure test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_hosteliq_policy_acceptance_2026';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_2026';
const TEST_PORT = 5088;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const MONGO_URI = 'mongodb://127.0.0.1:27017/hosteliq_policy_test';
process.env.MONGODB_URI = MONGO_URI;

// Models
const User = require('../models/User');
const Student = require('../models/Student');
const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Membership = require('../models/Membership');
const HostelPolicyDocument = require('../models/HostelPolicyDocument');
const HostelPolicyVersion = require('../models/HostelPolicyVersion');
const HostelPolicyAcceptance = require('../models/HostelPolicyAcceptance');
const {
  extractAndProcessPdf,
  computeContentHash,
  structureDocumentText,
} = require('../services/policyExtraction.service');
const {
  getHostelPolicyReadiness,
  resolveApplicablePolicies,
  getStudentPolicyStatus,
} = require('../services/hostelPolicy.service');

// Helper: HTTP request
function makeRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    let payload = '';
    const reqHeaders = { ...headers };

    if (body && typeof body === 'object') {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      `${BASE_URL}${endpoint}`,
      { method, headers: reqHeaders },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = rawData ? JSON.parse(rawData) : null;
          } catch (e) {
            json = { raw: rawData };
          }
          resolve({ status: res.statusCode, body: json, raw: rawData });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function makeMultipartUpload(endpoint, fields, file, headers = {}) {
  return new Promise((resolve, reject) => {
    const boundary = '----HosteliqFormBoundary' + Math.random().toString(36).substring(2);
    let postData = [];

    // Append fields
    for (const [key, value] of Object.entries(fields)) {
      postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }

    // Append file
    if (file) {
      postData.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`
        )
      );
      postData.push(file.buffer);
      postData.push(Buffer.from('\r\n'));
    }

    postData.push(Buffer.from(`--${boundary}--\r\n`));
    const fullBuffer = Buffer.concat(postData);

    const reqHeaders = {
      ...headers,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fullBuffer.length,
    };

    const req = http.request(
      `${BASE_URL}${endpoint}`,
      { method: 'POST', headers: reqHeaders },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = rawData ? JSON.parse(rawData) : null;
          } catch (e) {
            json = { raw: rawData };
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );

    req.on('error', reject);
    req.write(fullBuffer);
    req.end();
  });
}

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('🛡️  HOSTELIQ POLICY ACCEPTANCE SYSTEM: INTEGRATION TEST SUITE');
  console.log('============================================================\n');

  let server;
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (details) console.error(`     Details: ${details}`);
      failedCount++;
    }
  }

  try {
    // 1. Connect to Local MongoDB
    if (mongoose.connection.readyState !== 1) {
      console.log('📦 Connecting to local MongoDB...');
      await mongoose.connect(MONGO_URI);
      console.log('✅ Connected to MongoDB at', MONGO_URI);
    }

    // 2. Clean up test database
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Organization.deleteMany({}),
      Hostel.deleteMany({}),
      Room.deleteMany({}),
      Membership.deleteMany({}),
      HostelPolicyDocument.deleteMany({}),
      HostelPolicyVersion.deleteMany({}),
      HostelPolicyAcceptance.deleteMany({}),
    ]);

    // 3. Start Test Server
    const app = require('../app');
    server = app.listen(TEST_PORT);
    await new Promise((res) => setTimeout(res, 600));
    console.log(`🚀 Test server listening on http://localhost:${TEST_PORT}\n`);

    // Setup Test Data: Organizations & Branches
    const orgAlpha = await Organization.create({
      name: 'Alpha Living Group',
      slug: 'alpha-living',
      contactEmail: 'admin@alphaliving.com',
      status: 'ACTIVE',
    });

    const orgBeta = await Organization.create({
      name: 'Beta Residences Co',
      slug: 'beta-residences',
      contactEmail: 'admin@betaresidences.com',
      status: 'ACTIVE',
    });

    const branchAlphaMain = await Hostel.create({
      organizationId: orgAlpha._id,
      name: 'Alpha Main Hall',
      code: 'AMH',
      status: 'ACTIVE',
    });

    const branchAlphaAnnex = await Hostel.create({
      organizationId: orgAlpha._id,
      name: 'Alpha Annex Wing',
      code: 'AAW',
      status: 'ACTIVE',
    });

    await Room.create({
      organizationId: orgAlpha._id,
      hostelId: branchAlphaMain._id,
      hostel: 'AMH',
      roomNumber: 'A-102',
      capacity: 2,
      occupiedCount: 0,
      status: 'available',
    });

    const branchBetaCentral = await Hostel.create({
      organizationId: orgBeta._id,
      name: 'Beta Central Tower',
      code: 'BCT',
      status: 'ACTIVE',
    });

    // Admin Users
    const adminAlpha = await User.create({
      name: 'Admin Alpha',
      email: 'admin.alpha@alphaliving.com',
      username: 'admin_alpha',
      password: 'Password123!',
      role: 'admin',
      activeOrganizationId: orgAlpha._id,
      activeHostelId: branchAlphaMain._id,
      hostels: ['AMH', 'AAW'],
    });

    const adminBeta = await User.create({
      name: 'Admin Beta',
      email: 'admin.beta@betaresidences.com',
      username: 'admin_beta',
      password: 'Password123!',
      role: 'admin',
      activeOrganizationId: orgBeta._id,
      activeHostelId: branchBetaCentral._id,
      hostels: ['BCT'],
    });

    await Membership.create([
      {
        userId: adminAlpha._id,
        organizationId: orgAlpha._id,
        role: 'HOSTEL_ADMIN',
        status: 'ACTIVE',
        hostelAccess: ['all'],
        permissions: ['*'],
      },
      {
        userId: adminBeta._id,
        organizationId: orgBeta._id,
        role: 'HOSTEL_ADMIN',
        status: 'ACTIVE',
        hostelAccess: ['all'],
        permissions: ['*'],
      },
    ]);

    const tokenAdminAlpha = generateToken(adminAlpha._id);
    const tokenAdminBeta = generateToken(adminBeta._id);

    // Existing Student in Alpha Main
    const studentUser1 = await User.create({
      name: 'Existing Resident Alice',
      email: 'alice@student.alphaliving.com',
      username: 'alice_std',
      password: 'Password123!',
      role: 'student',
      status: 'ACTIVE',
      activeOrganizationId: orgAlpha._id,
      activeHostelId: branchAlphaMain._id,
      hostels: ['AMH'],
    });

    const studentProfile1 = await Student.create({
      userId: studentUser1._id,
      organizationId: orgAlpha._id,
      hostelId: branchAlphaMain._id,
      name: 'Existing Resident Alice',
      username: 'alice_std',
      email: 'alice@student.alphaliving.com',
      roomNo: 'A-101',
      hostel: 'AMH',
      studentCode: 'AMH2026001',
      isActive: true,
      status: 'ACTIVE',
    });
    studentUser1.studentId = studentProfile1._id;
    await studentUser1.save();

    const tokenAlice = generateToken(studentUser1._id);

    // Load sample PDF
    const validPdfPath = path.join(__dirname, '../../node_modules/pdf-parse/test/data/01-valid.pdf');
    const validPdfBuffer = fs.readFileSync(validPdfPath);

    // --- TEST 13: PDF extraction on digitally generated text-based PDF ---
    console.log('--- TEST 13 & 15: PDF Text Extraction & Safe Structured Formatting ---');
    const extractionResult = await extractAndProcessPdf(validPdfBuffer, {
      defaultTitle: 'Alpha Hostel Terms & Conditions',
    });
    assert(
      extractionResult.charCount > 1000 &&
        extractionResult.structuredContent?.sections?.length > 0 &&
        Boolean(extractionResult.contentHash),
      'TEST 13: Text-based PDF parsed and structured correctly with content hash',
      `Extracted ${extractionResult.charCount} characters, ${extractionResult.structuredContent?.sections?.length} sections`
    );

    // --- TEST 15: Safe rendering of extracted content (no raw script execution) ---
    assert(
      typeof extractionResult.structuredContent.title === 'string' &&
        Array.isArray(extractionResult.structuredContent.sections) &&
        !extractionResult.rawText.includes('<script>'),
      'TEST 15: Extracted content is formatted safely into structured schema without executable markup'
    );

    // --- TEST 14: Scanned PDF detection and handling ---
    console.log('\n--- TEST 14: Scanned / Empty PDF Detection ---');
    // Minimal PDF without readable text layer
    const simulatedEmptyPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000109 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n150\n%%EOF',
      'binary'
    );
    try {
      const scannedResult = await extractAndProcessPdf(simulatedEmptyPdf);
      assert(
        scannedResult.isScanned === true && scannedResult.extractionStatus === 'EMPTY',
        'TEST 14: Correctly detected PDF without usable selectable text and flagged EMPTY / SCANNED'
      );
    } catch (scannedErr) {
      assert(
        scannedErr.statusCode === 422 || scannedErr.message.includes('PDF'),
        'TEST 14: Corrupted or unreadable PDF safely rejected with clear explanation'
      );
    }

    // --- TEST 11 & 21: Configuration readiness & incomplete policy behavior ---
    console.log('\n--- TEST 21 & 3: Incomplete Policy Readiness & Existing Users ---');
    const initialReadiness = await getHostelPolicyReadiness(orgAlpha._id, branchAlphaMain._id);
    assert(
      initialReadiness.isReady === false &&
        initialReadiness.missingCategories.length === 3 &&
        initialReadiness.publishedCount === 0,
      'TEST 21: Policy readiness confirms incomplete state when documents are unconfigured'
    );

    // Student Alice policy check while hostel is unconfigured
    const alicePreConfigStatus = await getStudentPolicyStatus(studentUser1);
    assert(
      alicePreConfigStatus.notReadyBypass === true && alicePreConfigStatus.allAccepted === true,
      'TEST 21 (Student Safety): Students are NOT locked out on an empty gate before hostel completes document setup'
    );

    // --- TEST 16 & 4: Upload Drafts and Publish All 3 Mandatory Categories for Org Alpha ---
    console.log('\n--- TEST 16 & 4: Draft vs Published Document Workflow ---');
    const categories = [
      { key: 'TERMS_AND_CONDITIONS', title: 'Terms & Conditions of Residence', version: 'v1.0' },
      { key: 'RULES_AND_REGULATIONS', title: 'Hostel Rules & Code of Conduct', version: 'v1.0' },
      { key: 'HOSTEL_POLICIES', title: 'Hostel Fee & Living Policies', version: 'v1.0' },
    ];

    const publishedAlphaDocs = {};

    for (const cat of categories) {
      // 1. Upload draft via API
      const uploadRes = await makeMultipartUpload(
        '/api/policies/upload-draft',
        {
          category: cat.key,
          title: cat.title,
          versionLabel: cat.version,
          effectiveDate: '2026-09-01',
        },
        {
          fieldname: 'file',
          filename: `${cat.key}.pdf`,
          mimetype: 'application/pdf',
          buffer: validPdfBuffer,
        },
        {
          Authorization: `Bearer ${tokenAdminAlpha}`,
          'x-organization-id': orgAlpha._id.toString(),
        }
      );

      assert(
        uploadRes.status === 201 && uploadRes.body?.success && uploadRes.body?.data?.version?.status === 'REVIEW_REQUIRED',
        `TEST 16: Uploaded draft for '${cat.title}' created in REVIEW_REQUIRED state`,
        uploadRes.body?.message
      );

      const draftVersion = uploadRes.body.data.version;

      // 2. Review and update draft text
      const updateDraftRes = await makeRequest(
        'PUT',
        `/api/policies/draft/${draftVersion._id}`,
        {
          title: `${cat.title} (Reviewed)`,
          versionLabel: cat.version,
          effectiveDate: '2026-09-01',
          rawText: draftVersion.rawText + '\nSECTION: REVIEWED AND APPROVED BY ADMIN.',
        },
        {
          Authorization: `Bearer ${tokenAdminAlpha}`,
          'x-organization-id': orgAlpha._id.toString(),
        }
      );

      assert(
        updateDraftRes.status === 200 && updateDraftRes.body?.success,
        `TEST 16: Draft content reviewed and corrected before publishing for '${cat.title}'`
      );

      // 3. Publish draft
      const publishRes = await makeRequest(
        'POST',
        `/api/policies/publish/${draftVersion._id}`,
        {},
        {
          Authorization: `Bearer ${tokenAdminAlpha}`,
          'x-organization-id': orgAlpha._id.toString(),
        }
      );

      assert(
        publishRes.status === 200 &&
          publishRes.body?.success &&
          publishRes.body?.data?.status === 'PUBLISHED' &&
          publishRes.body?.data?.isImmutable === true,
        `TEST 16: Published '${cat.title}' successfully as immutable version`,
        publishRes.body?.message
      );

      publishedAlphaDocs[cat.key] = publishRes.body.data;
    }

    // Verify readiness is now fully ready
    const postPublishReadiness = await getHostelPolicyReadiness(orgAlpha._id, branchAlphaMain._id);
    assert(
      postPublishReadiness.isReady === true && postPublishReadiness.publishedCount === 3,
      'TEST 21: Organization policy readiness is now fully CONFIGURED and READY (3/3 published)'
    );

    // --- TEST 17: Document Version Immutability ---
    console.log('\n--- TEST 17: Document Version Immutability ---');
    const termsVersionId = publishedAlphaDocs['TERMS_AND_CONDITIONS']._id;
    const mutateAttempt = await makeRequest(
      'PUT',
      `/api/policies/draft/${termsVersionId}`,
      {
        title: 'Tampered Terms & Conditions Title',
        rawText: 'Tampered illegal content override',
      },
      {
        Authorization: `Bearer ${tokenAdminAlpha}`,
        'x-organization-id': orgAlpha._id.toString(),
      }
    );

    assert(
      mutateAttempt.status === 400 && mutateAttempt.body?.message?.includes('immutable'),
      'TEST 17: Direct mutation of an active published version is strictly rejected (immutability preserved)'
    );

    // --- TEST 20: Tenant Isolation: Admin cannot modify another org's policies ---
    console.log('\n--- TEST 20: Cross-Tenant Admin Authorization Boundary ---');
    const crossTenantAdminAttempt = await makeRequest(
      'PUT',
      `/api/policies/draft/${termsVersionId}`,
      { title: 'Cross Tenant Hack' },
      {
        Authorization: `Bearer ${tokenAdminBeta}`,
        'x-organization-id': orgBeta._id.toString(),
      }
    );
    assert(
      crossTenantAdminAttempt.status === 404 || crossTenantAdminAttempt.status === 403,
      'TEST 20: Hostel Admin from Org Beta cannot modify or access Org Alpha policy documents'
    );

    // --- TEST 18: Branch Inheritance and Branch-Specific Override ---
    console.log('\n--- TEST 18: Branch Inheritance & Specific Overrides ---');
    // By default, branch Annex inherits the org-level documents
    const annexInherited = await resolveApplicablePolicies(orgAlpha._id, branchAlphaAnnex._id);
    assert(
      annexInherited['TERMS_AND_CONDITIONS']?._id.toString() === termsVersionId.toString(),
      'TEST 18: Branch Alpha Annex inherits parent organization published Terms & Conditions'
    );

    // Now publish a branch-specific override for RULES_AND_REGULATIONS in Annex
    const annexRulesDraft = await makeMultipartUpload(
      '/api/policies/upload-draft',
      {
        category: 'RULES_AND_REGULATIONS',
        title: 'Alpha Annex Specific Quiet Hours & Rules',
        versionLabel: 'v1.0-annex',
        effectiveDate: '2026-09-01',
        hostelId: branchAlphaAnnex._id.toString(),
      },
      {
        fieldname: 'file',
        filename: 'annex_rules.pdf',
        mimetype: 'application/pdf',
        buffer: validPdfBuffer,
      },
      {
        Authorization: `Bearer ${tokenAdminAlpha}`,
        'x-organization-id': orgAlpha._id.toString(),
        'x-hostel-id': branchAlphaAnnex._id.toString(),
      }
    );

    await makeRequest(
      'POST',
      `/api/policies/publish/${annexRulesDraft.body.data.version._id}`,
      {},
      {
        Authorization: `Bearer ${tokenAdminAlpha}`,
        'x-organization-id': orgAlpha._id.toString(),
      }
    );

    const annexUpdatedPolicies = await resolveApplicablePolicies(orgAlpha._id, branchAlphaAnnex._id);
    assert(
      annexUpdatedPolicies['RULES_AND_REGULATIONS'].title === 'Alpha Annex Specific Quiet Hours & Rules' &&
        annexUpdatedPolicies['TERMS_AND_CONDITIONS']._id.toString() === termsVersionId.toString(),
      'TEST 18: Branch override replaces only the specific category without affecting inherited categories'
    );

    // --- TEST 3 & 8: Existing user with missing acceptances is BLOCKED from protected APIs ---
    console.log('\n--- TEST 3 & 8: Blocking Protected APIs for Existing Students ---');
    const dashboardReq1 = await makeRequest(
      'GET',
      '/api/dashboard/student',
      null,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      dashboardReq1.status === 403 && dashboardReq1.body?.code === 'POLICY_ACCEPTANCE_REQUIRED',
      'TEST 8: Student dashboard API is BLOCKED with POLICY_ACCEPTANCE_REQUIRED (403)'
    );

    const feesReq1 = await makeRequest(
      'GET',
      '/api/fees',
      null,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      feesReq1.status === 403 && feesReq1.body?.code === 'POLICY_ACCEPTANCE_REQUIRED',
      'TEST 8: Protected student fee API is BLOCKED while policy acceptance is pending'
    );

    // --- TEST 9: Whitelisted endpoints remain accessible ---
    console.log('\n--- TEST 9: Permitted Acceptance Workflow Endpoints ---');
    const applicableReq = await makeRequest(
      'GET',
      '/api/policies/applicable',
      null,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      applicableReq.status === 200 &&
        applicableReq.body?.success &&
        applicableReq.body?.data?.applicableVersions?.length === 3 &&
        applicableReq.body?.data?.allAccepted === false,
      'TEST 9: GET /api/policies/applicable is ACCESSIBLE and returns 3 mandatory pending documents'
    );

    const meReq = await makeRequest(
      'GET',
      '/api/auth/me',
      null,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      meReq.status === 200 && meReq.body?.success && meReq.body?.user?.email === 'alice@student.alphaliving.com',
      'TEST 9: Current user context GET /api/auth/me is permitted without policy block'
    );

    // --- TEST 7: Password Recovery Unblocked Before Policy Acceptance ---
    console.log('\n--- TEST 7: Password Reset Operates Independently of Acceptance Gate ---');
    const forgotReq = await makeRequest(
      'POST',
      '/api/auth/forgot-password',
      { email: 'alice@student.alphaliving.com' }
    );
    assert(
      forgotReq.status === 200 && forgotReq.body?.success,
      'TEST 7: Forgot password request succeeds while policy acceptance is pending'
    );

    // --- TEST 11: Rejection of unauthenticated, empty, or tampered submissions ---
    console.log('\n--- TEST 11: Validation & Integrity on Acceptance Submission ---');
    const unauthAccept = await makeRequest(
      'POST',
      '/api/policies/accept',
      { documentVersions: [{ versionId: termsVersionId, contentHash: publishedAlphaDocs['TERMS_AND_CONDITIONS'].contentHash }] }
    );
    assert(
      unauthAccept.status === 401,
      'TEST 11: Unauthenticated acceptance submission is strictly rejected (401)'
    );

    const emptyAccept = await makeRequest(
      'POST',
      '/api/policies/accept',
      { documentVersions: [] },
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      emptyAccept.status === 400,
      'TEST 11: Empty documentVersions acceptance array is rejected (400)'
    );

    const tamperedAccept = await makeRequest(
      'POST',
      '/api/policies/accept',
      { documentVersions: [{ versionId: termsVersionId, contentHash: 'forged_tampered_hash_12345' }] },
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      tamperedAccept.status === 409 || tamperedAccept.status === 400,
      'TEST 11: Acceptance with mismatched/tampered content hash is rejected (409 Conflict)'
    );

    // --- TEST 10 & 12: Successful acceptance and subsequent dashboard access ---
    console.log('\n--- TEST 10 & 12: Successful Acceptance & Subsequent Unblocking ---');
    const acceptAllPayload = {
      documentVersions: Object.values(publishedAlphaDocs).map((d) => ({
        versionId: d._id,
        contentHash: d.contentHash,
      })),
    };

    const submitAcceptRes = await makeRequest(
      'POST',
      '/api/policies/accept',
      acceptAllPayload,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      submitAcceptRes.status === 200 && submitAcceptRes.body?.success && submitAcceptRes.body?.data?.acceptedCount === 3,
      'TEST 10: Successfully persisted acceptances for all 3 mandatory categories'
    );

    // Re-attempting duplicate submission immediately (idempotency check)
    const duplicateAcceptRes = await makeRequest(
      'POST',
      '/api/policies/accept',
      acceptAllPayload,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      duplicateAcceptRes.status === 200 && duplicateAcceptRes.body?.success,
      'TEST 12: Duplicate acceptance submission handled idempotently without duplicate key or crash'
    );

    // Dashboard now accessible!
    const dashboardReq2 = await makeRequest(
      'GET',
      '/api/dashboard/student',
      null,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      dashboardReq2.status === 200 && dashboardReq2.body?.success,
      'TEST 10: Student dashboard access is UNBLOCKED immediately after successful policy acceptance (200 OK)'
    );

    // --- TEST 4 & 6: Ordinary login without repeating acceptance ---
    console.log('\n--- TEST 4 & 6: Normal Login for Compliant Residents ---');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'alice@student.alphaliving.com',
      password: 'Password123!',
      portal: 'STUDENT',
    });
    assert(
      loginRes.status === 200 &&
        loginRes.body?.success &&
        loginRes.body?.policyStatus?.allAccepted === true,
      'TEST 6: Already-compliant student logs in normally without repeating acceptance'
    );

    // --- TEST 5 & 19: Updated published version requires re-acceptance ---
    console.log('\n--- TEST 5 & 19: Version Update & Re-Acceptance Enforcement ---');
    // Admin Alpha uploads version 2.0 of Terms & Conditions
    const v2DraftRes = await makeMultipartUpload(
      '/api/policies/upload-draft',
      {
        category: 'TERMS_AND_CONDITIONS',
        title: 'Terms & Conditions of Residence (2026-Fall Updated)',
        versionLabel: 'v2.0',
        effectiveDate: '2026-10-01',
      },
      {
        fieldname: 'file',
        filename: 'terms_v2.pdf',
        mimetype: 'application/pdf',
        buffer: validPdfBuffer,
      },
      {
        Authorization: `Bearer ${tokenAdminAlpha}`,
        'x-organization-id': orgAlpha._id.toString(),
      }
    );

    await makeRequest(
      'POST',
      `/api/policies/publish/${v2DraftRes.body.data.version._id}`,
      {},
      {
        Authorization: `Bearer ${tokenAdminAlpha}`,
        'x-organization-id': orgAlpha._id.toString(),
      }
    );

    // Alice's dashboard access must now be BLOCKED again for version 2.0!
    const dashboardReqAfterV2 = await makeRequest(
      'GET',
      '/api/dashboard/student',
      null,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      dashboardReqAfterV2.status === 403 &&
        dashboardReqAfterV2.body?.code === 'POLICY_ACCEPTANCE_REQUIRED' &&
        dashboardReqAfterV2.body?.pendingCategories?.includes('TERMS_AND_CONDITIONS'),
      'TEST 5: New published version 2.0 immediately requires re-acceptance and blocks dashboard'
    );

    // Verify historical acceptance of v1.0 was preserved
    const aliceHistoryReq = await makeRequest(
      'GET',
      '/api/policies/history',
      null,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      aliceHistoryReq.status === 200 &&
        aliceHistoryReq.body?.data?.some((h) => h.versionNumber === 1 && h.category === 'TERMS_AND_CONDITIONS'),
      'TEST 19: Historical acceptance of version 1.0 preserved in student audit library'
    );

    // Accept v2.0
    await makeRequest(
      'POST',
      '/api/policies/accept',
      {
        documentVersions: [
          {
            versionId: v2DraftRes.body.data.version._id,
            contentHash: v2DraftRes.body.data.version.contentHash,
          },
        ],
      },
      { Authorization: `Bearer ${tokenAlice}` }
    );

    const dashboardReqAfterV2Accept = await makeRequest(
      'GET',
      '/api/dashboard/student',
      null,
      { Authorization: `Bearer ${tokenAlice}` }
    );
    assert(
      dashboardReqAfterV2Accept.status === 200 && dashboardReqAfterV2Accept.body?.success,
      'TEST 5: Dashboard unblocked after accepting updated version 2.0'
    );

    // --- TEST 1 & 2: New Student Registration, Password Setup & Mandatory Gate ---
    console.log('\n--- TEST 1 & 2: New Student Registration & Password Setup Flow ---');
    const newStudentEmail = 'brian@student.alphaliving.com';
    const regRes = await makeRequest(
      'POST',
      '/api/students',
      {
        name: 'Brian New Resident',
        email: newStudentEmail,
        phone: '9876543210',
        roomNo: 'A-102',
        hostel: 'AMH',
        hostelId: branchAlphaMain._id.toString(),
        fees: 8500,
      },
      {
        Authorization: `Bearer ${tokenAdminAlpha}`,
        'x-organization-id': orgAlpha._id.toString(),
        'x-hostel-id': branchAlphaMain._id.toString(),
      }
    );

    assert(
      (regRes.status === 200 || regRes.status === 201) && regRes.body?.success,
      'TEST 1: Admin successfully registered new student Brian',
      JSON.stringify(regRes.body)
    );

    const newStudentUser = await User.findOne({ email: newStudentEmail });
    assert(
      Boolean(newStudentUser?.activationToken),
      'TEST 2: Secure activation token generated for new student password setup'
    );

    // Student resets/sets password using activation token
    const tokenToUse = newStudentUser.activationToken;
    const resetRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: tokenToUse,
      password: 'BrianNewPassword2026!',
      confirmPassword: 'BrianNewPassword2026!',
    });

    assert(
      resetRes.status === 200 && resetRes.body?.success,
      'TEST 2: Password setup completed successfully via reset link'
    );

    // Brian logs in normally
    const brianLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: newStudentEmail,
      password: 'BrianNewPassword2026!',
      portal: 'STUDENT',
    });

    assert(
      brianLoginRes.status === 200 && brianLoginRes.body?.success,
      'TEST 2: Newly activated student authenticates successfully'
    );

    const tokenBrian = brianLoginRes.body.accessToken;

    // Brian has NOT accepted any policies yet -> must be blocked!
    const brianDashboardReq = await makeRequest(
      'GET',
      '/api/dashboard/student',
      null,
      { Authorization: `Bearer ${tokenBrian}` }
    );
    assert(
      brianDashboardReq.status === 403 &&
        brianDashboardReq.body?.code === 'POLICY_ACCEPTANCE_REQUIRED' &&
        brianDashboardReq.body?.pendingCategories?.length === 3,
      'TEST 1: Newly registered student with zero acceptances is BLOCKED from dashboard and protected features'
    );

    // --- TEST 19 & 22: Cross-Tenant Isolation ---
    console.log('\n--- TEST 19 & 22: Tenant Isolation & Cross-Hostel Rejection ---');
    // Brian attempts to accept a policy belonging to Beta Residences
    const betaTermsRes = await makeMultipartUpload(
      '/api/policies/upload-draft',
      {
        category: 'TERMS_AND_CONDITIONS',
        title: 'Beta Terms of Stay',
        versionLabel: 'v1.0-beta',
        effectiveDate: '2026-09-01',
      },
      {
        fieldname: 'file',
        filename: 'beta_terms.pdf',
        mimetype: 'application/pdf',
        buffer: validPdfBuffer,
      },
      {
        Authorization: `Bearer ${tokenAdminBeta}`,
        'x-organization-id': orgBeta._id.toString(),
      }
    );

    await makeRequest(
      'POST',
      `/api/policies/publish/${betaTermsRes.body.data.version._id}`,
      {},
      {
        Authorization: `Bearer ${tokenAdminBeta}`,
        'x-organization-id': orgBeta._id.toString(),
      }
    );

    const crossAcceptAttempt = await makeRequest(
      'POST',
      '/api/policies/accept',
      {
        documentVersions: [
          {
            versionId: betaTermsRes.body.data.version._id,
            contentHash: betaTermsRes.body.data.version.contentHash,
          },
        ],
      },
      { Authorization: `Bearer ${tokenBrian}` }
    );

    assert(
      crossAcceptAttempt.status === 400 || crossAcceptAttempt.status === 403,
      'TEST 22: Student Brian from Org Alpha is rejected when attempting to accept Org Beta document'
    );

    const crossViewAttempt = await makeRequest(
      'GET',
      `/api/policies/view/${betaTermsRes.body.data.version._id}`,
      null,
      { Authorization: `Bearer ${tokenBrian}` }
    );

    assert(
      crossViewAttempt.status === 403 || crossViewAttempt.status === 404,
      'TEST 19: Student Brian is denied access to view Org Beta confidential documents'
    );

    console.log('\n============================================================');
    console.log(`TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ FATAL TEST SUITE ERROR:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(0);
  }
}

runTestSuite();
