// =====================================================
// FILE: backend/scripts/setupBestBuy.js
// Best Buy Integration Setup and Configuration
// =====================================================

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Pool } = require('pg');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Database connection
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupBestBuyIntegration() {
  console.log('🏪 Setting up Best Buy API Integration\n');
  console.log('📋 This setup will:');
  console.log('   1. Check environment configuration');
  console.log('   2. Validate Best Buy API key');
  console.log('   3. Update channel configuration');
  console.log('   4. Test API connection');
  console.log('   5. Run sample product sync\n');

  try {
    // Step 1: Check environment configuration
    console.log('🔧 Step 1: Checking environment configuration...');
    await checkEnvironmentConfig();
    
    // Step 2: Validate API key
    console.log('\n🔑 Step 2: Validating Best Buy API key...');
    await validateApiKey();
    
    // Step 3: Update database configuration
    console.log('\n🗄️ Step 3: Updating channel configuration...');
    await updateChannelConfig();
    
    // Step 4: Test API connection
    console.log('\n🧪 Step 4: Testing API connection...');
    await testApiConnection();
    
    // Step 5: Run sample sync
    console.log('\n🔄 Step 5: Running sample product sync...');
    await runSampleSync();
    
    console.log('\n🎉 Best Buy integration setup completed successfully!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Start your server: npm run dev');
    console.log('   2. Test endpoints: node scripts/testBestBuy.js');
    console.log('   3. View API docs: Check backend/docs/bestbuy-api.md');
    console.log('   4. Begin Milestone 8: Data Sync Services\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   - Ensure you have a valid Best Buy API key');
    console.log('   - Check your internet connection');
    console.log('   - Verify database connectivity');
    console.log('   - Get API key from: https://developer.bestbuy.com/\n');
  } finally {
    await pool.end();
    rl.close();
  }
}

async function checkEnvironmentConfig() {
  const envPath = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found. Please create one using .env.example');
  }
  
  const requiredVars = [
    'NEON_DATABASE_URL',
    'JWT_SECRET',
    'BESTBUY_API_KEY'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    
    if (missingVars.includes('BESTBUY_API_KEY')) {
      console.log('\n💡 To get a Best Buy API key:');
      console.log('   1. Visit: https://developer.bestbuy.com/');
      console.log('   2. Create an account');
      console.log('   3. Register for an API key');
      console.log('   4. Add it to your .env file as BESTBUY_API_KEY=your_key_here');
    }
    
    throw new Error('Environment configuration incomplete');
  }
  
  console.log('✅ Environment configuration complete');
}

async function validateApiKey() {
  const apiKey = process.env.BESTBUY_API_KEY;
  
  if (!apiKey || apiKey.length < 10) {
    throw new Error('Invalid Best Buy API key format');
  }
  
  // Test API key with a simple request
  const axios = require('axios');
  try {
    const testUrl = `https://api.bestbuy.com/v1/categories?format=json&apikey=${apiKey}&pageSize=1`;
    const response = await axios.get(testUrl, { timeout: 10000 });
    
    if (response.status === 200 && response.data) {
      console.log('✅ Best Buy API key is valid');
      console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
    } else {
      throw new Error('API key validation failed');
    }
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('API key is invalid or expired');
    } else if (error.response?.status === 429) {
      throw new Error('API rate limit exceeded - try again later');
    } else {
      throw new Error(`API validation failed: ${error.message}`);
    }
  }
}

