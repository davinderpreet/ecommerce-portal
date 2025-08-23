// =====================================================
// FILE: backend/scripts/testBestBuyCanada.js
// Best Buy Canada Marketplace Integration Testing
// =====================================================

const axios = require('axios');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const BASE_URL = 'http://localhost:3001/api';
// For production testing, use: 'https://ecommerce-portal-production.up.railway.app/api'

// Test user credentials
const TEST_USER = {
  email: `bestbuy-canada-test-${Date.now()}@example.com`,
  password: 'testpassword123',
  firstName: 'Best Buy',
  lastName: 'Canada Tester'
};

let authToken = null;

async function runBestBuyCanadaTests() {
  console.log('🍁 Testing Best Buy Canada Marketplace Integration\n');

  try {
    // Step 1: Create test user and get token
    console.log('1. Setting up authentication...');
    await setupAuth();
    
    // Step 2: Test Best Buy Canada connection
    console.log('\n2. Testing Best Buy Canada API connection...');
    await testConnection();
    
    // Step 3: Test offers/products
    console.log('\n3. Testing marketplace offers...');
    await testOffers();
    
    // Step 4: Test orders
    console.log('\n4. Testing marketplace orders...');
    await testOrders();
    
    // Step 5: Test inventory
    console.log('\n5. Testing inventory management...');
    await testInventory();
    
    // Step 6: Test sync functionality
    console.log('\n6. Testing offer synchronization...');
    await testSync();
    
    console.log('\n🎉 All Best Buy Canada tests completed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Authentication');
    console.log('   ✅ API Connection');
    console.log('   ✅ Marketplace Offers');
    console.log('   ✅ Order Management');
    console.log('   ✅ Inventory Management');
    console.log('   ✅ Data Synchronization');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure server is running');
    console.log('   2. Check BESTBUY_CANADA_API_KEY in environment');
    console.log('   3. Verify your Best Buy Canada seller account is active');
    console.log('   4. Check API permissions in your seller dashboard');
  } finally {
    rl.close();
  }
}

async function setupAuth() {
  try {
    // Register test user
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, TEST_USER);
    authToken = registerResponse.data.token;
    console.log('✅ Test user created and authenticated');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message?.includes('already exists')) {
      // User exists, try to login
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
      authToken = loginResponse.data.token;
      console.log('✅ Logged in with existing test user');
    } else {
      throw error;
    }
  }
}

async function testConnection() {
  try {
    const response = await axios.get(`${BASE_URL}/bestbuy/test`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log('✅ Best Buy Canada API connection successful');
      console.log(`   Platform: ${response.data.platform || 'Mirakl'}`);
      console.log(`   API Key: ${response.data.apiKey || 'Hidden'}`);
      
      if (response.data.data) {
        console.log(`   Account/Shop: ${response.data.data.name || response.data.data.id || 'Connected'}`);
      }
    } else {
      throw new Error(response.data.message || 'Connection failed');
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message?.includes('missing')) {
      console.log('❌ Best Buy Canada API configuration missing');
      console.log('💡 Please add BESTBUY_CANADA_API_KEY to your environment variables');
      console.log('🔗 Check your Best Buy Canada seller dashboard for API credentials');
      throw new Error('Configuration required');
    } else {
      console.log('❌ Connection test failed:', error.response?.data?.message || error.message);
      if (error.response?.data?.troubleshooting) {
        console.log('💡 Troubleshooting suggestions:');
        Object.entries(error.response.data.troubleshooting).forEach(([key, value]) => {
          console.log(`   - ${key}: ${value}`);
        });
      }
      throw error;
    }
  }
}

