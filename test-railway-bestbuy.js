// Quick BestBuy Connection Test for Railway Deployment
const axios = require('axios');

const RAILWAY_URL = 'https://ecommerce-portal-production.up.railway.app/api';

async function testRailwayBestBuy() {
  console.log('🚀 Testing BestBuy connection on Railway deployment...\n');

  try {
    // Step 1: Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${RAILWAY_URL}/health`);
    console.log('✅ Health check passed');
    console.log(`   Integrations: ${JSON.stringify(healthResponse.data.integrations)}\n`);

    // Step 2: Register/login test user
    console.log('2. Setting up authentication...');
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'testpass123',
      firstName: 'Test',
      lastName: 'User'
    };

    let authToken;
    try {
      const registerResponse = await axios.post(`${RAILWAY_URL}/auth/register`, testUser);
      authToken = registerResponse.data.token;
      console.log('✅ Test user registered and authenticated\n');
    } catch (error) {
      if (error.response?.status === 400) {
        // Try login instead
        const loginResponse = await axios.post(`${RAILWAY_URL}/auth/login`, {
          email: testUser.email,
          password: testUser.password
        });
        authToken = loginResponse.data.token;
        console.log('✅ Logged in with existing user\n');
      } else {
        throw error;
      }
    }

    // Step 3: Test BestBuy connection
    console.log('3. Testing BestBuy API connection...');
    const bestbuyResponse = await axios.get(`${RAILWAY_URL}/bestbuy/test`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (bestbuyResponse.data.success) {
      console.log('✅ BestBuy connection successful!');
      console.log(`   Platform: ${bestbuyResponse.data.platform || 'Mirakl'}`);
      console.log(`   API Key: ${bestbuyResponse.data.apiKey || 'Hidden'}`);
      
      if (bestbuyResponse.data.data) {
        console.log(`   Account Info: ${JSON.stringify(bestbuyResponse.data.data, null, 2)}`);
      }
    } else {
      console.log('❌ BestBuy connection failed:', bestbuyResponse.data.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 400 && error.response.data.message?.includes('missing')) {
      console.log('\n💡 Environment variables may not be configured in Railway:');
      console.log('   - BESTBUY_CANADA_API_KEY');
      console.log('   - BESTBUY_CANADA_SHOP_ID (optional)');
    }
    
    if (error.response?.data?.troubleshooting) {
      console.log('\n💡 Troubleshooting suggestions:');
      Object.entries(error.response.data.troubleshooting).forEach(([key, value]) => {
        console.log(`   - ${key}: ${value}`);
      });
    }
  }
}

// Run the test
testRailwayBestBuy();
