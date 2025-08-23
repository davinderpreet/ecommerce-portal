const { Pool } = require('pg');

/**
 * Sales Processing Engine - Core business logic for order processing
 * Handles multi-channel sales data processing, validation, and aggregation
 */
class SalesProcessor {
  constructor() {
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.isInitialized = false;
    this.processingStats = {
      ordersProcessed: 0,
      errorsCount: 0,
      lastProcessedAt: null
    };
  }

  /**
   * Initialize sales processor and create necessary database tables
   */
  async initialize() {
    try {
      // Test database connection
      await this.db.query('SELECT NOW()');
      
      // Create sales processing tables
      await this.createTables();
      
      this.isInitialized = true;
      console.log('✅ SalesProcessor initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ SalesProcessor initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Create necessary database tables for sales processing
   */
  async createTables() {
    // Sales processing queue table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS sales_processing_queue (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        channel_id INTEGER,
        channel_name VARCHAR(100),
        raw_order_data JSONB NOT NULL,
        processing_status VARCHAR(50) DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        UNIQUE(order_id, channel_name)
      )
    `);

    // Sales processing logs table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS sales_processing_logs (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255),
        channel_name VARCHAR(100),
        processing_step VARCHAR(100),
        status VARCHAR(50),
        details JSONB,
        error_details TEXT,
        processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sales aggregation table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS sales_aggregations (
        id SERIAL PRIMARY KEY,
        date_key DATE NOT NULL,
        channel_name VARCHAR(100),
        total_orders INTEGER DEFAULT 0,
        total_revenue DECIMAL(12,2) DEFAULT 0,
        total_items INTEGER DEFAULT 0,
        avg_order_value DECIMAL(10,2) DEFAULT 0,
        processed_orders INTEGER DEFAULT 0,
        failed_orders INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date_key, channel_name)
      )
    `);

    console.log('📊 Sales processing tables created successfully');
  }

  /**
   * Process a single sales order from any channel
   */
  async processOrder(orderData, channelName, channelId = null) {
    const startTime = Date.now();
    const orderId = this.extractOrderId(orderData, channelName);
    
    try {
      // Log processing start
      await this.logProcessingStep(orderId, channelName, 'processing_start', 'started', {
        order_id: orderId,
        channel: channelName
      });

      // Validate order data
      const validationResult = await this.validateOrderData(orderData, channelName);
      if (!validationResult.isValid) {
        throw new Error(`Order validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Transform order data to standard format
      const standardizedOrder = await this.standardizeOrderData(orderData, channelName);
      
      // Process order into sales_orders table
      const processedOrder = await this.insertProcessedOrder(standardizedOrder, channelId);
      
      // Update inventory if needed
      await this.updateInventoryFromOrder(standardizedOrder);
      
      // Update aggregations
      await this.updateSalesAggregations(standardizedOrder, channelName);
      
      // Mark as processed
      await this.markOrderProcessed(orderId, channelName, 'completed');
      
      const processingTime = Date.now() - startTime;
      
      // Log successful processing
      await this.logProcessingStep(orderId, channelName, 'processing_complete', 'success', {
        processing_time_ms: processingTime,
        order_total: standardizedOrder.total_amount
      }, null, processingTime);

      this.processingStats.ordersProcessed++;
      this.processingStats.lastProcessedAt = new Date();

      return {
        success: true,
        orderId,
        processingTime,
        processedOrder
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log processing error
      await this.logProcessingStep(orderId, channelName, 'processing_error', 'failed', {
        error: error.message
      }, error.message, processingTime);

      // Mark as failed
      await this.markOrderProcessed(orderId, channelName, 'failed', error.message);

      this.processingStats.errorsCount++;

      return {
        success: false,
        orderId,
        error: error.message,
        processingTime
      };
    }
  }

  /**
   * Extract order ID from raw order data based on channel
   */
  extractOrderId(orderData, channelName) {
    switch (channelName.toLowerCase()) {
      case 'shopify':
        return orderData.id || orderData.order_id || orderData.name;
      case 'bestbuy':
      case 'bestbuy_canada':
        return orderData.order_id || orderData.id || orderData.commercial_id;
      case 'amazon':
        return orderData.AmazonOrderId || orderData.order_id;
      default:
        return orderData.id || orderData.order_id || `unknown_${Date.now()}`;
    }
  }

  /**
   * Validate order data structure and required fields
   */
  async validateOrderData(orderData, channelName) {
    const errors = [];
    
    // Basic validation
    if (!orderData || typeof orderData !== 'object') {
      errors.push('Order data must be a valid object');
      return { isValid: false, errors };
    }

    // Channel-specific validation
    switch (channelName.toLowerCase()) {
      case 'shopify':
        if (!orderData.id && !orderData.order_id) errors.push('Missing Shopify order ID');
        if (!orderData.total_price && !orderData.current_total_price) errors.push('Missing order total');
        if (!orderData.line_items || !Array.isArray(orderData.line_items)) errors.push('Missing or invalid line items');
        break;
        
      case 'bestbuy':
      case 'bestbuy_canada':
        if (!orderData.order_id && !orderData.commercial_id) errors.push('Missing BestBuy order ID');
        if (!orderData.total_price && !orderData.order_lines) errors.push('Missing order total or lines');
        break;
        
      case 'amazon':
        if (!orderData.AmazonOrderId) errors.push('Missing Amazon order ID');
        if (!orderData.OrderTotal) errors.push('Missing order total');
        break;
        
      default:
        if (!orderData.id && !orderData.order_id) errors.push('Missing order ID');
        if (!orderData.total && !orderData.total_price) errors.push('Missing order total');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Standardize order data to common format
   */
  async standardizeOrderData(orderData, channelName) {
    const baseOrder = {
      channel_name: channelName,
      processed_at: new Date(),
      raw_data: orderData
    };

    switch (channelName.toLowerCase()) {
      case 'shopify':
        return {
          ...baseOrder,
          external_order_id: orderData.id || orderData.order_id,
          order_number: orderData.name || orderData.order_number,
          customer_email: orderData.email || orderData.contact_email,
          customer_name: orderData.customer ? 
            `${orderData.customer.first_name || ''} ${orderData.customer.last_name || ''}`.trim() : 
            orderData.billing_address?.name || 'Unknown',
          total_amount: parseFloat(orderData.total_price || orderData.current_total_price || 0),
          currency: orderData.currency || 'USD',
          order_status: this.mapOrderStatus(orderData.financial_status, 'shopify'),
          fulfillment_status: orderData.fulfillment_status || 'unfulfilled',
          order_date: new Date(orderData.created_at || orderData.processed_at || Date.now()),
          items_count: orderData.line_items ? orderData.line_items.length : 0,
          shipping_address: orderData.shipping_address,
          billing_address: orderData.billing_address
        };

      case 'bestbuy':
      case 'bestbuy_canada':
        return {
          ...baseOrder,
          external_order_id: orderData.order_id || orderData.commercial_id,
          order_number: orderData.commercial_id || orderData.order_id,
          customer_email: orderData.customer?.email || orderData.customer_email,
          customer_name: orderData.customer ? 
            `${orderData.customer.firstname || ''} ${orderData.customer.lastname || ''}`.trim() : 
            'Unknown',
          total_amount: parseFloat(orderData.total_price || orderData.price || 0),
          currency: orderData.currency_iso_code || 'CAD',
          order_status: this.mapOrderStatus(orderData.state, 'bestbuy'),
          fulfillment_status: orderData.state || 'pending',
          order_date: new Date(orderData.created_date || orderData.date_created || Date.now()),
          items_count: orderData.order_lines ? orderData.order_lines.length : 1,
          shipping_address: orderData.shipping_address,
          billing_address: orderData.billing_address
        };

      case 'amazon':
        return {
          ...baseOrder,
          external_order_id: orderData.AmazonOrderId,
          order_number: orderData.AmazonOrderId,
          customer_email: orderData.BuyerEmail || 'unknown@amazon.com',
          customer_name: orderData.BuyerName || 'Amazon Customer',
          total_amount: parseFloat(orderData.OrderTotal?.Amount || 0),
          currency: orderData.OrderTotal?.CurrencyCode || 'USD',
          order_status: this.mapOrderStatus(orderData.OrderStatus, 'amazon'),
          fulfillment_status: orderData.FulfillmentChannel || 'MFN',
          order_date: new Date(orderData.PurchaseDate || Date.now()),
          items_count: parseInt(orderData.NumberOfItemsShipped || 0) + parseInt(orderData.NumberOfItemsUnshipped || 0),
          shipping_address: orderData.ShippingAddress,
          billing_address: orderData.ShippingAddress
        };

      default:
        return {
          ...baseOrder,
          external_order_id: orderData.id || orderData.order_id,
          order_number: orderData.order_number || orderData.id,
          customer_email: orderData.customer_email || orderData.email,
          customer_name: orderData.customer_name || 'Unknown',
          total_amount: parseFloat(orderData.total || orderData.total_price || 0),
          currency: orderData.currency || 'USD',
          order_status: orderData.status || 'pending',
          fulfillment_status: orderData.fulfillment_status || 'unfulfilled',
          order_date: new Date(orderData.created_at || orderData.order_date || Date.now()),
          items_count: orderData.items_count || 1
        };
    }
  }

  /**
   * Map channel-specific order statuses to standard statuses
   */
  mapOrderStatus(status, channel) {
    if (!status) return 'pending';
    
    const statusLower = status.toLowerCase();
    
    // Standard status mapping
    const statusMap = {
      // Shopify statuses
      'paid': 'paid',
      'pending': 'pending',
      'authorized': 'authorized',
      'partially_paid': 'partially_paid',
      'refunded': 'refunded',
      'voided': 'cancelled',
      
      // BestBuy statuses
      'waiting_acceptance': 'pending',
      'waiting_debit': 'authorized',
      'shipping': 'processing',
      'shipped': 'shipped',
      'received': 'delivered',
      'refused': 'cancelled',
      'cancelled': 'cancelled',
      
      // Amazon statuses
      'unshipped': 'pending',
      'partiallyshipped': 'partially_shipped',
      'shipped': 'shipped',
      'canceled': 'cancelled',
      'unfulfillable': 'failed'
    };

    return statusMap[statusLower] || statusLower;
  }

  /**
   * Insert processed order into sales_orders table
   */
  async insertProcessedOrder(standardizedOrder, channelId) {
    const query = `
      INSERT INTO sales_orders (
        channel_id, external_order_id, order_number, customer_email, customer_name,
        total_amount, currency, order_status, fulfillment_status, order_date,
        items_count, shipping_address, billing_address, raw_data, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (external_order_id, channel_id) 
      DO UPDATE SET
        order_status = EXCLUDED.order_status,
        fulfillment_status = EXCLUDED.fulfillment_status,
        total_amount = EXCLUDED.total_amount,
        processed_at = EXCLUDED.processed_at,
        raw_data = EXCLUDED.raw_data
      RETURNING *
    `;

    const values = [
      channelId,
      standardizedOrder.external_order_id,
      standardizedOrder.order_number,
      standardizedOrder.customer_email,
      standardizedOrder.customer_name,
      standardizedOrder.total_amount,
      standardizedOrder.currency,
      standardizedOrder.order_status,
      standardizedOrder.fulfillment_status,
      standardizedOrder.order_date,
      standardizedOrder.items_count,
      JSON.stringify(standardizedOrder.shipping_address),
      JSON.stringify(standardizedOrder.billing_address),
      JSON.stringify(standardizedOrder.raw_data),
      standardizedOrder.processed_at
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update inventory based on processed order
   */
  async updateInventoryFromOrder(standardizedOrder) {
    // This will integrate with inventory management in future milestones
    // For now, just log the inventory impact
    console.log(`📦 Inventory update needed for order ${standardizedOrder.external_order_id}`);
  }

  /**
   * Update sales aggregations for reporting
   */
  async updateSalesAggregations(standardizedOrder, channelName) {
    const dateKey = standardizedOrder.order_date.toISOString().split('T')[0];
    
    const query = `
      INSERT INTO sales_aggregations (
        date_key, channel_name, total_orders, total_revenue, total_items, processed_orders
      ) VALUES ($1, $2, 1, $3, $4, 1)
      ON CONFLICT (date_key, channel_name)
      DO UPDATE SET
        total_orders = sales_aggregations.total_orders + 1,
        total_revenue = sales_aggregations.total_revenue + EXCLUDED.total_revenue,
        total_items = sales_aggregations.total_items + EXCLUDED.total_items,
        processed_orders = sales_aggregations.processed_orders + 1,
        avg_order_value = (sales_aggregations.total_revenue + EXCLUDED.total_revenue) / 
                         (sales_aggregations.total_orders + 1),
        last_updated = CURRENT_TIMESTAMP
    `;

    await this.db.query(query, [
      dateKey,
      channelName,
      standardizedOrder.total_amount,
      standardizedOrder.items_count
    ]);
  }

  /**
   * Mark order as processed in queue
   */
  async markOrderProcessed(orderId, channelName, status, errorMessage = null) {
    const query = `
      UPDATE sales_processing_queue 
      SET processing_status = $1, processed_at = CURRENT_TIMESTAMP, error_message = $2
      WHERE order_id = $3 AND channel_name = $4
    `;
    
    await this.db.query(query, [status, errorMessage, orderId, channelName]);
  }

  /**
   * Log processing step for audit trail
   */
  async logProcessingStep(orderId, channelName, step, status, details = null, errorDetails = null, processingTime = null) {
    const query = `
      INSERT INTO sales_processing_logs (
        order_id, channel_name, processing_step, status, details, error_details, processing_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    await this.db.query(query, [
      orderId,
      channelName,
      step,
      status,
      details ? JSON.stringify(details) : null,
      errorDetails,
      processingTime
    ]);
  }

  /**
   * Process orders from queue
   */
  async processQueue(limit = 10) {
    if (!this.isInitialized) {
      console.log('⚠️ SalesProcessor not initialized');
      return;
    }

    try {
      // Get pending orders from queue
      const result = await this.db.query(`
        SELECT * FROM sales_processing_queue 
        WHERE processing_status = 'pending' 
        AND retry_count < max_retries
        ORDER BY priority DESC, created_at ASC
        LIMIT $1
      `, [limit]);

      const orders = result.rows;
      console.log(`📋 Processing ${orders.length} orders from queue`);

      for (const queueItem of orders) {
        const result = await this.processOrder(
          queueItem.raw_order_data,
          queueItem.channel_name,
          queueItem.channel_id
        );

        if (!result.success) {
          // Increment retry count
          await this.db.query(`
            UPDATE sales_processing_queue 
            SET retry_count = retry_count + 1, error_message = $1
            WHERE id = $2
          `, [result.error, queueItem.id]);
        }
      }

    } catch (error) {
      console.error('❌ Error processing sales queue:', error.message);
    }
  }

  /**
   * Add order to processing queue
   */
  async queueOrder(orderData, channelName, channelId = null, priority = 5) {
    const orderId = this.extractOrderId(orderData, channelName);
    
    const query = `
      INSERT INTO sales_processing_queue (
        order_id, channel_id, channel_name, raw_order_data, priority
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (order_id, channel_name) 
      DO UPDATE SET
        raw_order_data = EXCLUDED.raw_order_data,
        priority = EXCLUDED.priority,
        processing_status = 'pending',
        retry_count = 0,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.db.query(query, [
      orderId,
      channelId,
      channelName,
      JSON.stringify(orderData),
      priority
    ]);

    return result.rows[0];
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Get sales aggregations for reporting
   */
  async getSalesAggregations(startDate, endDate, channelName = null) {
    let query = `
      SELECT * FROM sales_aggregations 
      WHERE date_key >= $1 AND date_key <= $2
    `;
    const params = [startDate, endDate];

    if (channelName) {
      query += ` AND channel_name = $3`;
      params.push(channelName);
    }

    query += ` ORDER BY date_key DESC, channel_name`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Close database connection
   */
  async close() {
    await this.db.end();
  }
}

module.exports = SalesProcessor;
