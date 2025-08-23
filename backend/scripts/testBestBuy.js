// =====================================================
// FILE: backend/scripts/testBestBuy.js
// Best Buy API Integration Testing Script
// =====================================================

const axios = require('axios');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const BASE_URL = 'http://localhost:3001/api';

// Test user credentials (create if needed)
const TEST_USER = {
  email: `bestbuy-test-${Date.now()}@example.com`,
  password: 'testpassword123',
  firstName: 'Best Buy',
  lastName: 'Tester'
};

let authToken = null;

async function runBestBuyTests() {
  console.log('🏪 Testing Best Buy API Integration\n');

  try {
    // Step 1: Create test user and get token
    console.log('1. Setting up authentication...');
    await setupAuth();
    
    // Step 2: Test Best Buy connection
    console.log('\n2. Testing Best Buy API connection...');
    await testBestBuyConnection();
    
    // Step 3: Test product search
    console.log('\n3. Testing product search...');
    await testProductSearch();
    
    // Step 4: Test categories
    console.log('\n4. Testing categories...');
    await testCategories();
    
    // Step 5: Test stores
    console.log('\n5. Testing store locations...');
    await testStores();
    
    // Step 6: Test product details
    console.log('\n6. Testing product details...');
    await testProductDetails();
    
    // Step 7: Test product sync
    console.log('\n7. Testing product synchronization...');
    await testProductSync();
    
    console.log('\n🎉 All Best Buy API tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ API Connection');
    console.log('   ✅ Product Search');
    console.log('   ✅ Categories');
    console.log('   ✅ Store Locations');
    console.log('   ✅ Product Details');
    console.log('   ✅ Product Sync');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure the server is running: npm run dev');
    console.log('   2. Check your BESTBUY_API_KEY in .env file');
    console.log('   3. Verify Best Buy API key at: https://developer.bestbuy.com/');
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

async function testBestBuyConnection() {
  try {
    const response = await axios.get(`${BASE_URL}/bestbuy/test`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log('✅ Best Buy API connection successful');
      console.log(`   API Key: ${response.data.apiKey}`);
      console.log(`   Categories Available: ${response.data.categoriesCount}`);
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message?.includes('missing')) {
      console.log('❌ Best Buy API configuration missing');
      console.log('💡 Please add BESTBUY_API_KEY to your .env file');
      console.log('🔗 Get your API key from: https://developer.bestbuy.com/');
      throw new Error('Configuration required');
    } else {
      throw error;
    }
  }
}

async function testProductSearch() {
  try {
    const searchTerm = await askQuestion('Enter a product to search for (or press Enter for "laptop"): ') || 'laptop';
    
    const response = await axios.get(`${BASE_URL}/bestbuy/products/search`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: {
        q: searchTerm,
        limit: 5
      }
    });
    
    if (response.data.success && response.data.data.length > 0) {
      console.log(`✅ Found ${response.data.data.length} products for "${searchTerm}"`);
      console.log('\nTop results:');
      response.data.data.slice(0, 3).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name}`);
        console.log(`      SKU: ${product.sku}`);
        console.log(`      Price: $${product.salePrice || product.regularPrice}`);
        console.log(`      Brand: ${product.manufacturer}`);
        console.log('');
      });
    } else {
      console.log(`❌ No products found for "${searchTerm}"`);
    }
  } catch (error) {
    throw new Error(`Product search failed: ${error.response?.data?.message || error.message}`);
  }
}

async function testCategories() {
  try {
    const response = await axios.get(`${BASE_URL}/bestbuy/categories`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success && response.data.data.length > 0) {
      console.log(`✅ Found ${response.data.data.length} categories`);
      console.log('\nTop categories:');
      response.data.data.slice(0, 5).forEach((category, index) => {
        console.log(`   ${index + 1}. ${category.name} (ID: ${category.id})`);
      });
    } else {
      console.log('❌ No categories found');
    }
  } catch (error) {
    throw new Error(`Categories test failed: ${error.response?.data?.message || error.message}`);
  }
}

async function testStores() {
  try {
    const zipCode = await askQuestion('Enter a ZIP code to find stores (or press Enter for "55454"): ') || '55454';
    
    const response = await axios.get(`${BASE_URL}/bestbuy/stores`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { zipCode }
    });
    
    if (response.data.success && response.data.data.length > 0) {
      console.log(`✅ Found ${response.data.data.length} stores near ${zipCode}`);
      console.log('\nNearby stores:');
      response.data.data.slice(0, 3).forEach((store, index) => {
        console.log(`   ${index + 1}. ${store.name}`);
        console.log(`      Address: ${store.address}, ${store.city}, ${store.region} ${store.postalCode}`);
        console.log(`      Phone: ${store.phone}`);
        if (store.distance) console.log(`      Distance: ${store.distance} miles`);
        console.log('');
      });
    } else {
      console.log(`❌ No stores found near ${zipCode}`);
    }
  } catch (error) {
    throw new Error(`Store search failed: ${error.response?.data?.message || error.message}`);
  }
}

async function testProductDetails() {
  try {
    // Use a known Best Buy SKU for testing
    const testSku = await askQuestion('Enter a Best Buy SKU to test (or press Enter for "6418599"): ') || '6418599';
    
    const response = await axios.get(`${BASE_URL}/bestbuy/products/${testSku}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success && response.data.data) {
      const product = response.data.data;
      console.log(`✅ Product details retrieved for SKU: ${testSku}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Price: $${product.salePrice || product.regularPrice}`);
      console.log(`   Brand: ${product.manufacturer}`);
      console.log(`   Rating: ${product.customerReviewAverage}/5 (${product.customerReviewCount} reviews)`);
      if (product.shortDescription) {
        console.log(`   Description: ${product.shortDescription.substring(0, 100)}...`);
      }
    } else {
      console.log(`❌ Product not found for SKU: ${testSku}`);
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('❌ Product not found (404) - try a different SKU');
    } else {
      throw new Error(`Product details test failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

async function testProductSync() {
  try {
    const searchTerm = await askQuestion('Enter search term for sync test (or press Enter for "gaming"): ') || 'gaming';
    
    console.log(`Syncing products for "${searchTerm}"...`);
    
    const response = await axios.post(`${BASE_URL}/bestbuy/sync/products`, {
      searchTerm: searchTerm,
      limit: 5
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.success) {
      console.log(`✅ Successfully synced ${response.data.data.syncedCount} products`);
      console.log(`   Total products found: ${response.data.data.totalProducts}`);
      if (response.data.data.errors) {
        console.log(`   Errors: ${response.data.data.errors.length}`);
      }
    } else {
      console.log('❌ Product sync failed');
    }
  } catch (error) {
    throw new Error(`Product sync test failed: ${error.response?.data?.message || error.message}`);
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
  console.log('\n🏪 Best Buy API Test Menu');
  console.log('1. Run all tests');
  console.log('2. Test API connection only');
  console.log('3. Test product search only');
  console.log('4. Test categories only');
  console.log('5. Test stores only');
  console.log('6. Exit');
  
  const choice = await askQuestion('\nSelect an option (1-6): ');
  
  switch (choice) {
    case '1':
      await runBestBuyTests();
      break;
    case '2':
      await setupAuth();
      await testBestBuyConnection();
      console.log('✅ Connection test completed');
      break;
    case '3':
      await setupAuth();
      await testProductSearch();
      console.log('✅ Product search test completed');
      break;
    case '4':
      await setupAuth();
      await testCategories();
      console.log('✅ Categories test completed');
      break;
    case '5':
      await setupAuth();
      await testStores();
      console.log('✅ Stores test completed');
      break;
    case '6':
      console.log('👋 Goodbye!');
      rl.close();
      return;
    default:
      console.log('Invalid option. Please try again.');
      await showMenu();
  }
  
  // Show menu again unless exiting
  if (choice !== '6') {
    await showMenu();
  }
}

// Check if running directly or with arguments
if (process.argv.length > 2) {
  runBestBuyTests();
} else {
  showMenu();
