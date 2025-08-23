/**
 * Test Script for Milestone 8: Data Sync Services
 * Tests sync endpoints, data mapping, and webhook functionality
 */

const axios = require('axios');

class SyncServiceTester {
  constructor() {
    this.baseUrl = process.env.RAILWAY_URL || 'https://ecommerce-portal-production-d5b5.up.railway.app';
    this.token = null;
  }

  /**
   * Authenticate and get JWT token
   */
  async authenticate() {
    try {
      console.log('🔐 Authenticating...');
      
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email: 'admin@ecommerce.com',
        password: 'admin123'
      });

      this.token = response.data.token;
      console.log('✅ Authentication successful');
      return true;

    } catch (error) {
      console.error('❌ Authentication failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Get request headers with auth token
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Test sync status endpoint
   */
  async testSyncStatus() {
    try {
      console.log('\n📊 Testing sync status endpoint...');
      
      const response = await axios.get(`${this.baseUrl}/api/sync/status`, {
        headers: this.getHeaders()
      });

      console.log('✅ Sync Status Response:');
      console.log('- Stats:', JSON.stringify(response.data.stats, null, 2));
      console.log('- Processing:', response.data.isProcessing);
      console.log('- Recent Logs Count:', response.data.recentLogs?.length || 0);

      return true;

    } catch (error) {
      console.error('❌ Sync status test failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Test data mapping functionality
   */
  async testDataMapping() {
    try {
      console.log('\n🔄 Testing data mapping...');

      // Test BestBuy product mapping
      const bestbuyProduct = {
        offer_id: 'TEST-OFFER-123',
        product_sku: 'TEST-SKU-456',
        product_title: 'Test Product',
        description: 'Test product description',
        brand: 'Test Brand',
        category_code: 'electronics',
        price: 99.99,
        quantity: 10,
        state: 11, // Active state
        date_created: '2024-02-23T12:00:00Z',
        last_updated: '2024-02-23T12:00:00Z'
      };

      const response = await axios.post(`${this.baseUrl}/api/sync/map-test`, {
        channelName: 'bestbuy',
        dataType: 'product',
        rawData: bestbuyProduct
      }, {
        headers: this.getHeaders()
      });

      console.log('✅ Data Mapping Test Successful:');
      console.log('- Original SKU:', bestbuyProduct.product_sku);
      console.log('- Mapped SKU:', response.data.mappedData.sku);
      console.log('- Mapped Name:', response.data.mappedData.name);
      console.log('- Mapped Price:', response.data.mappedData.price);

      return true;

    } catch (error) {
      console.error('❌ Data mapping test failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Test manual sync trigger
   */
  async testSyncTrigger() {
    try {
      console.log('\n🚀 Testing manual sync trigger...');

      // Get BestBuy channel ID (assuming it's 2 based on our setup)
      const response = await axios.post(`${this.baseUrl}/api/sync/trigger`, {
        channelId: 2, // BestBuy channel
        syncType: 'products',
        priority: 8
      }, {
        headers: this.getHeaders()
      });

      console.log('✅ Sync Trigger Successful:');
      console.log('- Job ID:', response.data.jobId);
      console.log('- Message:', response.data.message);

      return true;

    } catch (error) {
      console.error('❌ Sync trigger test failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Test webhook endpoints
   */
  async testWebhooks() {
    try {
      console.log('\n🔗 Testing webhook endpoints...');

      // Test webhook status
      const statusResponse = await axios.get(`${this.baseUrl}/api/webhooks/status`, {
        headers: this.getHeaders()
      });

      console.log('✅ Webhook Status Retrieved:');
      console.log('- Available Endpoints:', Object.keys(statusResponse.data.endpoints).length);
      
      // Test webhook (no auth required for webhooks)
      const testWebhookResponse = await axios.post(`${this.baseUrl}/api/webhooks/test`, {
        test: true,
        timestamp: new Date().toISOString(),
        source: 'sync-test-script'
      });

      console.log('✅ Test Webhook Successful:');
      console.log('- Response:', testWebhookResponse.data.message);

      return true;

    } catch (error) {
      console.error('❌ Webhook test failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Test sync logs endpoint
   */
  async testSyncLogs() {
    try {
      console.log('\n📋 Testing sync logs...');

      const response = await axios.get(`${this.baseUrl}/api/sync/logs?limit=5`, {
        headers: this.getHeaders()
      });

      console.log('✅ Sync Logs Retrieved:');
      console.log('- Total Logs:', response.data.pagination?.total || 0);
      console.log('- Current Page:', response.data.pagination?.page || 1);
      console.log('- Logs Count:', response.data.logs?.length || 0);

      if (response.data.logs?.length > 0) {
        const latestLog = response.data.logs[0];
        console.log('- Latest Log Type:', latestLog.sync_type);
        console.log('- Latest Log Status:', latestLog.status);
      }

      return true;

    } catch (error) {
      console.error('❌ Sync logs test failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Test BestBuy integration with sync services
   */
  async testBestBuySync() {
    try {
      console.log('\n🛒 Testing BestBuy integration with sync...');

      // First test BestBuy API connection
      const bestbuyResponse = await axios.get(`${this.baseUrl}/api/bestbuy/test`, {
        headers: this.getHeaders()
      });

      if (bestbuyResponse.data.success) {
        console.log('✅ BestBuy API Connection: OK');
        console.log('- Shop:', bestbuyResponse.data.data?.shop_name || 'Unknown');
        console.log('- Shop ID:', bestbuyResponse.data.data?.shop_id || 'Unknown');

        // Now trigger a BestBuy product sync
        const syncResponse = await axios.post(`${this.baseUrl}/api/sync/trigger`, {
          channelId: 2, // BestBuy channel
          syncType: 'products',
          priority: 9
        }, {
          headers: this.getHeaders()
        });

        console.log('✅ BestBuy Sync Triggered:');
        console.log('- Job ID:', syncResponse.data.jobId);

        return true;
      } else {
        console.log('⚠️ BestBuy API connection failed, skipping sync test');
        return false;
      }

    } catch (error) {
      console.error('❌ BestBuy sync test failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Milestone 8 Sync Services Tests');
    console.log('='.repeat(50));

    const results = {
      authentication: false,
      syncStatus: false,
      dataMapping: false,
      syncTrigger: false,
      webhooks: false,
      syncLogs: false,
      bestbuySync: false
    };

    // Authenticate first
    results.authentication = await this.authenticate();
    if (!results.authentication) {
      console.log('\n❌ Cannot proceed without authentication');
      return results;
    }

    // Run all tests
    results.syncStatus = await this.testSyncStatus();
    results.dataMapping = await this.testDataMapping();
    results.syncTrigger = await this.testSyncTrigger();
    results.webhooks = await this.testWebhooks();
    results.syncLogs = await this.testSyncLogs();
    results.bestbuySync = await this.testBestBuySync();

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    Object.entries(results).forEach(([test, result]) => {
      const status = result ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.toUpperCase()}`);
    });

    console.log('\n' + '='.repeat(50));
    console.log(`🎯 OVERALL: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED - Milestone 8 Data Sync Services is working correctly!');
    } else {
      console.log('⚠️ Some tests failed - check the logs above for details');
    }

    return results;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new SyncServiceTester();
  tester.runAllTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = SyncServiceTester;
