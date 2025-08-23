const { Pool } = require('pg');

class SalesReportingService {
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
      console.log('✅ SalesReportingService initialized successfully');
    } catch (error) {
      console.error('❌ SalesReportingService initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      // Sales reporting aggregation tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS sales_reports_daily (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          report_date DATE NOT NULL,
          channel_id UUID REFERENCES channels(id),
          total_orders INTEGER DEFAULT 0,
          total_revenue DECIMAL(12,2) DEFAULT 0,
          total_profit DECIMAL(12,2) DEFAULT 0,
          avg_order_value DECIMAL(10,2) DEFAULT 0,
          top_products JSONB DEFAULT '[]',
          customer_segments JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(report_date, channel_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS sales_reports_monthly (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          report_month DATE NOT NULL,
          channel_id UUID REFERENCES channels(id),
          total_orders INTEGER DEFAULT 0,
          total_revenue DECIMAL(12,2) DEFAULT 0,
          total_profit DECIMAL(12,2) DEFAULT 0,
          avg_order_value DECIMAL(10,2) DEFAULT 0,
          growth_rate DECIMAL(5,2) DEFAULT 0,
          top_products JSONB DEFAULT '[]',
          customer_insights JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(report_month, channel_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS product_performance_reports (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          product_id UUID REFERENCES products(id),
          channel_id UUID REFERENCES channels(id),
          report_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          units_sold INTEGER DEFAULT 0,
          revenue DECIMAL(12,2) DEFAULT 0,
          profit DECIMAL(12,2) DEFAULT 0,
          profit_margin DECIMAL(5,2) DEFAULT 0,
          return_rate DECIMAL(5,2) DEFAULT 0,
          inventory_turnover DECIMAL(8,2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(product_id, channel_id, report_period, period_start)
        )
      `);

      console.log('📊 Sales reporting tables created successfully');
    } finally {
      client.release();
    }
  }

  // Get sales summary for a specific period
  async getSalesSummary(startDate, endDate, channelId = null) {
    if (!this.initialized) {
      throw new Error('SalesReportingService not initialized');
    }

    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          COUNT(*) as total_orders,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(DISTINCT customer_email) as unique_customers,
          DATE_TRUNC('day', order_date) as order_day
        FROM sales_orders 
        WHERE order_date >= $1 AND order_date <= $2
      `;
      
      const params = [startDate, endDate];
      
      if (channelId) {
        query += ` AND channel_id = $3`;
        params.push(channelId);
      }
      
      query += ` GROUP BY DATE_TRUNC('day', order_date) ORDER BY order_day`;

      const result = await client.query(query, params);
      
      // Calculate totals
      const totals = result.rows.reduce((acc, row) => ({
        total_orders: acc.total_orders + parseInt(row.total_orders),
        total_revenue: acc.total_revenue + parseFloat(row.total_revenue || 0),
        unique_customers: Math.max(acc.unique_customers, parseInt(row.unique_customers))
      }), { total_orders: 0, total_revenue: 0, unique_customers: 0 });

      return {
        success: true,
        summary: {
          ...totals,
          avg_order_value: totals.total_orders > 0 ? totals.total_revenue / totals.total_orders : 0,
          daily_breakdown: result.rows
        }
      };
    } catch (error) {
      console.error('Sales summary error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Get channel performance comparison
  async getChannelPerformance(startDate, endDate) {
    if (!this.initialized) {
      throw new Error('SalesReportingService not initialized');
    }

    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          c.name as channel_name,
          c.id as channel_id,
          COUNT(so.*) as total_orders,
          SUM(so.total_amount) as total_revenue,
          AVG(so.total_amount) as avg_order_value,
          COUNT(DISTINCT so.customer_email) as unique_customers
        FROM channels c
        LEFT JOIN sales_orders so ON c.id = so.channel_id 
          AND so.order_date >= $1 AND so.order_date <= $2
        WHERE c.is_active = true
        GROUP BY c.id, c.name
        ORDER BY total_revenue DESC NULLS LAST
      `;

      const result = await client.query(query, [startDate, endDate]);
      
      return {
        success: true,
        channels: result.rows.map(row => ({
          channel_name: row.channel_name,
          channel_id: row.channel_id,
          total_orders: parseInt(row.total_orders) || 0,
          total_revenue: parseFloat(row.total_revenue) || 0,
          avg_order_value: parseFloat(row.avg_order_value) || 0,
          unique_customers: parseInt(row.unique_customers) || 0
        }))
      };
    } catch (error) {
      console.error('Channel performance error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Get top performing products
  async getTopProducts(startDate, endDate, channelId = null, limit = 10) {
    if (!this.initialized) {
      throw new Error('SalesReportingService not initialized');
    }

    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          p.name as product_name,
          p.sku,
          p.brand,
          p.category,
          SUM(oi.quantity) as units_sold,
          SUM(oi.total_price) as total_revenue,
          AVG(oi.unit_price) as avg_price,
          COUNT(DISTINCT so.id) as order_count
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN sales_orders so ON oi.order_id = so.id
        WHERE so.order_date >= $1 AND so.order_date <= $2
      `;
      
      const params = [startDate, endDate];
      
      if (channelId) {
        query += ` AND so.channel_id = $3`;
        params.push(channelId);
      }
      
      query += `
        GROUP BY p.id, p.name, p.sku, p.brand, p.category
        ORDER BY total_revenue DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await client.query(query, params);
      
      return {
        success: true,
        products: result.rows.map(row => ({
          product_name: row.product_name,
          sku: row.sku,
          brand: row.brand,
          category: row.category,
          units_sold: parseInt(row.units_sold),
          total_revenue: parseFloat(row.total_revenue),
          avg_price: parseFloat(row.avg_price),
          order_count: parseInt(row.order_count)
        }))
      };
    } catch (error) {
      console.error('Top products error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Get sales trends over time
  async getSalesTrends(startDate, endDate, granularity = 'daily', channelId = null) {
    if (!this.initialized) {
      throw new Error('SalesReportingService not initialized');
    }

    const client = await this.pool.connect();
    try {
      const truncFunction = granularity === 'monthly' ? 'month' : 
                           granularity === 'weekly' ? 'week' : 'day';
      
      let query = `
        SELECT 
          DATE_TRUNC('${truncFunction}', order_date) as period,
          COUNT(*) as orders,
          SUM(total_amount) as revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(DISTINCT customer_email) as unique_customers
        FROM sales_orders 
        WHERE order_date >= $1 AND order_date <= $2
      `;
      
      const params = [startDate, endDate];
      
      if (channelId) {
        query += ` AND channel_id = $3`;
        params.push(channelId);
      }
      
      query += ` GROUP BY DATE_TRUNC('${truncFunction}', order_date) ORDER BY period`;

      const result = await client.query(query, params);
      
      return {
        success: true,
        trends: result.rows.map(row => ({
          period: row.period,
          orders: parseInt(row.orders),
          revenue: parseFloat(row.revenue),
          avg_order_value: parseFloat(row.avg_order_value),
          unique_customers: parseInt(row.unique_customers)
        }))
      };
    } catch (error) {
      console.error('Sales trends error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Get customer segmentation analysis
  async getCustomerSegmentation(startDate, endDate) {
    if (!this.initialized) {
      throw new Error('SalesReportingService not initialized');
    }

    const client = await this.pool.connect();
    try {
      const query = `
        WITH customer_stats AS (
          SELECT 
            customer_email,
            COUNT(*) as order_count,
            SUM(total_amount) as total_spent,
            AVG(total_amount) as avg_order_value,
            MAX(order_date) as last_order_date,
            MIN(order_date) as first_order_date
          FROM sales_orders 
          WHERE order_date >= $1 AND order_date <= $2
          GROUP BY customer_email
        ),
        segments AS (
          SELECT 
            customer_email,
            order_count,
            total_spent,
            avg_order_value,
            CASE 
              WHEN order_count >= 10 AND total_spent >= 1000 THEN 'VIP'
              WHEN order_count >= 5 AND total_spent >= 500 THEN 'Loyal'
              WHEN order_count >= 2 THEN 'Regular'
              ELSE 'New'
            END as segment
          FROM customer_stats
        )
        SELECT 
          segment,
          COUNT(*) as customer_count,
          AVG(order_count) as avg_orders_per_customer,
          AVG(total_spent) as avg_total_spent,
          AVG(avg_order_value) as avg_order_value
        FROM segments
        GROUP BY segment
        ORDER BY avg_total_spent DESC
      `;

      const result = await client.query(query, [startDate, endDate]);
      
      return {
        success: true,
        segments: result.rows.map(row => ({
          segment: row.segment,
          customer_count: parseInt(row.customer_count),
          avg_orders_per_customer: parseFloat(row.avg_orders_per_customer),
          avg_total_spent: parseFloat(row.avg_total_spent),
          avg_order_value: parseFloat(row.avg_order_value)
        }))
      };
    } catch (error) {
      console.error('Customer segmentation error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Generate comprehensive sales report
  async generateComprehensiveReport(startDate, endDate, channelId = null) {
    if (!this.initialized) {
      throw new Error('SalesReportingService not initialized');
    }

    try {
      const [summary, channelPerformance, topProducts, trends, customerSegmentation] = await Promise.all([
        this.getSalesSummary(startDate, endDate, channelId),
        channelId ? null : this.getChannelPerformance(startDate, endDate),
        this.getTopProducts(startDate, endDate, channelId),
        this.getSalesTrends(startDate, endDate, 'daily', channelId),
        this.getCustomerSegmentation(startDate, endDate)
      ]);

      return {
        success: true,
        report: {
          period: { start: startDate, end: endDate },
          channel_id: channelId,
          summary: summary.success ? summary.summary : null,
          channel_performance: channelPerformance?.success ? channelPerformance.channels : null,
          top_products: topProducts.success ? topProducts.products : null,
          trends: trends.success ? trends.trends : null,
          customer_segmentation: customerSegmentation.success ? customerSegmentation.segments : null,
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Comprehensive report error:', error);
      return { success: false, error: error.message };
    }
  }

  // Export data in various formats
  async exportData(data, format = 'json') {
    switch (format.toLowerCase()) {
      case 'csv':
        return this.convertToCSV(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

module.exports = SalesReportingService;
