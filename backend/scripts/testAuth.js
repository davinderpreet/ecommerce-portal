// =====================================================
// FILE: backend/scripts/testAuth.js
// =====================================================
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testAuthSystem() {
  console.log('🧪 Testing Authentication System\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.message);

    // Test 2: Register User
    console.log('\n2. Testing user registration...');
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'User'
    };

    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log('✅ Registration passed:', registerResponse.data.message);
    const token = registerResponse.data.token;

    // Test 3: Login
    console.log('\n3. Testing user login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ Login passed:', loginResponse.data.message);

    // Test 4: Protected Route
    console.log('\n4. Testing protected route...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('✅ Protected route passed:', profileResponse.data.data.email);

    // Test 5: Invalid Token
    console.log('\n5. Testing invalid token...');
    try {
      await axios.get(`${BASE_URL}/auth/profile`, {
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      });
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Invalid token correctly rejected');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 All authentication tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Health check');
    console.log('   ✅ User registration'); 
    console.log('   ✅ User login');
    console.log('   ✅ Protected routes');
    console.log('   ✅ Token validation');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.log('\n💡 Make sure the server is running: npm run dev');
  }
}

testAuthSystem();
