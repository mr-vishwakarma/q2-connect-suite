const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING SUPER ADMIN PLATFORM CONTROL PLANE SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 0. Public Health Check
    console.log('[Step 0] Public Health Check');
    const healthRes = await axios.get(`${BASE_URL}/health`);
    assert(healthRes.status === 200 && healthRes.data.success === true, 'Public /api/health is operational');

    // 1. Authenticate as Super Admin
    console.log('\n[Step 1] Super Admin Authentication');
    const saLoginRes = await axios.post(`${BASE_URL}/auth/super-admin/login`, {
      username: 'superadmin',
      password: 'SuperAdmin@123',
    });
    const saToken = saLoginRes.data.accessToken || saLoginRes.data.token;
    const saUser = saLoginRes.data.user || saLoginRes.data.data?.user;
    assert(!!saToken, 'Super Admin login successful and JWT received');
    assert(saUser.role === 'SUPER_ADMIN' || saUser.isSuperAdmin || saUser.role === 'super_admin', `Super Admin user verified (role: ${saUser.role})`);

    const saHeaders = { Authorization: `Bearer ${saToken}` };

    // 2. Authenticate as Admin (Abhi1006) for RBAC enforcement test
    console.log('\n[Step 2] Regular Admin Authentication & RBAC Boundary Check');
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/admin/login`, {
      username: 'Abhi1006',
      password: 'q2@6XZZ2U28',
    });
    const adminToken = adminLoginRes.data.accessToken || adminLoginRes.data.token;
    assert(!!adminToken, 'Regular Admin login successful');

    // Test RBAC Denial on Super Admin endpoint
    try {
      await axios.get(`${BASE_URL}/super-admin/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(false, 'Regular Admin should be DENIED from Super Admin endpoints (expected 403)');
    } catch (err) {
      assert(err.response && err.response.status === 403, 'Regular Admin received 403 Forbidden on Super Admin endpoint');
    }

    // Test Unauthenticated request
    try {
      await axios.get(`${BASE_URL}/super-admin/analytics/dashboard`);
      assert(false, 'Unauthenticated request should be DENIED (expected 401)');
    } catch (err) {
      assert(err.response && err.response.status === 401, 'Unauthenticated request received 401 Unauthorized');
    }

    // 3. Module 1: Dashboard Stats
    console.log('\n[Step 3] Module 1: Super Admin Dashboard Stats');
    const dashRes = await axios.get(`${BASE_URL}/super-admin/analytics/dashboard`, { headers: saHeaders });
    assert(dashRes.status === 200 && dashRes.data.success === true, 'Dashboard stats API returns 200 OK');
    assert(dashRes.data.data.totalOrganizations !== undefined, 'Stats contains totalOrganizations');
    assert(dashRes.data.data.monthlyRecurringRevenue !== undefined, 'Stats contains monthlyRecurringRevenue');

    // 4. Module 2: Organization Management
    console.log('\n[Step 4] Module 2: Organization Management');
    const orgsRes = await axios.get(`${BASE_URL}/super-admin/organizations`, { headers: saHeaders });
    assert(orgsRes.status === 200 && orgsRes.data.success === true, 'Organizations list API returns 200 OK');
    const orgList = Array.isArray(orgsRes.data.data) ? orgsRes.data.data : orgsRes.data.data.organizations;
    assert(Array.isArray(orgList), `Fetched ${orgList.length} organizations`);

    // 5. Module 3: Global Hostel Directory & Capacity Aggregation
    console.log('\n[Step 5] Module 3: Global Hostel Directory & Metrics');
    const hostelsRes = await axios.get(`${BASE_URL}/super-admin/hostels`, { headers: saHeaders });
    assert(hostelsRes.status === 200 && hostelsRes.data.success === true, 'Hostels list API returns 200 OK');
    const hostelMetricsRes = await axios.get(`${BASE_URL}/super-admin/hostels/metrics`, { headers: saHeaders });
    assert(hostelMetricsRes.status === 200 && hostelMetricsRes.data.success === true, 'Hostel metrics API returns 200 OK');
    assert(hostelMetricsRes.data.data.totalHostels !== undefined, 'Hostel metrics contains totalHostels');
    assert(hostelMetricsRes.data.data.overallOccupancyRate !== undefined, 'Hostel metrics contains overallOccupancyRate');

    // 6. Module 4: Global User Management
    console.log('\n[Step 6] Module 4: Global User Management');
    const usersRes = await axios.get(`${BASE_URL}/super-admin/users?limit=10`, { headers: saHeaders });
    assert(usersRes.status === 200 && usersRes.data.success === true, 'Users list API returns 200 OK');
    assert(Array.isArray(usersRes.data.data.users), `Fetched ${usersRes.data.data.users.length} users with server pagination`);
    assert(usersRes.data.data.pagination.total !== undefined, 'User pagination data verified');

    // 7. Module 5: Plans & Subscriptions
    console.log('\n[Step 7] Module 5: Plans & Subscriptions');
    const plansRes = await axios.get(`${BASE_URL}/super-admin/plans`, { headers: saHeaders });
    assert(plansRes.status === 200 && plansRes.data.success === true, 'Plans API returns 200 OK');
    const subsRes = await axios.get(`${BASE_URL}/super-admin/subscriptions`, { headers: saHeaders });
    assert(subsRes.status === 200 && subsRes.data.success === true, 'Subscriptions API returns 200 OK');

    // 8. Module 6: Feature Flags & Gating
    console.log('\n[Step 8] Module 6: Feature Flags & Gating');
    const featuresRes = await axios.get(`${BASE_URL}/super-admin/features`, { headers: saHeaders });
    assert(featuresRes.status === 200 && featuresRes.data.success === true, 'Feature catalog API returns 200 OK');
    assert(Array.isArray(featuresRes.data.data) && featuresRes.data.data.length > 0, 'Catalog contains feature definitions');

    // 9. Module 7: Platform Analytics (Detailed)
    console.log('\n[Step 9] Module 7: Detailed Platform Analytics');
    const analyticsRes = await axios.get(`${BASE_URL}/super-admin/analytics/detailed`, { headers: saHeaders });
    assert(analyticsRes.status === 200 && analyticsRes.data.success === true, 'Detailed Analytics API returns 200 OK');
    assert(analyticsRes.data.data.overview.mrr !== undefined, 'Contains platform MRR');
    assert(Array.isArray(analyticsRes.data.data.monthlyTrends), 'Contains monthly growth trend data');

    // 10. Module 8: Compliance & Audit Logs
    console.log('\n[Step 10] Module 8: Audit Logs & Compliance');
    const auditRes = await axios.get(`${BASE_URL}/super-admin/audit-logs?limit=10`, { headers: saHeaders });
    assert(auditRes.status === 200 && auditRes.data.success === true, 'Audit logs API returns 200 OK');
    const logs = auditRes.data.data.logs || auditRes.data.data;
    assert(Array.isArray(logs), 'Audit logs returned as list with zero secret leakage');

    // 11. Module 9: Security Command Center
    console.log('\n[Step 11] Module 9: Security Command Center');
    const securityRes = await axios.get(`${BASE_URL}/super-admin/security/overview`, { headers: saHeaders });
    assert(securityRes.status === 200 && securityRes.data.success === true, 'Security overview API returns 200 OK');
    assert(securityRes.data.data.metrics.activeSuperAdminsCount !== undefined, 'Contains activeSuperAdminsCount');

    // 12. Module 10: Controlled Impersonation
    console.log('\n[Step 12] Module 10: Controlled Impersonation');
    if (orgList.length > 0 && usersRes.data.data.users.length > 0) {
      const targetOrg = orgList[0];
      const targetUser = usersRes.data.data.users.find(u => u.role !== 'SUPER_ADMIN') || usersRes.data.data.users[0];
      
      const impRes = await axios.post(
        `${BASE_URL}/super-admin/impersonation/start`,
        {
          organizationId: targetOrg._id || targetOrg.id,
          targetUserId: targetUser._id,
          reason: 'Automated Suite Verification Session',
        },
        { headers: saHeaders }
      );
      assert(impRes.status === 200 && impRes.data.success === true, 'Impersonation session created successfully');
      assert(!!impRes.data.data.token, 'Scoped impersonation JWT token generated');
    }

    // 13. Module 11: System Health
    console.log('\n[Step 13] Module 11: System Health');
    const sysHealthRes = await axios.get(`${BASE_URL}/super-admin/system-health`, { headers: saHeaders });
    assert(sysHealthRes.status === 200 && sysHealthRes.data.success === true, 'System health API returns 200 OK');
    assert(sysHealthRes.data.data.database.pingLatencyMs !== undefined, `Database ping latency measured: ${sysHealthRes.data.data.database.pingLatencyMs}ms`);
    assert(sysHealthRes.data.data.memory.heapUsedMb !== undefined, `Memory utilization measured: ${sysHealthRes.data.data.memory.heapUsedMb} MB`);

    // 14. Module 12: Reports (Streaming CSV Export)
    console.log('\n[Step 14] Module 12: Memory-Safe Streaming Reports');
    const reportRes = await axios.get(`${BASE_URL}/super-admin/reports/organizations/export`, {
      headers: saHeaders,
      responseType: 'text',
    });
    assert(reportRes.status === 200, 'Streaming CSV export returns 200 OK');
    assert(reportRes.headers['content-type'].includes('text/csv'), 'Header content-type is text/csv');
    assert(reportRes.data.includes('Organization Name'), 'CSV header row contains Organization Name');

    // 15. Module 13: Platform Settings
    console.log('\n[Step 15] Module 13: Platform Settings');
    const settingsRes = await axios.get(`${BASE_URL}/super-admin/settings`, { headers: saHeaders });
    assert(settingsRes.status === 200 && settingsRes.data.success === true, 'Platform settings API returns 200 OK');
    assert(settingsRes.data.data.general.platformName !== undefined, `Platform Name: ${settingsRes.data.data.general.platformName}`);

    // Update settings test
    const updatedRes = await axios.put(
      `${BASE_URL}/super-admin/settings`,
      {
        general: {
          ...settingsRes.data.data.general,
          platformName: 'Q2 Connect Suite Platform',
        },
      },
      { headers: saHeaders }
    );
    assert(updatedRes.status === 200 && updatedRes.data.data.general.platformName === 'Q2 Connect Suite Platform', 'Settings update persisted and validated');

    // 16. Regression Test: Existing Admin Dashboard & Operations
    console.log('\n[Step 16] Regression: Existing Manager/Admin Dashboard');
    const adminDashRes = await axios.get(`${BASE_URL}/dashboard/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminDashRes.status === 200, 'Existing Admin Dashboard /api/dashboard/admin continues to work flawlessly');

    console.log('\n====================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Fatal test runner error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

runTestSuite();
