const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

function createMockGoogleIdToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'simulated_sig';
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function runTest() {
  console.log('=== TEST: 4-STAGE GOOGLE REGISTRATION & ADMIN APPROVAL WORKFLOW ===');
  const testEmail = `resident_test_${Date.now()}@gmail.com`;
  const googleToken = createMockGoogleIdToken({
    sub: `google_sub_${Date.now()}`,
    email: testEmail,
    name: 'Ananya Roy',
    picture: 'https://example.com/ananya.jpg',
  });

  // Stage 1: Student submits registration request
  console.log('\n[1] Submitting registration request via Google Auth...');
  const reqRes = await axios.post(`${API_BASE}/auth/request-google-registration`, {
    credential: googleToken,
    name: 'Ananya Roy',
    phone: '9876501234',
    hostel: 'Q2.0',
  });
  console.log('Stage 1 Result:', reqRes.data.status, '-', reqRes.data.message);
  if (reqRes.data.status !== 'pending_approval') {
    throw new Error('Expected status pending_approval');
  }

  // Stage 2: Student tries to log in with Google before approval
  console.log('\n[2] Attempting Google login while pending approval...');
  const loginBeforeApproval = await axios.post(`${API_BASE}/auth/google`, {
    credential: googleToken,
  });
  console.log('Login attempt result:', loginBeforeApproval.data.status, '-', loginBeforeApproval.data.message);
  if (loginBeforeApproval.data.status !== 'pending_approval') {
    throw new Error('Expected pending_approval on login attempt');
  }

  // Stage 3: Admin logs in & fetches pending registrations
  console.log('\n[3] Admin logging in to check pending registrations...');
  const adminLoginRes = await axios.post(`${API_BASE}/auth/admin/login`, {
    email: 'superadmin@q2connect.com',
    password: 'SuperAdmin@123',
  });
  const adminToken = adminLoginRes.data.accessToken;
  console.log('Admin logged in successfully.');

  const pendingRes = await axios.get(`${API_BASE}/students/pending-registrations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Found ${pendingRes.data.count} pending registrations.`);
  const pendingUser = pendingRes.data.data.find((u) => u.email === testEmail);
  if (!pendingUser) {
    throw new Error(`Test user ${testEmail} not found in pending list!`);
  }
  console.log('Found user in pending list:', pendingUser.name, pendingUser.email, 'ID:', pendingUser.id);

  // Stage 4: Admin approves the registration
  console.log('\n[4] Admin approving registration...');
  const approveRes = await axios.post(
    `${API_BASE}/students/approve-registration/${pendingUser.id}`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log('Approve result:', approveRes.data.message);

  // Stage 5: Student logs in with Google after approval
  console.log('\n[5] Student logging in with Google post-approval...');
  const loginAfterApproval = await axios.post(`${API_BASE}/auth/google`, {
    credential: googleToken,
  });
  console.log('Login post-approval result:', loginAfterApproval.data.status, 'canCompleteSetup:', loginAfterApproval.data.canCompleteSetup);
  if (!loginAfterApproval.data.canCompleteSetup || !loginAfterApproval.data.setupToken) {
    throw new Error('Expected canCompleteSetup: true with setupToken');
  }

  // Stage 6: Student chooses username & password
  console.log('\n[6] Student creating username and password...');
  const chosenUsername = `ananya_${Date.now().toString().slice(-4)}`;
  const setupRes = await axios.post(`${API_BASE}/auth/complete-google-setup`, {
    setupToken: loginAfterApproval.data.setupToken,
    username: chosenUsername,
    password: 'AnanyaPassword123!',
  });
  console.log('Step 2 result:', setupRes.data.message, 'Active Username:', setupRes.data.user.username);
  if (!setupRes.data.accessToken || setupRes.data.user.username !== chosenUsername) {
    throw new Error('Setup completion failed');
  }

  // Stage 7: Verify student can now log in with username and password
  console.log('\n[7] Verifying standard login with new username and password...');
  const pwdLoginRes = await axios.post(`${API_BASE}/auth/login`, {
    identifier: chosenUsername,
    password: 'AnanyaPassword123!',
  });
  console.log('Password login success! User:', pwdLoginRes.data.user.username, 'Role:', pwdLoginRes.data.user.role);

  console.log('\n🎉 ALL 7 STEPS PASSED PERFECTLY!');
}

runTest().catch((err) => {
  console.error('Test Failed:', err.response?.data || err.message);
  process.exit(1);
});
