const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class RealTimeSalesService {
  constructor() {
    this.clients = new Set();
    this.updateInterval = null;
    this.startRealTimeUpdates();
  }

  // Add SSE client
  addClient(res) {
    this.clients.add(res);
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    // Handle client disconnect
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  // Remove SSE client
  removeClient(res) {
    this.clients.delete(res);
  }

  // Broadcast data to all connected clients
  broadcast(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach(client => {
      try {
        client.write(message);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        this.clients.delete(client);
      }
    });
  }

  // Start real-time updates
  startRealTimeUpdates() {
    // Update every 30 seconds
    this.updateInterval = setInterval(async () => {
      try {
        const salesData = await this.getCurrentSalesMetrics();
        this.broadcast({
          type: 'sales_update',
          data: salesData,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error in real-time sales update:', error);
      }
    }, 30000);
  }

  // Stop real-time updates
  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Get current sales metrics for real-time dashboard
  async getCurrentSalesMetrics() {
    const client = await pool.connect();
    try {
      // Get today's metrics
      const today = new Date().toISOString().split('T')[0];
      
      // Current day sales summary
      const salesQuery = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COUNT(*) as total_orders,
          COALESCE(AVG(total_amount), 0) as avg_order_value,
          COUNT(DISTINCT customer_email) as unique_customers
        FROM orders 
        WHERE DATE(created_at) = $1 
        AND status IN ('completed', 'processing', 'shipped')
      `;
      
      const salesResult = await client.query(salesQuery, [today]);
      const salesMetrics = salesResult.rows[0];

      // Channel breakdown
      const channelQuery = `
        SELECT 
          channel,
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(*) as orders,
          COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders 
        WHERE DATE(created_at) = $1 
        AND status IN ('completed', 'processing', 'shipped')
        GROUP BY channel
        ORDER BY revenue DESC
      `;
      
      const channelResult = await client.query(channelQuery, [today]);
      const channelMetrics = channelResult.rows;

      // Hourly sales trend (last 24 hours)
      const trendQuery = `
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(*) as orders
        FROM orders 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND status IN ('completed', 'processing', 'shipped')
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour DESC
        LIMIT 24
      `;
      
      const trendResult = await client.query(trendQuery);
      const hourlyTrend = trendResult.rows.map(row => ({
        timestamp: row.hour,
        revenue: parseFloat(row.revenue),
        orders: parseInt(row.orders),
        avgOrderValue: row.orders > 0 ? parseFloat(row.revenue) / parseInt(row.orders) : 0
      }));

      // Top products today
      const productsQuery = `
        SELECT 
          p.name,
          p.sku,
          SUM(oi.quantity) as quantity_sold,
          SUM(oi.price * oi.quantity) as revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE DATE(o.created_at) = $1
        AND o.status IN ('completed', 'processing', 'shipped')
        GROUP BY p.id, p.name, p.sku
        ORDER BY revenue DESC
        LIMIT 10
      `;
      
      const productsResult = await client.query(productsQuery, [today]);
      const topProducts = productsResult.rows;

      // Calculate conversion rates (mock data for now)
      const conversionRates = channelMetrics.map(channel => ({
        channel: channel.channel,
        conversionRate: Math.random() * 5 + 2, // Mock: 2-7%
        customerSatisfaction: Math.random() * 20 + 80 // Mock: 80-100%
      }));

      return {
        summary: {
          totalRevenue: parseFloat(salesMetrics.total_revenue),
          totalOrders: parseInt(salesMetrics.total_orders),
          avgOrderValue: parseFloat(salesMetrics.avg_order_value),
          uniqueCustomers: parseInt(salesMetrics.unique_customers)
        },
        channels: channelMetrics.map(channel => ({
          channel: channel.channel,
          revenue: parseFloat(channel.revenue),
          orders: parseInt(channel.orders),
          avgOrderValue: parseFloat(channel.avg_order_value),
          conversionRate: conversionRates.find(c => c.channel === channel.channel)?.conversionRate || 0,
          customerSatisfaction: conversionRates.find(c => c.channel === channel.channel)?.customerSatisfaction || 0,
          color: this.getChannelColor(channel.channel)
        })),
        hourlyTrend: hourlyTrend.reverse(), // Show oldest to newest
        topProducts: topProducts.map(product => ({
          name: product.name,
          sku: product.sku,
          quantitySold: parseInt(product.quantity_sold),
          revenue: parseFloat(product.revenue)
        })),
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting current sales metrics:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get sales data with filters
  async getSalesData(filters = {}) {
    const client = await pool.connect();
    try {
      let whereConditions = ["status IN ('completed', 'processing', 'shipped')"];
      let queryParams = [];
      let paramCount = 0;

      // Date range filter
      if (filters.startDate) {
        paramCount++;
        whereConditions.push(`created_at >= $${paramCount}`);
        queryParams.push(filters.startDate);
      }
      
      if (filters.endDate) {
        paramCount++;
        whereConditions.push(`created_at <= $${paramCount}`);
        queryParams.push(filters.endDate);
      }

      // Channel filter
      if (filters.channels && filters.channels.length > 0) {
        paramCount++;
        whereConditions.push(`channel = ANY($${paramCount})`);
        queryParams.push(filters.channels);
      }

      // Order value filter
      if (filters.minOrderValue) {
        paramCount++;
        whereConditions.push(`total_amount >= $${paramCount}`);
        queryParams.push(filters.minOrderValue);
      }
      
      if (filters.maxOrderValue) {
        paramCount++;
        whereConditions.push(`total_amount <= $${paramCount}`);
        queryParams.push(filters.maxOrderValue);
      }

      const whereClause = whereConditions.join(' AND ');

      // Main sales query
      const salesQuery = `
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          channel,
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(*) as orders,
          COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders 
        WHERE ${whereClause}
        GROUP BY DATE_TRUNC('day', created_at), channel
        ORDER BY date DESC, revenue DESC
      `;
      
      const result = await client.query(salesQuery, queryParams);
      
      return {
        success: true,
        data: result.rows.map(row => ({
          date: row.date,
          channel: row.channel,
          revenue: parseFloat(row.revenue),
          orders: parseInt(row.orders),
          avgOrderValue: parseFloat(row.avg_order_value)
        })),
        filters: filters
      };

    } catch (error) {
      console.error('Error getting filtered sales data:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get channel colors for consistent visualization
  getChannelColor(channel) {
    const colors = {
      'Amazon': '#FF9900',
      'Shopify': '#96BF48',
      'BestBuy': '#003DA5',
      'eBay': '#E53238',
      'Walmart': '#004C91',
      'Etsy': '#F56400'
    };
    return colors[channel] || '#1976d2';
  }

  // Simulate real-time order event
  async simulateOrderEvent(orderData) {
    this.broadcast({
      type: 'new_order',
      data: orderData,
      timestamp: new Date().toISOString()
    });
  }

  // Get sales velocity metrics
  async getSalesVelocity() {
    const client = await pool.connect();
    try {
      const velocityQuery = `
        WITH hourly_sales AS (
          SELECT 
            DATE_TRUNC('hour', created_at) as hour,
            COUNT(*) as orders,
            SUM(total_amount) as revenue
          FROM orders 
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          AND status IN ('completed', 'processing', 'shipped')
          GROUP BY DATE_TRUNC('hour', created_at)
        )
        SELECT 
          AVG(orders) as avg_orders_per_hour,
          AVG(revenue) as avg_revenue_per_hour,
          MAX(orders) as peak_orders_per_hour,
          MAX(revenue) as peak_revenue_per_hour
        FROM hourly_sales
      `;
      
      const result = await client.query(velocityQuery);
      const velocity = result.rows[0];

      return {
        avgOrdersPerHour: parseFloat(velocity.avg_orders_per_hour) || 0,
        avgRevenuePerHour: parseFloat(velocity.avg_revenue_per_hour) || 0,
        peakOrdersPerHour: parseInt(velocity.peak_orders_per_hour) || 0,
        peakRevenuePerHour: parseFloat(velocity.peak_revenue_per_hour) || 0
      };

    } catch (error) {
      console.error('Error getting sales velocity:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new RealTimeSalesService();
