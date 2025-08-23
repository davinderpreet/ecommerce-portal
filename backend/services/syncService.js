const axios = require('axios');
const { Pool } = require('pg');

/**
 * Data Synchronization Service for Multi-Channel E-commerce Portal
 * Handles synchronization between Amazon, Shopify, and BestBuy channels
 * Milestone 8: Data Sync Services
 */
class SyncService {
  constructor() {
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.syncQueue = [];
    this.isProcessing = false;
    this.syncStats = {
      products: { success: 0, failed: 0, lastSync: null },
      orders: { success: 0, failed: 0, lastSync: null },
      inventory: { success: 0, failed: 0, lastSync: null }
    };
  }

  /**
   * Initialize sync service and create necessary database tables
   */
  async initialize() {
    try {
      // Test database connection first
      await this.db.query('SELECT NOW()');
      
      // Create sync logs table (without foreign key constraint)
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS sync_logs (
          id SERIAL PRIMARY KEY,
          channel_id INTEGER,
          sync_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL,
          records_processed INTEGER DEFAULT 0,
          errors_count INTEGER DEFAULT 0,
          error_details JSONB,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          duration_ms INTEGER
        )
      `);

      // Create sync queue table (without foreign key constraint)
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id SERIAL PRIMARY KEY,
          channel_id INTEGER,
          sync_type VARCHAR(50) NOT NULL,
          priority INTEGER DEFAULT 5,
          payload JSONB,
          status VARCHAR(20) DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP,
          error_message TEXT
        )
      `);

      console.log('SyncService initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize SyncService:', error.message);
      // Don't throw error to prevent server startup failure
      return false;
    }
  }

  /**
   * Add sync job to queue
   */
  async addSyncJob(channelId, syncType, payload = {}, priority = 5) {
    try {
      const result = await this.db.query(`
        INSERT INTO sync_queue (channel_id, sync_type, priority, payload)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [channelId, syncType, priority, JSON.stringify(payload)]);

      console.log(`Sync job added: ${syncType} for channel ${channelId}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('Failed to add sync job:', error);
      throw error;
    }
  }

  /**
   * Process sync queue
   */
  async processSyncQueue() {
    if (this.isProcessing) {
      console.log('Sync queue already processing');
      return;
    }

    this.isProcessing = true;
    console.log('Starting sync queue processing...');

    try {
      // Get pending jobs ordered by priority and scheduled time
      const result = await this.db.query(`
        SELECT sq.*, c.name as channel_name, c.api_config
        FROM sync_queue sq
        JOIN channels c ON sq.channel_id = c.id
        WHERE sq.status = 'pending' 
        AND sq.retry_count < sq.max_retries
        AND sq.scheduled_at <= CURRENT_TIMESTAMP
        ORDER BY sq.priority DESC, sq.scheduled_at ASC
        LIMIT 10
      `);

      const jobs = result.rows;
      console.log(`Processing ${jobs.length} sync jobs`);

      for (const job of jobs) {
        await this.processSyncJob(job);
      }

    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual sync job
   */
  async processSyncJob(job) {
    const startTime = Date.now();
    let logId = null;

    try {
      // Create sync log entry
      const logResult = await this.db.query(`
        INSERT INTO sync_logs (channel_id, sync_type, status)
        VALUES ($1, $2, 'processing')
        RETURNING id
      `, [job.channel_id, job.sync_type]);
      
      logId = logResult.rows[0].id;

      // Update job status to processing
      await this.db.query(`
        UPDATE sync_queue 
        SET status = 'processing', processed_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [job.id]);

      // Process based on sync type
      let result;
      switch (job.sync_type) {
        case 'products':
          result = await this.syncProducts(job);
          break;
        case 'orders':
          result = await this.syncOrders(job);
          break;
        case 'inventory':
          result = await this.syncInventory(job);
          break;
        default:
          throw new Error(`Unknown sync type: ${job.sync_type}`);
      }

      // Update successful completion
      const duration = Date.now() - startTime;
      
      await this.db.query(`
        UPDATE sync_logs 
        SET status = 'completed', records_processed = $1, completed_at = CURRENT_TIMESTAMP, duration_ms = $2
        WHERE id = $3
      `, [result.processed || 0, duration, logId]);

      await this.db.query(`
        UPDATE sync_queue 
        SET status = 'completed'
        WHERE id = $1
      `, [job.id]);

      // Update stats
      this.syncStats[job.sync_type].success++;
      this.syncStats[job.sync_type].lastSync = new Date();

      console.log(`✅ Sync job completed: ${job.sync_type} for ${job.channel_name} (${duration}ms)`);

    } catch (error) {
      console.error(`❌ Sync job failed: ${job.sync_type} for ${job.channel_name}:`, error.message);

      const duration = Date.now() - startTime;
      
      // Update failed log
      if (logId) {
        await this.db.query(`
          UPDATE sync_logs 
          SET status = 'failed', error_details = $1, completed_at = CURRENT_TIMESTAMP, duration_ms = $2
          WHERE id = $3
        `, [JSON.stringify({ message: error.message, stack: error.stack }), duration, logId]);
      }

      // Update job with retry logic
      const retryCount = job.retry_count + 1;
      if (retryCount >= job.max_retries) {
        await this.db.query(`
          UPDATE sync_queue 
          SET status = 'failed', retry_count = $1, error_message = $2
          WHERE id = $3
        `, [retryCount, error.message, job.id]);
      } else {
        // Schedule retry with exponential backoff
        const retryDelay = Math.pow(2, retryCount) * 60000; // 2^n minutes
        const retryTime = new Date(Date.now() + retryDelay);
        
        await this.db.query(`
          UPDATE sync_queue 
          SET status = 'pending', retry_count = $1, scheduled_at = $2, error_message = $3
          WHERE id = $4
        `, [retryCount, retryTime, error.message, job.id]);
      }

      // Update stats
      this.syncStats[job.sync_type].failed++;
    }
  }

  /**
   * Sync products from channel
   */
  async syncProducts(job) {
    console.log(`Syncing products for channel: ${job.channel_name}`);
    
    const apiConfig = JSON.parse(job.api_config);
    let products = [];
    let processed = 0;

    // Get products based on channel type
    switch (job.channel_name.toLowerCase()) {
      case 'shopify':
        products = await this.getShopifyProducts(apiConfig);
        break;
      case 'bestbuy':
        products = await this.getBestBuyProducts(apiConfig);
        break;
      case 'amazon':
        // Amazon integration placeholder
        products = await this.getAmazonProducts(apiConfig);
        break;
      default:
        throw new Error(`Unsupported channel: ${job.channel_name}`);
    }

    // Process and store products
    for (const product of products) {
      try {
        await this.storeProduct(product, job.channel_id);
        processed++;
      } catch (error) {
        console.error(`Failed to store product ${product.id}:`, error.message);
      }
    }

    return { processed, total: products.length };
  }

  /**
   * Sync orders from channel
   */
  async syncOrders(job) {
    console.log(`Syncing orders for channel: ${job.channel_name}`);
    
    const apiConfig = JSON.parse(job.api_config);
    let orders = [];
    let processed = 0;

    // Get orders based on channel type
    switch (job.channel_name.toLowerCase()) {
      case 'shopify':
        orders = await this.getShopifyOrders(apiConfig);
        break;
      case 'bestbuy':
        orders = await this.getBestBuyOrders(apiConfig);
        break;
      case 'amazon':
        orders = await this.getAmazonOrders(apiConfig);
        break;
      default:
        throw new Error(`Unsupported channel: ${job.channel_name}`);
    }

    // Process and store orders
    for (const order of orders) {
      try {
        await this.storeOrder(order, job.channel_id);
        processed++;
      } catch (error) {
        console.error(`Failed to store order ${order.id}:`, error.message);
      }
    }

    return { processed, total: orders.length };
  }

  /**
   * Sync inventory across channels
   */
  async syncInventory(job) {
    console.log(`Syncing inventory for channel: ${job.channel_name}`);
    
    const apiConfig = JSON.parse(job.api_config);
    let inventoryItems = [];
    let processed = 0;

    // Get inventory based on channel type
    switch (job.channel_name.toLowerCase()) {
      case 'shopify':
        inventoryItems = await this.getShopifyInventory(apiConfig);
        break;
      case 'bestbuy':
        inventoryItems = await this.getBestBuyInventory(apiConfig);
        break;
      case 'amazon':
        inventoryItems = await this.getAmazonInventory(apiConfig);
        break;
      default:
        throw new Error(`Unsupported channel: ${job.channel_name}`);
    }

    // Process and update inventory
    for (const item of inventoryItems) {
      try {
        await this.updateInventory(item, job.channel_id);
        processed++;
      } catch (error) {
        console.error(`Failed to update inventory ${item.sku}:`, error.message);
      }
    }

    return { processed, total: inventoryItems.length };
  }

  /**
   * Get Shopify products
   */
  async getShopifyProducts(apiConfig) {
    // Implementation for Shopify products API
    // This would use the Shopify API configuration
    return [];
  }

  /**
   * Get BestBuy products (offers)
   */
  async getBestBuyProducts(apiConfig) {
    try {
      const response = await axios.get('https://marketplace.bestbuy.ca/api/offers', {
        headers: {
          'Authorization': process.env.BESTBUY_CANADA_API_KEY,
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data.offers || [];
    } catch (error) {
      console.error('BestBuy products sync error:', error.message);
      return [];
    }
  }

  /**
   * Get Amazon products (placeholder)
   */
  async getAmazonProducts(apiConfig) {
    // Amazon API integration placeholder
    return [];
  }

  /**
   * Store product in database
   */
  async storeProduct(product, channelId) {
    // Check if product exists
    const existingProduct = await this.db.query(`
      SELECT id FROM products WHERE sku = $1
    `, [product.sku]);

    let productId;

    if (existingProduct.rows.length > 0) {
      // Update existing product
      productId = existingProduct.rows[0].id;
      await this.db.query(`
        UPDATE products 
        SET name = $1, description = $2, brand = $3, category = $4, 
            base_price = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [product.name, product.description, product.brand, product.category, product.price, productId]);
    } else {
      // Insert new product
      const result = await this.db.query(`
        INSERT INTO products (sku, name, description, brand, category, base_price)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [product.sku, product.name, product.description, product.brand, product.category, product.price]);
      
      productId = result.rows[0].id;
    }

    // Update channel-specific product mapping
    await this.db.query(`
      INSERT INTO channel_products (product_id, channel_id, channel_sku, channel_price, status, sync_status)
      VALUES ($1, $2, $3, $4, 'active', 'synced')
      ON CONFLICT (product_id, channel_id) 
      DO UPDATE SET 
        channel_sku = EXCLUDED.channel_sku,
        channel_price = EXCLUDED.channel_price,
        sync_status = 'synced',
        updated_at = CURRENT_TIMESTAMP
    `, [productId, channelId, product.channel_sku || product.sku, product.price]);

    return productId;
  }

  /**
   * Store order in database
   */
  async storeOrder(order, channelId) {
    // Implementation for storing orders
    const result = await this.db.query(`
      INSERT INTO sales_orders (channel_id, channel_order_id, customer_info, order_date, status, total_amount, items, shipping_info)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (channel_id, channel_order_id) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [channelId, order.id, JSON.stringify(order.customer), order.date, order.status, order.total, JSON.stringify(order.items), JSON.stringify(order.shipping)]);

    return result.rows[0].id;
  }

  /**
   * Update inventory in database
   */
  async updateInventory(item, channelId) {
    await this.db.query(`
      INSERT INTO inventory (product_id, channel_id, quantity, last_updated)
      SELECT p.id, $2, $3, CURRENT_TIMESTAMP
      FROM products p
      WHERE p.sku = $1
      ON CONFLICT (product_id, channel_id)
      DO UPDATE SET 
        quantity = EXCLUDED.quantity,
        last_updated = CURRENT_TIMESTAMP
    `, [item.sku, channelId, item.quantity]);
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return this.syncStats;
  }

  /**
   * Get recent sync logs
   */
  async getSyncLogs(limit = 50) {
    const result = await this.db.query(`
      SELECT sl.*, c.name as channel_name
      FROM sync_logs sl
      JOIN channels c ON sl.channel_id = c.id
      ORDER BY sl.started_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  /**
   * Start automatic sync scheduler
   */
  startScheduler(intervalMinutes = 15) {
    console.log(`Starting sync scheduler with ${intervalMinutes} minute intervals`);
    
    setInterval(async () => {
      try {
        await this.processSyncQueue();
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Process immediately on start
    setTimeout(() => this.processSyncQueue(), 5000);
  }

  /**
   * Cleanup old logs and completed jobs
   */
  async cleanup(daysToKeep = 30) {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    // Clean old sync logs
    await this.db.query(`
      DELETE FROM sync_logs 
      WHERE completed_at < $1 AND status IN ('completed', 'failed')
    `, [cutoffDate]);

    // Clean completed sync queue jobs
    await this.db.query(`
      DELETE FROM sync_queue 
      WHERE processed_at < $1 AND status IN ('completed', 'failed')
    `, [cutoffDate]);

    console.log(`Cleanup completed: removed logs older than ${daysToKeep} days`);
  }
}

module.exports = SyncService;