async function updateChannelConfig() {
  try {
    // Check if Best Buy channel exists
    const existingChannel = await pool.query(
      "SELECT id, api_config FROM channels WHERE channel_type = 'bestbuy'"
    );
    
    if (existingChannel.rows.length === 0) {
      // Create Best Buy channel
      await pool.query(
        `INSERT INTO channels (name, channel_type, api_config, is_active, sync_status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'Best Buy Partner',
          'bestbuy',
          JSON.stringify({
            api_key: process.env.BESTBUY_API_KEY,
            base_url: 'https://api.bestbuy.com/v1',
            environment: 'production',
            rate_limit: 5,
            timeout: 30000
          }),
          true,
          'ready'
        ]
      );
      console.log('✅ Created Best Buy channel configuration');
    } else {
      // Update existing channel
      await pool.query(
        `UPDATE channels SET 
         api_config = $1, 
         is_active = true, 
         sync_status = 'ready',
         updated_at = NOW()
         WHERE channel_type = 'bestbuy'`,
        [JSON.stringify({
          api_key: process.env.BESTBUY_API_KEY,
          base_url: 'https://api.bestbuy.com/v1',
          environment: 'production',
          rate_limit: 5,
          timeout: 30000
        })]
      );
      console.log('✅ Updated Best Buy channel configuration');
    }
  } catch (error) {
    throw new Error(`Database configuration failed: ${error.message}`);
  }
}

async function testApiConnection() {
  const axios = require('axios');
  
  try {
    // Test multiple endpoints to ensure full functionality
    const tests = [
      {
        name: 'Categories',
        url: `https://api.bestbuy.com/v1/categories?format=json&apikey=${process.env.BESTBUY_API_KEY}&pageSize=5`
      },
      {
        name: 'Product Search',
        url: `https://api.bestbuy.com/v1/products((search=laptop))?format=json&apikey=${process.env.BESTBUY_API_KEY}&pageSize=3&show=sku,name,salePrice`
      },
      {
        name: 'Store Locations',
        url: `https://api.bestbuy.com/v1/stores((storeType=BigBox&postalCode=55454))?format=json&apikey=${process.env.BESTBUY_API_KEY}&pageSize=2&show=storeId,name,city`
      }
    ];
    
    for (const test of tests) {
      try {
        const response = await axios.get(test.url, { timeout: 10000 });
        if (response.status === 200 && response.data) {
          console.log(`✅ ${test.name}: Working`);
        } else {
          console.log(`❌ ${test.name}: Failed`);
        }
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`);
      }
    }
    
  } catch (error) {
    throw new Error(`API connection test failed: ${error.message}`);
  }
}

async function runSampleSync() {
  try {
    const choice = await askQuestion('Run sample product sync? (y/n): ');
    
    if (choice.toLowerCase() !== 'y') {
      console.log('⏭️ Skipping sample sync');
      return;
    }
    
    const searchTerm = await askQuestion('Enter search term (or press Enter for "smartphone"): ') || 'smartphone';
    
    console.log(`Fetching products for "${searchTerm}"...`);
    
    const axios = require('axios');
    const url = `https://api.bestbuy.com/v1/products((search=${encodeURIComponent(searchTerm)}))?format=json&apikey=${process.env.BESTBUY_API_KEY}&pageSize=5&show=sku,name,salePrice,manufacturer,shortDescription`;
    
    const response = await axios.get(url, { timeout: 15000 });
    
    if (response.data && response.data.products) {
      const products = response.data.products;
      console.log(`✅ Found ${products.length} products:`);
      
      // Get Best Buy channel ID
      const channelResult = await pool.query(
        "SELECT id FROM channels WHERE channel_type = 'bestbuy' LIMIT 1"
      );
      const bestBuyChannelId = channelResult.rows[0]?.id;
      
      let syncedCount = 0;
      
      for (const product of products) {
        try {
          // Check if product exists
          const existingProduct = await pool.query(
            'SELECT id FROM products WHERE sku = $1',
            [product.sku]
          );
          
          let productId;
          
          if (existingProduct.rows.length === 0) {
            // Create new product
            const productResult = await pool.query(
              `INSERT INTO products (sku, name, description, brand, base_price) 
               VALUES ($1, $2, $3, $4, $5) RETURNING id`,
              [
                product.sku,
                product.name,
                product.shortDescription || 'No description',
                product.manufacturer || 'Unknown',
                product.salePrice || 0
              ]
            );
            productId = productResult.rows[0].id;
          } else {
            productId = existingProduct.rows[0].id;
          }
          
          // Create channel mapping if we have channel ID
          if (bestBuyChannelId) {
            await pool.query(
              `INSERT INTO channel_products 
               (product_id, channel_id, channel_sku, channel_product_id, channel_name, channel_price, sync_status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (product_id, channel_id) 
               DO UPDATE SET sync_status = 'completed', last_synced = NOW()`,
              [
                productId,
                bestBuyChannelId,
                product.sku,
                product.sku,
                product.name,
                product.salePrice || 0,
                'completed'
              ]
            );
          }
          
          console.log(`   ✅ ${product.name} (${product.sku}) - $${product.salePrice}`);
          syncedCount++;
          
        } catch (error) {
          console.log(`   ❌ ${product.name}: ${error.message}`);
        }
      }
      
      console.log(`✅ Successfully synced ${syncedCount}/${products.length} products`);
      
    } else {
      console.log('❌ No products found for the search term');
    }
    
  } catch (error) {
    throw new Error(`Sample sync failed: ${error.message}`);
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Run setup if called directly
if (require.main === module) {
  setupBestBuyIntegration();
}

module.exports = {
  setupBestBuyIntegration,
  checkEnvironmentConfig,
  validateApiKey,
  updateChannelConfig
};
