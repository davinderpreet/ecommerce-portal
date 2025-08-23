const { Pool } = require('pg');

class OrderAnalyticsDashboard {
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
      console.log('✅ OrderAnalyticsDashboard initialized successfully');
    } catch (error) {
      console.error('❌ OrderAnalyticsDashboard initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      // Order analytics aggregations
      await client.query(`
        CREATE TABLE IF NOT EXISTS order_analytics_daily (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          channel VARCHAR(50) NOT NULL,
          total_orders INTEGER DEFAULT 0,
          total_revenue DECIMAL(12,2) DEFAULT 0,
          avg_order_value DECIMAL(10,2) DEFAULT 0,
          completed_orders INTEGER DEFAULT 0,
          cancelled_orders INTEGER DEFAULT 0,
          pending_orders INTEGER DEFAULT 0,
          avg_fulfillment_time_hours DECIMAL(8,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, channel)
        )
      `);

      // Performance metrics
      await client.query(`
        CREATE TABLE IF NOT EXISTS order_performance_metrics (
          id SERIAL PRIMARY KEY,
          metric_name VARCHAR(100) NOT NULL,
          metric_value DECIMAL(12,4) NOT NULL,
          metric_type VARCHAR(50) NOT NULL,
          period_start TIMESTAMP NOT NULL,
          period_end TIMESTAMP NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Customer insights
      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_order_insights (
          id SERIAL PRIMARY KEY,
          customer_email VARCHAR(255) NOT NULL,
          total_orders INTEGER DEFAULT 0,
          total_spent DECIMAL(12,2) DEFAULT 0,
          avg_order_value DECIMAL(10,2) DEFAULT 0,
          first_order_date TIMESTAMP NULL,
          last_order_date TIMESTAMP NULL,
          preferred_channel VARCHAR(50) NULL,
          customer_lifetime_value DECIMAL(12,2) DEFAULT 0,
          risk_score INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(customer_email)
        )
      `);

      console.log('📈 Order analytics dashboard tables created successfully');
    } finally {
      client.release();
    }
  }

  // Generate comprehensive order dashboard data
  async getDashboardData(days = 30) {
    try {
      const [
        orderMetrics,
        channelPerformance,
        fulfillmentMetrics,
        customerInsights,
        recentTrends
      ] = await Promise.all([
        this.getOrderMetrics(days),
        this.getChannelPerformance(days),
        this.getFulfillmentMetrics(days),
        this.getCustomerInsights(days),
        this.getRecentTrends(days)
      ]);

      return {
        success: true,
        dashboard: {
          orderMetrics,
          channelPerformance,
          fulfillmentMetrics,
          customerInsights,
          recentTrends,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get key order metrics
  async getOrderMetrics(days = 30) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
          SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending_orders,
          AVG(total_amount) as avg_order_value,
          SUM(total_amount) as total_revenue,
          ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as completion_rate,
          ROUND(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as cancellation_rate
        FROM sales_orders 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `);

      const metrics = result.rows[0] || {};
      
      // Get comparison with previous period
      const previousResult = await client.query(`
        SELECT 
          COUNT(*) as prev_total_orders,
          SUM(total_amount) as prev_total_revenue,
          AVG(total_amount) as prev_avg_order_value
        FROM sales_orders 
        WHERE created_at >= NOW() - INTERVAL '${days * 2} days'
          AND created_at < NOW() - INTERVAL '${days} days'
      `);

      const prevMetrics = previousResult.rows[0] || {};

      return {
        current: {
          totalOrders: parseInt(metrics.total_orders) || 0,
          completedOrders: parseInt(metrics.completed_orders) || 0,
          cancelledOrders: parseInt(metrics.cancelled_orders) || 0,
          pendingOrders: parseInt(metrics.pending_orders) || 0,
          totalRevenue: parseFloat(metrics.total_revenue) || 0,
          avgOrderValue: parseFloat(metrics.avg_order_value) || 0,
          completionRate: parseFloat(metrics.completion_rate) || 0,
          cancellationRate: parseFloat(metrics.cancellation_rate) || 0
        },
        growth: {
          ordersGrowth: this.calculateGrowth(metrics.total_orders, prevMetrics.prev_total_orders),
          revenueGrowth: this.calculateGrowth(metrics.total_revenue, prevMetrics.prev_total_revenue),
          avgOrderValueGrowth: this.calculateGrowth(metrics.avg_order_value, prevMetrics.prev_avg_order_value)
        }
      };
    } finally {
      client.release();
    }
  }

  // Get channel performance data
  async getChannelPerformance(days = 30) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          channel,
          COUNT(*) as total_orders,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_order_value,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
          ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as completion_rate
        FROM sales_orders 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY channel
        ORDER BY total_revenue DESC
      `);

      return result.rows.map(row => ({
        channel: row.channel,
        totalOrders: parseInt(row.total_orders),
        totalRevenue: parseFloat(row.total_revenue),
        avgOrderValue: parseFloat(row.avg_order_value),
        completedOrders: parseInt(row.completed_orders),
        completionRate: parseFloat(row.completion_rate)
      }));
    } finally {
      client.release();
    }
  }

  // Get fulfillment performance metrics
  async getFulfillmentMetrics(days = 30) {
    const client = await this.pool.connect();
    try {
      // Get lifecycle stage performance
      const stageResult = await client.query(`
        SELECT 
          stage,
          COUNT(*) as total_processed,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/3600) as avg_duration_hours,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as currently_active
        FROM order_lifecycle_stages 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY stage
        ORDER BY total_processed DESC
      `);

      // Get shipping performance
      const shippingResult = await client.query(`
        SELECT 
          carrier,
          COUNT(*) as total_shipments,
          AVG(shipping_cost) as avg_shipping_cost,
          COUNT(CASE WHEN dt.is_delivered = TRUE THEN 1 END) as delivered_count,
          AVG(CASE WHEN dt.is_delivered = TRUE 
              THEN EXTRACT(EPOCH FROM (dt.timestamp - sl.shipped_at))/86400 
              END) as avg_delivery_days
        FROM shipping_labels sl
        LEFT JOIN delivery_tracking dt ON sl.tracking_number = dt.tracking_number AND dt.is_delivered = TRUE
        WHERE sl.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY carrier
        ORDER BY total_shipments DESC
      `);

      return {
        stagePerformance: stageResult.rows.map(row => ({
          stage: row.stage,
          totalProcessed: parseInt(row.total_processed),
          avgDurationHours: parseFloat(row.avg_duration_hours) || 0,
          currentlyActive: parseInt(row.currently_active)
        })),
        shippingPerformance: shippingResult.rows.map(row => ({
          carrier: row.carrier,
          totalShipments: parseInt(row.total_shipments),
          avgShippingCost: parseFloat(row.avg_shipping_cost),
          deliveredCount: parseInt(row.delivered_count) || 0,
          avgDeliveryDays: parseFloat(row.avg_delivery_days) || 0,
          deliveryRate: row.total_shipments > 0 ? 
            Math.round((parseInt(row.delivered_count) || 0) * 100 / parseInt(row.total_shipments)) : 0
        }))
      };
    } finally {
      client.release();
    }
  }

  // Get customer insights
  async getCustomerInsights(days = 30) {
    const client = await this.pool.connect();
    try {
      // Top customers by revenue
      const topCustomersResult = await client.query(`
        SELECT 
          customer_email,
          COUNT(*) as total_orders,
          SUM(total_amount) as total_spent,
          AVG(total_amount) as avg_order_value,
          MAX(created_at) as last_order_date
        FROM sales_orders 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY customer_email
        ORDER BY total_spent DESC
        LIMIT 10
      `);

      // Customer segments
      const segmentResult = await client.query(`
        SELECT 
          CASE 
            WHEN total_spent >= 1000 THEN 'VIP'
            WHEN total_spent >= 500 THEN 'Premium'
            WHEN total_spent >= 100 THEN 'Regular'
            ELSE 'New'
          END as segment,
          COUNT(*) as customer_count,
          AVG(total_spent) as avg_spent,
          SUM(total_spent) as segment_revenue
        FROM (
          SELECT 
            customer_email,
            SUM(total_amount) as total_spent
          FROM sales_orders 
          WHERE created_at >= NOW() - INTERVAL '${days} days'
          GROUP BY customer_email
        ) customer_totals
        GROUP BY segment
        ORDER BY segment_revenue DESC
      `);

      return {
        topCustomers: topCustomersResult.rows.map(row => ({
          customerEmail: row.customer_email,
          totalOrders: parseInt(row.total_orders),
          totalSpent: parseFloat(row.total_spent),
          avgOrderValue: parseFloat(row.avg_order_value),
          lastOrderDate: row.last_order_date
        })),
        customerSegments: segmentResult.rows.map(row => ({
          segment: row.segment,
          customerCount: parseInt(row.customer_count),
          avgSpent: parseFloat(row.avg_spent),
          segmentRevenue: parseFloat(row.segment_revenue)
        }))
      };
    } finally {
      client.release();
    }
  }

  // Get recent trends
  async getRecentTrends(days = 30) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          DATE(created_at) as order_date,
          COUNT(*) as daily_orders,
          SUM(total_amount) as daily_revenue,
          AVG(total_amount) as daily_avg_order_value
        FROM sales_orders 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY order_date ASC
      `);

      return result.rows.map(row => ({
        date: row.order_date,
        orders: parseInt(row.daily_orders),
        revenue: parseFloat(row.daily_revenue),
        avgOrderValue: parseFloat(row.daily_avg_order_value)
      }));
    } finally {
      client.release();
    }
  }

  // Generate and cache daily analytics
  async generateDailyAnalytics(date = new Date()) {
    const client = await this.pool.connect();
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      // Get channel data for the date
      const channelResult = await client.query(`
        SELECT 
          channel,
          COUNT(*) as total_orders,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END) as pending_orders
        FROM sales_orders 
        WHERE DATE(created_at) = $1
        GROUP BY channel
      `, [dateStr]);

      // Insert or update analytics
      for (const row of channelResult.rows) {
        await client.query(`
          INSERT INTO order_analytics_daily (
            date, channel, total_orders, total_revenue, avg_order_value,
            completed_orders, cancelled_orders, pending_orders
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (date, channel) 
          DO UPDATE SET 
            total_orders = $3,
            total_revenue = $4,
            avg_order_value = $5,
            completed_orders = $6,
            cancelled_orders = $7,
            pending_orders = $8
        `, [
          dateStr,
          row.channel,
          row.total_orders,
          row.total_revenue,
          row.avg_order_value,
          row.completed_orders,
          row.cancelled_orders,
          row.pending_orders
        ]);
      }

      return {
        success: true,
        date: dateStr,
        channelsProcessed: channelResult.rows.length
      };
    } finally {
      client.release();
    }
  }

  // Get real-time order status
  async getRealTimeStatus() {
    const client = await this.pool.connect();
    try {
      // Active orders by stage
      const stageResult = await client.query(`
        SELECT 
          stage,
          COUNT(*) as active_count,
          AVG(EXTRACT(EPOCH FROM (NOW() - started_at))/3600) as avg_time_in_stage_hours
        FROM order_lifecycle_stages 
        WHERE status = 'active'
        GROUP BY stage
        ORDER BY active_count DESC
      `);

      // Recent order activity (last 24 hours)
      const activityResult = await client.query(`
        SELECT 
          COUNT(*) as new_orders_24h,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_24h,
          SUM(total_amount) as revenue_24h
        FROM sales_orders 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);

      // Pending notifications
      const notificationResult = await client.query(`
        SELECT 
          COUNT(*) as pending_notifications,
          COUNT(CASE WHEN priority <= 3 THEN 1 END) as high_priority_notifications
        FROM notification_queue 
        WHERE status = 'pending'
      `);

      return {
        success: true,
        realTimeStatus: {
          activeOrdersByStage: stageResult.rows.map(row => ({
            stage: row.stage,
            activeCount: parseInt(row.active_count),
            avgTimeInStageHours: parseFloat(row.avg_time_in_stage_hours) || 0
          })),
          last24Hours: {
            newOrders: parseInt(activityResult.rows[0]?.new_orders_24h) || 0,
            completedOrders: parseInt(activityResult.rows[0]?.completed_24h) || 0,
            revenue: parseFloat(activityResult.rows[0]?.revenue_24h) || 0
          },
          notifications: {
            pending: parseInt(notificationResult.rows[0]?.pending_notifications) || 0,
            highPriority: parseInt(notificationResult.rows[0]?.high_priority_notifications) || 0
          }
        }
      };
    } finally {
      client.release();
    }
  }

  // Helper method to calculate growth percentage
  calculateGrowth(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  // Get order analytics for specific date range
  async getAnalyticsByDateRange(startDate, endDate) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          date,
          channel,
          total_orders,
          total_revenue,
          avg_order_value,
          completed_orders,
          cancelled_orders
        FROM order_analytics_daily 
        WHERE date >= $1 AND date <= $2
        ORDER BY date ASC, channel ASC
      `, [startDate, endDate]);

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

module.exports = OrderAnalyticsDashboard;