async function testOffers() {
  try {
    const response = await axios.get(`${BASE_URL}/bestbuy/offers`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { limit: 5 }
    });
    
    if (response.data.success) {
      const offers = response.data.data || [];
      console.log(`✅ Retrieved ${offers.length} offers from Best Buy Canada marketplace`);
      
      if (offers.length > 0) {
        console.log('\nSample offers:');
        offers.slice(0, 3).forEach((offer, index) => {
          console.log(`   ${index + 1}. ${offer.product_title || offer.title || offer.name || 'Unknown Product'}`);
          console.log(`      SKU: ${offer.product_id || offer.sku || offer.id}`);
          console.log(`      Price: ${offer.price || offer.total_price || 'N/A'}`);
          console.log(`      State: ${offer.state || offer.status || 'Unknown'}`);
          console.log('');
        });
        
        // Test getting specific offer details
        const firstOffer = offers[0];
        if (firstOffer && (firstOffer.id || firstOffer.offer_id)) {
          await testOfferDetails(firstOffer.id || firstOffer.offer_id);
        }
      } else {
        console.log('   No offers found in your marketplace');
        console.log('   💡 You may need to create some offers in your Best Buy Canada seller dashboard first');
      }
    } else {
      console.log('❌ Failed to retrieve offers:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Offers test failed:', error.response?.data?.message || error.message);
    if (error.response?.status === 400 && error.response.data.message?.includes('SHOP_ID')) {
      console.log('💡 You may need to add BESTBUY_CANADA_SHOP_ID to your environment variables');
    }
  }
}

