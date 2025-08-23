const { Pool } = require('pg');

class OrderLifecycleManager {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    this.initialized = false;
  }

  async initialize() {
    try {
      await this.createTables();
      this.initialized = true;
      console.log('✅ OrderLifecycleManager initialized successfully');
    } catch (error) {
      console.error('❌ OrderLifecycleManager initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      // Order lifecycle stages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS order_lifecycle_stages (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          stage VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP NULL,
          estimated_completion TIMESTAMP NULL,
          assigned_to VARCHAR(255) NULL,
          notes TEXT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Order fulfillment tracking
      await client.query(`
        CREATE TABLE IF NOT EXISTS order_fulfillment (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          fulfillment_method VARCHAR(50) NOT NULL,
          carrier VARCHAR(100) NULL,
          tracking_number VARCHAR(255) NULL,
          shipping_address JSONB NOT NULL,
          estimated_delivery TIMESTAMP NULL,
          actual_delivery TIMESTAMP NULL,
          delivery_status VARCHAR(50) DEFAULT 'pending',
          delivery_notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Order routing and assignment
      await client.query(`
        CREATE TABLE IF NOT EXISTS order_routing (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          channel VARCHAR(50) NOT NULL,
          priority_score INTEGER DEFAULT 0,
          routing_rules JSONB DEFAULT '{}',
          assigned_warehouse VARCHAR(100) NULL,
          assigned_team VARCHAR(100) NULL,
          assigned_user VARCHAR(255) NULL,
          assignment_reason TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Customer communications log
      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_communications (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          customer_email VARCHAR(255) NOT NULL,
          communication_type VARCHAR(50) NOT NULL,
          channel VARCHAR(50) NOT NULL,
          subject VARCHAR(255) NULL,
          message TEXT NOT NULL,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          delivery_status VARCHAR(50) DEFAULT 'sent',
          response_received BOOLEAN DEFAULT FALSE,
          metadata JSONB DEFAULT '{}'
        )
      `);

      console.log('📊 Order lifecycle tables created successfully');
    } finally {
      client.release();
    }
  }

  // Advanced order lifecycle management
  async startOrderLifecycle(orderData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create initial lifecycle stage
      const lifecycleResult = await client.query(`
        INSERT INTO order_lifecycle_stages (order_id, stage, status, estimated_completion, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        orderData.orderId,
        'order_received',
        'active',
        new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours estimate
        JSON.stringify({
          channel: orderData.channel,
          orderValue: orderData.totalAmount,
          itemCount: orderData.items?.length || 0
        })
      ]);

      // Create routing entry
      const routingResult = await client.query(`
        INSERT INTO order_routing (order_id, channel, priority_score, routing_rules)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        orderData.orderId,
        orderData.channel,
        this.calculatePriorityScore(orderData),
        JSON.stringify({
          orderValue: orderData.totalAmount,
          customerTier: orderData.customerTier || 'standard',
          urgency: orderData.urgency || 'normal'
        })
      ]);

      await client.query('COMMIT');

      return {
        success: true,
        lifecycle: lifecycleResult.rows[0],
        routing: routingResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Progress order through lifecycle stages
  async progressOrderStage(orderId, newStage, assignedTo = null, notes = null) {
    const client = await this.pool.connect();
    try {
      // Complete current stage
      await client.query(`
        UPDATE order_lifecycle_stages 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $1 AND status = 'active'
      `, [orderId]);

      // Create new stage
      const result = await client.query(`
        INSERT INTO order_lifecycle_stages (order_id, stage, status, assigned_to, notes, estimated_completion)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        orderId,
        newStage,
        'active',
        assignedTo,
        notes,
        this.getStageEstimatedCompletion(newStage)
      ]);

      return {
        success: true,
        newStage: result.rows[0]
      };
    } finally {
      client.release();
    }
  }

  // Create fulfillment tracking
  async createFulfillmentTracking(orderData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO order_fulfillment (
          order_id, fulfillment_method, carrier, tracking_number, 
          shipping_address, estimated_delivery
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        orderData.orderId,
        orderData.fulfillmentMethod || 'standard_shipping',
        orderData.carrier,
        orderData.trackingNumber,
        JSON.stringify(orderData.shippingAddress),
        orderData.estimatedDelivery
      ]);

      return {
        success: true,
        fulfillment: result.rows[0]
      };
    } finally {
      client.release();
    }
  }

  // Update fulfillment status
  async updateFulfillmentStatus(orderId, status, trackingNumber = null, deliveryNotes = null) {
    const client = await this.pool.connect();
    try {
      const updateFields = ['delivery_status = $2', 'updated_at = CURRENT_TIMESTAMP'];
      const values = [orderId, status];
      let paramIndex = 3;

      if (trackingNumber) {
        updateFields.push(`tracking_number = $${paramIndex}`);
        values.push(trackingNumber);
        paramIndex++;
      }

      if (deliveryNotes) {
        updateFields.push(`delivery_notes = $${paramIndex}`);
        values.push(deliveryNotes);
        paramIndex++;
      }

      if (status === 'delivered') {
        updateFields.push('actual_delivery = CURRENT_TIMESTAMP');
      }

      const result = await client.query(`
        UPDATE order_fulfillment 
        SET ${updateFields.join(', ')}
        WHERE order_id = $1
        RETURNING *
      `, values);

      return {
        success: true,
        fulfillment: result.rows[0]
      };
    } finally {
      client.release();
    }
  }

  // Assign order to team/user
  async assignOrder(orderId, assignmentData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        UPDATE order_routing 
        SET assigned_warehouse = $2, assigned_team = $3, assigned_user = $4, 
            assignment_reason = $5, updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $1
        RETURNING *
      `, [
        orderId,
        assignmentData.warehouse,
        assignmentData.team,
        assignmentData.user,
        assignmentData.reason
      ]);

      return {
        success: true,
        assignment: result.rows[0]
      };
    } finally {
      client.release();
    }
  }

  // Send customer communication
  async sendCustomerCommunication(communicationData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO customer_communications (
          order_id, customer_email, communication_type, channel, 
          subject, message, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        communicationData.orderId,
        communicationData.customerEmail,
        communicationData.type,
        communicationData.channel || 'email',
        communicationData.subject,
        communicationData.message,
        JSON.stringify(communicationData.metadata || {})
      ]);

      return {
        success: true,
        communication: result.rows[0]
      };
    } finally {
      client.release();
    }
  }

  // Get comprehensive order tracking
  async getOrderTracking(orderId) {
    const client = await this.pool.connect();
    try {
      // Get lifecycle stages
      const lifecycleResult = await client.query(`
        SELECT * FROM order_lifecycle_stages 
        WHERE order_id = $1 
        ORDER BY created_at ASC
      `, [orderId]);

      // Get fulfillment info
      const fulfillmentResult = await client.query(`
        SELECT * FROM order_fulfillment 
        WHERE order_id = $1
      `, [orderId]);

      // Get routing info
      const routingResult = await client.query(`
        SELECT * FROM order_routing 
        WHERE order_id = $1
      `, [orderId]);

      // Get communications
      const communicationsResult = await client.query(`
        SELECT * FROM customer_communications 
        WHERE order_id = $1 
        ORDER BY sent_at DESC
      `, [orderId]);

      return {
        success: true,
        orderId,
        lifecycle: lifecycleResult.rows,
        fulfillment: fulfillmentResult.rows[0] || null,
        routing: routingResult.rows[0] || null,
        communications: communicationsResult.rows
      };
    } finally {
      client.release();
    }
  }

  // Get orders by stage
  async getOrdersByStage(stage, limit = 50) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT order_id, stage, status, assigned_to, created_at, estimated_completion
        FROM order_lifecycle_stages 
        WHERE stage = $1 AND status = 'active'
        ORDER BY created_at ASC
        LIMIT $2
      `, [stage, limit]);

      return {
        success: true,
        stage,
        orders: result.rows
      };
    } finally {
      client.release();
    }
  }

  // Helper methods
  calculatePriorityScore(orderData) {
    let score = 0;
    
    // Order value priority
    if (orderData.totalAmount > 1000) score += 50;
    else if (orderData.totalAmount > 500) score += 30;
    else if (orderData.totalAmount > 100) score += 10;
    
    // Customer tier priority
    if (orderData.customerTier === 'premium') score += 40;
    else if (orderData.customerTier === 'gold') score += 20;
    
    // Urgency priority
    if (orderData.urgency === 'urgent') score += 30;
    else if (orderData.urgency === 'high') score += 15;
    
    return score;
  }

  getStageEstimatedCompletion(stage) {
    const stageTimelines = {
      'order_received': 2, // 2 hours
      'payment_verified': 1, // 1 hour
      'inventory_allocated': 4, // 4 hours
      'picking': 6, // 6 hours
      'packing': 2, // 2 hours
      'shipped': 72, // 3 days
      'delivered': 0 // immediate
    };
    
    const hours = stageTimelines[stage] || 24;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  // Analytics methods
  async getLifecycleAnalytics(days = 7) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          stage,
          COUNT(*) as total_orders,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/3600) as avg_duration_hours,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders
        FROM order_lifecycle_stages 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY stage
        ORDER BY total_orders DESC
      `);

      return {
        success: true,
        analytics: result.rows
      };
    } finally {
      client.release();
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = OrderLifecycleManager;
