const { Pool } = require('pg');

/**
 * Order Management System - Handles order status tracking and workflow management
 * Provides comprehensive order lifecycle management across all channels
 */
class OrderManager {
  constructor() {
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.isInitialized = false;
    this.orderStatuses = [
      'pending', 'authorized', 'paid', 'processing', 'shipped', 
      'delivered', 'cancelled', 'refunded', 'failed'
    ];
    
    this.fulfillmentStatuses = [
      'unfulfilled', 'partial', 'fulfilled', 'shipped', 'delivered', 'cancelled'
    ];
  }

  /**
   * Initialize order manager and create workflow tables
   */
  async initialize() {
    try {
      await this.db.query('SELECT NOW()');
      await this.createTables();
      
      this.isInitialized = true;
      console.log('✅ OrderManager initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ OrderManager initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Create order management tables
   */
  async createTables() {
    // Order status history table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES sales_orders(id),
        external_order_id VARCHAR(255),
        channel_name VARCHAR(100),
        previous_status VARCHAR(50),
        new_status VARCHAR(50),
        previous_fulfillment VARCHAR(50),
        new_fulfillment VARCHAR(50),
        status_reason TEXT,
        changed_by VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Order workflow rules table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS order_workflow_rules (
        id SERIAL PRIMARY KEY,
        channel_name VARCHAR(100),
        from_status VARCHAR(50),
        to_status VARCHAR(50),
        conditions JSONB,
        actions JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Order notifications table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS order_notifications (
        id SERIAL PRIMARY KEY,
        order_id INTEGER,
        external_order_id VARCHAR(255),
        channel_name VARCHAR(100),
        notification_type VARCHAR(100),
        recipient_email VARCHAR(255),
        subject VARCHAR(500),
        message TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        sent_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('📋 Order management tables created successfully');
  }

  /**
   * Update order status with workflow validation
   */
  async updateOrderStatus(orderId, newStatus, newFulfillment = null, reason = null, changedBy = 'system', metadata = null) {
    try {
      // Get current order details
      const orderResult = await this.db.query(`
        SELECT * FROM sales_orders WHERE id = $1 OR external_order_id = $1
      `, [orderId]);

      if (orderResult.rows.length === 0) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const order = orderResult.rows[0];
      const previousStatus = order.order_status;
      const previousFulfillment = order.fulfillment_status;

      // Validate status transition
      const isValidTransition = await this.validateStatusTransition(
        order.channel_name || 'default',
        previousStatus,
        newStatus,
        order
      );

      if (!isValidTransition.valid) {
        throw new Error(`Invalid status transition: ${isValidTransition.reason}`);
      }

      // Update order status
      const updateQuery = `
        UPDATE sales_orders 
        SET order_status = $1, 
            fulfillment_status = COALESCE($2, fulfillment_status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const updatedOrder = await this.db.query(updateQuery, [
        newStatus,
        newFulfillment,
        order.id
      ]);

      // Record status history
      await this.recordStatusHistory(
        order.id,
        order.external_order_id,
        order.channel_name || 'default',
        previousStatus,
        newStatus,
        previousFulfillment,
        newFulfillment || previousFulfillment,
        reason,
        changedBy,
        metadata
      );

      // Execute workflow actions
      await this.executeWorkflowActions(order, newStatus, newFulfillment);

      // Trigger notifications if needed
      await this.triggerStatusNotifications(order, newStatus, newFulfillment);

      return {
        success: true,
        order: updatedOrder.rows[0],
        previousStatus,
        newStatus,
        statusHistory: await this.getOrderStatusHistory(order.id)
      };

    } catch (error) {
      console.error('❌ Error updating order status:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate if status transition is allowed
   */
  async validateStatusTransition(channelName, fromStatus, toStatus, orderData) {
    // Check workflow rules
    const rulesResult = await this.db.query(`
      SELECT * FROM order_workflow_rules 
      WHERE channel_name = $1 AND from_status = $2 AND to_status = $3 AND is_active = true
    `, [channelName, fromStatus, toStatus]);

    // If no specific rule found, check default rules
    if (rulesResult.rows.length === 0) {
      const defaultRules = await this.db.query(`
        SELECT * FROM order_workflow_rules 
        WHERE channel_name = 'default' AND from_status = $1 AND to_status = $2 AND is_active = true
      `, [fromStatus, toStatus]);

      if (defaultRules.rows.length === 0) {
        // Use built-in validation logic
        return this.validateBuiltInTransition(fromStatus, toStatus);
      }

      rulesResult.rows = defaultRules.rows;
    }

    const rule = rulesResult.rows[0];

    // Check conditions if any
    if (rule.conditions) {
      const conditionsMet = await this.evaluateConditions(rule.conditions, orderData);
      if (!conditionsMet.valid) {
        return {
          valid: false,
          reason: `Conditions not met: ${conditionsMet.reason}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Built-in status transition validation
   */
  validateBuiltInTransition(fromStatus, toStatus) {
    const validTransitions = {
      'pending': ['authorized', 'paid', 'cancelled', 'failed'],
      'authorized': ['paid', 'cancelled', 'failed'],
      'paid': ['processing', 'cancelled', 'refunded'],
      'processing': ['shipped', 'cancelled', 'refunded'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': ['refunded'],
      'cancelled': [], // Terminal state
      'refunded': [], // Terminal state
      'failed': ['pending', 'cancelled'] // Can retry or cancel
    };

    const allowedTransitions = validTransitions[fromStatus] || [];
    
    if (allowedTransitions.includes(toStatus)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Transition from '${fromStatus}' to '${toStatus}' not allowed`
    };
  }

  /**
   * Evaluate workflow conditions
   */
  async evaluateConditions(conditions, orderData) {
    try {
      // Simple condition evaluation
      for (const [field, expectedValue] of Object.entries(conditions)) {
        const actualValue = this.getNestedValue(orderData, field);
        
        if (actualValue !== expectedValue) {
          return {
            valid: false,
            reason: `Condition failed: ${field} expected ${expectedValue}, got ${actualValue}`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Condition evaluation error: ${error.message}`
      };
    }
  }

  /**
   * Get nested object value by dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  /**
   * Record status change in history
   */
  async recordStatusHistory(orderId, externalOrderId, channelName, previousStatus, newStatus, previousFulfillment, newFulfillment, reason, changedBy, metadata) {
    const query = `
      INSERT INTO order_status_history (
        order_id, external_order_id, channel_name, previous_status, new_status,
        previous_fulfillment, new_fulfillment, status_reason, changed_by, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      orderId,
      externalOrderId,
      channelName,
      previousStatus,
      newStatus,
      previousFulfillment,
      newFulfillment,
      reason,
      changedBy,
      metadata ? JSON.stringify(metadata) : null
    ]);

    return result.rows[0];
  }

  /**
   * Execute workflow actions after status change
   */
  async executeWorkflowActions(order, newStatus, newFulfillment) {
    try {
      // Get workflow actions for this transition
      const actionsResult = await this.db.query(`
        SELECT actions FROM order_workflow_rules 
        WHERE channel_name IN ($1, 'default') 
        AND to_status = $2 
        AND is_active = true
        AND actions IS NOT NULL
      `, [order.channel_name || 'default', newStatus]);

      for (const rule of actionsResult.rows) {
        const actions = rule.actions;

        // Execute each action
        for (const action of actions) {
          await this.executeAction(action, order, newStatus, newFulfillment);
        }
      }

    } catch (error) {
      console.error('❌ Error executing workflow actions:', error.message);
    }
  }

  /**
   * Execute individual workflow action
   */
  async executeAction(action, order, newStatus, newFulfillment) {
    switch (action.type) {
      case 'send_notification':
        await this.queueNotification(order, action.template, action.recipient);
        break;
        
      case 'update_inventory':
        await this.updateInventoryAction(order, action.operation);
        break;
        
      case 'sync_to_channel':
        await this.syncOrderToChannel(order, action.channel);
        break;
        
      case 'create_shipment':
        await this.createShipmentAction(order, action.carrier);
        break;
        
      default:
        console.log(`⚠️ Unknown workflow action: ${action.type}`);
    }
  }

  /**
   * Queue notification for order status change
   */
  async queueNotification(order, template, recipient) {
    const query = `
      INSERT INTO order_notifications (
        order_id, external_order_id, channel_name, notification_type,
        recipient_email, subject, message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await this.db.query(query, [
      order.id,
      order.external_order_id,
      order.channel_name || 'default',
      template,
      recipient || order.customer_email,
      `Order ${order.order_number} Status Update`,
      `Your order status has been updated to: ${order.order_status}`
    ]);
  }

  /**
   * Trigger status-based notifications
   */
  async triggerStatusNotifications(order, newStatus, newFulfillment) {
    const notificationStatuses = ['paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
    
    if (notificationStatuses.includes(newStatus)) {
      await this.queueNotification(order, `order_${newStatus}`, order.customer_email);
    }
  }

  /**
   * Get order status history
   */
  async getOrderStatusHistory(orderId) {
    const result = await this.db.query(`
      SELECT * FROM order_status_history 
      WHERE order_id = $1 OR external_order_id = $1
      ORDER BY created_at DESC
    `, [orderId]);

    return result.rows;
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status, channelName = null, limit = 50, offset = 0) {
    let query = `
      SELECT so.*, 
             COUNT(osh.id) as status_changes
      FROM sales_orders so
      LEFT JOIN order_status_history osh ON so.id = osh.order_id
      WHERE so.order_status = $1
    `;
    const params = [status];

    if (channelName) {
      query += ` AND so.channel_name = $${params.length + 1}`;
      params.push(channelName);
    }

    query += `
      GROUP BY so.id
      ORDER BY so.order_date DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Bulk update order statuses
   */
  async bulkUpdateStatus(orderIds, newStatus, reason = null, changedBy = 'system') {
    const results = [];

    for (const orderId of orderIds) {
      const result = await this.updateOrderStatus(orderId, newStatus, null, reason, changedBy);
      results.push({
        orderId,
        success: result.success,
        error: result.error
      });
    }

    return {
      total: orderIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Create workflow rule
   */
  async createWorkflowRule(channelName, fromStatus, toStatus, conditions = null, actions = null) {
    const query = `
      INSERT INTO order_workflow_rules (
        channel_name, from_status, to_status, conditions, actions
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      channelName,
      fromStatus,
      toStatus,
      conditions ? JSON.stringify(conditions) : null,
      actions ? JSON.stringify(actions) : null
    ]);

    return result.rows[0];
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(startDate, endDate, channelName = null) {
    let query = `
      SELECT 
        order_status,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        MIN(order_date) as earliest_order,
        MAX(order_date) as latest_order
      FROM sales_orders 
      WHERE order_date >= $1 AND order_date <= $2
    `;
    const params = [startDate, endDate];

    if (channelName) {
      query += ` AND channel_name = $3`;
      params.push(channelName);
    }

    query += `
      GROUP BY order_status
      ORDER BY order_count DESC
    `;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Process pending notifications
   */
  async processNotifications(limit = 10) {
    const result = await this.db.query(`
      SELECT * FROM order_notifications 
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
    `, [limit]);

    const notifications = result.rows;
    console.log(`📧 Processing ${notifications.length} notifications`);

    for (const notification of notifications) {
      try {
        // Here you would integrate with email service
        console.log(`📧 Sending notification: ${notification.subject} to ${notification.recipient_email}`);
        
        // Mark as sent
        await this.db.query(`
          UPDATE order_notifications 
          SET status = 'sent', sent_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [notification.id]);

      } catch (error) {
        // Mark as failed
        await this.db.query(`
          UPDATE order_notifications 
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [error.message, notification.id]);
      }
    }
  }

  /**
   * Placeholder methods for future integrations
   */
  async updateInventoryAction(order, operation) {
    console.log(`📦 Inventory action: ${operation} for order ${order.external_order_id}`);
  }

  async syncOrderToChannel(order, channel) {
    console.log(`🔄 Syncing order ${order.external_order_id} to ${channel}`);
  }

  async createShipmentAction(order, carrier) {
    console.log(`🚚 Creating shipment for order ${order.external_order_id} via ${carrier}`);
  }

  /**
   * Close database connection
   */
  async close() {
    await this.db.end();
  }
}

module.exports = OrderManager;
