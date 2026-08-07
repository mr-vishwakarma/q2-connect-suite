const axios = require('axios');
const API_URL = 'https://q2-connect-api.onrender.com/api';

async function check() {
  for (let i = 0; i < 15; i++) {
    console.log(`[Attempt ${i+1}] Checking Render login endpoint...`);
    try {
      await axios.post(`${API_URL}/auth/admin/login`, {
        email: 'Abhi1006',
        password: 'q2@6XZZ2U28'
      });
      console.log('SUCCESS! Render has deployed the fix!');
      return;
    } catch (error) {
      if (error.response) {
        console.log(`STATUS: ${error.response.status}, MESSAGE: ${JSON.stringify(error.response.data)}`);
        if (error.response.status === 200 || (error.response.data && error.response.data.success)) {
          console.log('SUCCESS! Render has deployed the fix!');
          return;
        }
      } else {
        console.log(`ERROR: ${error.message}`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 20000)); // wait 20s
  }
  console.log('Polling completed. If still status 500, check Render build logs.');
}
check();