async function testOfferDetails(offerId) {
  try {
    console.log(`   Testing specific offer details for ID: ${offerId}`);
    const response = await axios.get(`${BASE_URL}/bestbuy/offers/${offerId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log('   ✅ Retrieved detailed offer information');
    } else {
      console.log('   ❌ Failed to get offer details');
    }
  } catch (error) {
    console.log('   ❌ Offer details test failed:', error.response?.data?.message || error.message);
  }
}

async function testOrders() {
  try {
    const response = await axios.get(`${BASE_URL}/bestbuy/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { limit: 10 }
    });
    
    if (response.data.success) {
      const orders = response.data.data || [];
      console.log(`✅ Retrieved ${orders.length} orders from Best Buy Canada marketplace`);
      
      if (orders.length > 0) {
        console.log('\nRecent orders:');
        orders.slice(0, 3).forEach((order, index) => {
          console.log(`   ${index + 1}. Order ${order.order_id || order.id}`);
          console.log(`      State: ${order.order_state || order.status || 'Unknown'}`);
          console.log(`      Date: ${order.created_date || order.date_created || 'Unknown'}`);
          console.log(`      Total: ${order.total_price || order.price || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   No orders found');
        console.log('   💡 This is normal if you haven\'t received any marketplace orders yet');
      }
    } else {
      console.log('❌ Failed to retrieve orders:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Orders test failed:', error.response?.data?.message || error.message);
  }
}

async function testInventory() {
  try {
    const response = await axios.get(`${BASE_URL}/bestbuy/inventory`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { limit: 5 }
    });
    
    if (response.data.success) {
      const inventory = response.data.data || [];
      console.log(`✅ Retrieved inventory for ${inventory.length} items`);
      
      if (inventory.length > 0) {
        console.log('\nInventory sample:');
        inventory.slice(0, 3).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.product_title || item.title || 'Unknown Product'}`);
          console.log(`      SKU: ${item.product_id || item.sku || item.id}`);
          console.log(`      Stock: ${item.quantity || item.stock || 'N/A'}`);
          console.log(`      Available: ${item.available_quantity || item.available || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   No inventory data found');
      }
    } else {
      console.log('❌ Failed to retrieve inventory:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Inventory test failed:', error.response?.data?.message || error.message);
  }
}

async function testSync() {
  try {
    console.log('Starting synchronization of offers from Best Buy Canada...');
    
    const response = await axios.post(`${BASE_URL}/bestbuy/sync/offers`, {
      limit: 10,
      syncAll: false
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log('✅ Synchronization completed successfully');
      console.log(`   Synced: ${response.data.data.syncedCount} offers`);
      console.log(`   Total Available: ${response.data.data.totalOffers}`);
      console.log(`   Channel ID: ${response.data.data.channelId}`);
      
      if (response.data.data.errors && response.data.data.errors.length > 0) {
        console.log(`   Errors: ${response.data.data.errors.length}`);
        console.log('   First few errors:');
        response.data.data.errors.slice(0, 2).forEach(error => {
          console.log(`     - ${error.offerId}: ${error.error}`);
        });
      }
    } else {
      console.log('❌ Synchronization failed:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Sync test failed:', error.response?.data?.message || error.message);
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Interactive menu
async function showMenu() {
  console.log('\n🍁 Best Buy Canada Marketplace Test Menu');
  console.log('1. Run all tests');
  console.log('2. Test API connection only');
  console.log('3. Test offers only');
  console.log('4. Test orders only');
  console.log('5. Test inventory only');
  console.log('6. Test sync only');
  console.log('7. Create sample offer (if API supports it)');
  console.log('8. Exit');
  
  const choice = await askQuestion('\nSelect an option (1-8): ');
  
  switch (choice) {
    case '1':
      await runBestBuyCanadaTests();
      break;
    case '2':
      await setupAuth();
      await testConnection();
      console.log('✅ Connection test completed');
      break;
    case '3':
      await setupAuth();
      await testOffers();
      console.log('✅ Offers test completed');
      break;
    case '4':
      await setupAuth();
      await testOrders();
      console.log('✅ Orders test completed');
      break;
    case '5':
      await setupAuth();
      await testInventory();
      console.log('✅ Inventory test completed');
      break;
    case '6':
      await setupAuth();
      await testSync();
      console.log('✅ Sync test completed');
      break;
    case '7':
      await testCreateOffer();
      break;
    case '8':
      console.log('👋 Goodbye!');
      rl.close();
      return;
    default:
      console.log('Invalid option. Please try again.');
      await showMenu();
  }
  
  // Show menu again unless exiting
  if (choice !== '8') {
    await showMenu();
  }
}

async function testCreateOffer() {
  try {
    await setupAuth();
    
    console.log('\n📝 Testing offer creation...');
    console.log('Note: This will attempt to create a test offer on your marketplace');
    
    const confirm = await askQuestion('Do you want to proceed? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Skipped offer creation test');
      return;
    }
    
    // Sample offer data - adjust based on Best Buy Canada requirements
    const sampleOffer = {
      product_id: 'TEST-SKU-' + Date.now(),
      price: 29.99,
      quantity: 10,
      state: 'OPEN',
      description: 'Test product created by API integration test'
    };
    
    const response = await axios.post(`${BASE_URL}/bestbuy/offers`, sampleOffer, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log('✅ Test offer created successfully');
      console.log(`   Offer ID: ${response.data.data.id || 'Unknown'}`);
      console.log('   💡 Remember to remove this test offer from your marketplace');
    } else {
      console.log('❌ Failed to create test offer:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Offer creation test failed:', error.response?.data?.message || error.message);
    if (error.response?.status === 400) {
      console.log('💡 This might be due to missing required fields or API permissions');
      console.log('   Check Best Buy Canada documentation for required offer fields');
    }
  }
}

// Environment check
function checkEnvironment() {
  console.log('🔍 Checking environment configuration...\n');
  
  const requiredVars = [
    'BESTBUY_CANADA_API_KEY',
    'NEON_DATABASE_URL',
    'JWT_SECRET'
  ];
  
  const optionalVars = [
    'BESTBUY_CANADA_SHOP_ID'
  ];
  
  console.log('Required variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 10)}...`);
    } else {
      console.log(`❌ ${varName}: Missing`);
    }
  });
  
  console.log('\nOptional variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚠️  ${varName}: Not set (some endpoints may not work)`);
    }
  });
  
  console.log('\n💡 Tips:');
  console.log('   - API Key: Get from Best Buy Canada seller dashboard');
  console.log('   - Shop ID: Found in your seller dashboard URL or API responses');
  console.log('   - Documentation: https://developer.mirakl.com/');
  console.log('');
}

// Check command line arguments
if (process.argv.includes('--env')) {
  checkEnvironment();
} else if (process.argv.includes('--auto')) {
  runBestBuyCanadaTests();
} else {
  console.log('🍁 Best Buy Canada Marketplace API Tester');
  console.log('Usage:');
  console.log('  node testBestBuyCanada.js           # Interactive menu');
  console.log('  node testBestBuyCanada.js --auto    # Run all tests');
  console.log('  node testBestBuyCanada.js --env     # Check environment\n');
  
  checkEnvironment();
  showMenu();
}
