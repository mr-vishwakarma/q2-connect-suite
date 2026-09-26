const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function testHostelApi() {
  try {
    console.log('1. Logging in as Admin Abhi1006...');
    const loginRes = await fetch('http://localhost:5000/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Abhi1006',
        password: 'Admin@123',
        portal: 'ADMIN',
      }),
    });

    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.error('Login failed:', loginData);
      return;
    }
    console.log('Login successful! Access token received.');
    const token = loginData.accessToken;
    console.log('Admin Org:', loginData.organization?.name, loginData.organization?._id);

    console.log('\n2. Testing GET /api/hostels...');
    const hostelRes = await fetch('http://localhost:5000/api/hostels', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const hostelData = await hostelRes.json();
    console.log('Hostel API Response Status:', hostelRes.status);
    console.log('Total Hostels returned:', hostelData.data?.length);
    if (hostelData.data && hostelData.data.length > 0) {
      hostelData.data.forEach((h) => {
        console.log(` - [${h._id}] Code: ${h.code}, Name: "${h.name}", Status: ${h.status}, Rooms: ${h.metrics?.roomCount}, Students: ${h.metrics?.studentCount}`);
      });
    } else {
      console.log('No hostels returned:', hostelData);
    }
  } catch (err) {
    console.error('Test error:', err);
  }
}

testHostelApi();
