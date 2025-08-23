const { Pool } = require('pg');
const SalesReportingService = require('./salesReportingService');

class ReportGeneratorService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    this.salesReporting = new SalesReportingService();
    this.initialized = false;
    this.reportTemplates = {};
    this.loadReportTemplates();
  }

  async initialize() {
    try {
      await this.createTables();
      await this.salesReporting.initialize();
      this.initialized = true;
      console.log('✅ ReportGeneratorService initialized successfully');
    } catch (error) {
      console.error('❌ ReportGeneratorService initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      // Report templates table
      await client.query(`
        CREATE TABLE IF NOT EXISTS report_templates (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          template_type VARCHAR(50) NOT NULL, -- 'sales', 'inventory', 'performance'
          config JSONB NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_by VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Generated reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS generated_reports (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          template_id UUID REFERENCES report_templates(id),
          report_name VARCHAR(255) NOT NULL,
          report_type VARCHAR(50) NOT NULL,
          parameters JSONB NOT NULL,
          status VARCHAR(50) DEFAULT 'generating', -- 'generating', 'completed', 'failed'
          file_path VARCHAR(500),
          file_size INTEGER,
          generated_by VARCHAR(255),
          generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE
        )
      `);

      // Scheduled reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS scheduled_reports (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          template_id UUID REFERENCES report_templates(id),
          name VARCHAR(255) NOT NULL,
          schedule_cron VARCHAR(100) NOT NULL, -- cron expression
          parameters JSONB NOT NULL,
          recipients JSONB NOT NULL, -- email addresses
          is_active BOOLEAN DEFAULT true,
          last_run TIMESTAMP WITH TIME ZONE,
          next_run TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      console.log('📊 Report generator tables created successfully');
    } finally {
      client.release();
    }
  }

  loadReportTemplates() {
    this.reportTemplates = {
      daily_sales: {
        name: 'Daily Sales Report',
        description: 'Comprehensive daily sales performance report',
        type: 'sales',
        config: {
          sections: ['summary', 'channel_performance', 'top_products'],
          period: 'daily',
          format: 'json'
        }
      },
      weekly_performance: {
        name: 'Weekly Performance Report',
        description: 'Weekly sales and performance analysis',
        type: 'performance',
        config: {
          sections: ['summary', 'trends', 'customer_segmentation'],
          period: 'weekly',
          format: 'json'
        }
      },
      monthly_comprehensive: {
        name: 'Monthly Comprehensive Report',
        description: 'Complete monthly business performance report',
        type: 'comprehensive',
        config: {
          sections: ['summary', 'channel_performance', 'top_products', 'trends', 'customer_segmentation'],
          period: 'monthly',
          format: 'json'
        }
      },
      product_performance: {
        name: 'Product Performance Report',
        description: 'Detailed product sales and performance analysis',
        type: 'product',
        config: {
          sections: ['top_products', 'category_analysis'],
          period: 'custom',
          format: 'json'
        }
      },
      channel_comparison: {
        name: 'Channel Comparison Report',
        description: 'Multi-channel performance comparison',
        type: 'channel',
        config: {
          sections: ['channel_performance', 'channel_trends'],
          period: 'custom',
          format: 'json'
        }
      }
    };
  }

  // Generate report based on template
  async generateReport(templateName, parameters = {}) {
    if (!this.initialized) {
      throw new Error('ReportGeneratorService not initialized');
    }

    const template = this.reportTemplates[templateName];
    if (!template) {
      throw new Error(`Report template '${templateName}' not found`);
    }

    try {
      const reportId = await this.createReportRecord(templateName, parameters);
      
      // Set default date range if not provided
      const endDate = parameters.endDate || new Date().toISOString().split('T')[0];
      const startDate = parameters.startDate || this.calculateStartDate(endDate, template.config.period);
      
      const reportData = await this.buildReportData(template, {
        ...parameters,
        startDate,
        endDate
      });

      await this.updateReportStatus(reportId, 'completed', reportData);

      return {
        success: true,
        report_id: reportId,
        template: templateName,
        data: reportData,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Report generation error:', error);
      return { success: false, error: error.message };
    }
  }

  async buildReportData(template, parameters) {
    const { startDate, endDate, channelId } = parameters;
    const reportData = {
      template: template.name,
      period: { start: startDate, end: endDate },
      channel_id: channelId || null,
      sections: {}
    };

    // Build each section based on template config
    for (const section of template.config.sections) {
      switch (section) {
        case 'summary':
          const summary = await this.salesReporting.getSalesSummary(startDate, endDate, channelId);
          reportData.sections.summary = summary.success ? summary.summary : null;
          break;

        case 'channel_performance':
          if (!channelId) { // Only show channel comparison if not filtered to specific channel
            const channelPerf = await this.salesReporting.getChannelPerformance(startDate, endDate);
            reportData.sections.channel_performance = channelPerf.success ? channelPerf.channels : null;
          }
          break;

        case 'top_products':
          const topProducts = await this.salesReporting.getTopProducts(startDate, endDate, channelId, 10);
          reportData.sections.top_products = topProducts.success ? topProducts.products : null;
          break;

        case 'trends':
          const trends = await this.salesReporting.getSalesTrends(startDate, endDate, 'daily', channelId);
          reportData.sections.trends = trends.success ? trends.trends : null;
          break;

        case 'customer_segmentation':
          const segments = await this.salesReporting.getCustomerSegmentation(startDate, endDate);
          reportData.sections.customer_segmentation = segments.success ? segments.segments : null;
          break;

        case 'category_analysis':
          const categoryAnalysis = await this.getCategoryAnalysis(startDate, endDate, channelId);
          reportData.sections.category_analysis = categoryAnalysis.success ? categoryAnalysis.categories : null;
          break;

        case 'channel_trends':
          const channelTrends = await this.getChannelTrends(startDate, endDate);
          reportData.sections.channel_trends = channelTrends.success ? channelTrends.trends : null;
          break;
      }
    }

    return reportData;
  }

  async getCategoryAnalysis(startDate, endDate, channelId = null) {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          p.category,
          COUNT(DISTINCT p.id) as product_count,
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
        GROUP BY p.category
        ORDER BY total_revenue DESC
      `;

      const result = await client.query(query, params);
      
      return {
        success: true,
        categories: result.rows.map(row => ({
          category: row.category,
          product_count: parseInt(row.product_count),
          units_sold: parseInt(row.units_sold),
          total_revenue: parseFloat(row.total_revenue),
          avg_price: parseFloat(row.avg_price),
          order_count: parseInt(row.order_count)
        }))
      };
    } catch (error) {
      console.error('Category analysis error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  async getChannelTrends(startDate, endDate) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          c.name as channel_name,
          DATE_TRUNC('day', so.order_date) as day,
          COUNT(*) as orders,
          SUM(so.total_amount) as revenue
        FROM channels c
        LEFT JOIN sales_orders so ON c.id = so.channel_id 
          AND so.order_date >= $1 AND so.order_date <= $2
        WHERE c.is_active = true
        GROUP BY c.name, DATE_TRUNC('day', so.order_date)
        ORDER BY c.name, day
      `;

      const result = await client.query(query, [startDate, endDate]);
      
      // Group by channel
      const channelTrends = {};
      result.rows.forEach(row => {
        if (!channelTrends[row.channel_name]) {
          channelTrends[row.channel_name] = [];
        }
        if (row.day) { // Only add if there's actual data
          channelTrends[row.channel_name].push({
            day: row.day,
            orders: parseInt(row.orders),
            revenue: parseFloat(row.revenue)
          });
        }
      });
      
      return {
        success: true,
        trends: channelTrends
      };
    } catch (error) {
      console.error('Channel trends error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  calculateStartDate(endDate, period) {
    const end = new Date(endDate);
    switch (period) {
      case 'daily':
        return endDate; // Same day
      case 'weekly':
        const weekStart = new Date(end);
        weekStart.setDate(end.getDate() - 7);
        return weekStart.toISOString().split('T')[0];
      case 'monthly':
        const monthStart = new Date(end);
        monthStart.setMonth(end.getMonth() - 1);
        return monthStart.toISOString().split('T')[0];
      default:
        const defaultStart = new Date(end);
        defaultStart.setDate(end.getDate() - 30);
        return defaultStart.toISOString().split('T')[0];
    }
  }

  async createReportRecord(templateName, parameters) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO generated_reports (report_name, report_type, parameters, status, generated_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      
      const result = await client.query(query, [
        this.reportTemplates[templateName].name,
        templateName,
        JSON.stringify(parameters),
        'generating',
        parameters.user || 'system'
      ]);
      
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async updateReportStatus(reportId, status, data = null) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE generated_reports 
        SET status = $1, file_size = $2
        WHERE id = $3
      `;
      
      const fileSize = data ? JSON.stringify(data).length : null;
      await client.query(query, [status, fileSize, reportId]);
    } finally {
      client.release();
    }
  }

  // Get available report templates
  getAvailableTemplates() {
    return Object.keys(this.reportTemplates).map(key => ({
      template_name: key,
      ...this.reportTemplates[key]
    }));
  }

  // Get report history
  async getReportHistory(limit = 20) {
    if (!this.initialized) {
      throw new Error('ReportGeneratorService not initialized');
    }

    const client = await this.pool.connect();
    try {
      const query = `
        SELECT id, report_name, report_type, status, file_size, generated_by, generated_at
        FROM generated_reports
        ORDER BY generated_at DESC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      
      return {
        success: true,
        reports: result.rows
      };
    } catch (error) {
      console.error('Report history error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Export report in different formats
  async exportReport(reportData, format = 'json') {
    switch (format.toLowerCase()) {
      case 'csv':
        return this.exportToCSV(reportData);
      case 'json':
      default:
        return JSON.stringify(reportData, null, 2);
    }
  }

  exportToCSV(reportData) {
    // Convert report sections to CSV format
    let csvContent = `Report: ${reportData.template}\n`;
    csvContent += `Period: ${reportData.period.start} to ${reportData.period.end}\n\n`;

    // Export summary section
    if (reportData.sections.summary) {
      csvContent += "SUMMARY\n";
      csvContent += "Metric,Value\n";
      csvContent += `Total Orders,${reportData.sections.summary.total_orders}\n`;
      csvContent += `Total Revenue,${reportData.sections.summary.total_revenue}\n`;
      csvContent += `Average Order Value,${reportData.sections.summary.avg_order_value}\n`;
      csvContent += `Unique Customers,${reportData.sections.summary.unique_customers}\n\n`;
    }

    // Export top products section
    if (reportData.sections.top_products) {
      csvContent += "TOP PRODUCTS\n";
      csvContent += "Product Name,SKU,Brand,Category,Units Sold,Revenue,Average Price\n";
      reportData.sections.top_products.forEach(product => {
        csvContent += `"${product.product_name}",${product.sku},"${product.brand}","${product.category}",${product.units_sold},${product.total_revenue},${product.avg_price}\n`;
      });
      csvContent += "\n";
    }

    // Export channel performance section
    if (reportData.sections.channel_performance) {
      csvContent += "CHANNEL PERFORMANCE\n";
      csvContent += "Channel,Orders,Revenue,Average Order Value,Unique Customers\n";
      reportData.sections.channel_performance.forEach(channel => {
        csvContent += `"${channel.channel_name}",${channel.total_orders},${channel.total_revenue},${channel.avg_order_value},${channel.unique_customers}\n`;
      });
    }

    return csvContent;
  }
}

module.exports = ReportGeneratorService;
