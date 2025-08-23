const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class DataExportService {
  constructor() {
    this.exportFormats = ['csv', 'excel', 'pdf', 'json'];
    this.tempDir = path.join(__dirname, '../temp/exports');
    this.ensureTempDirectory();
  }

  // Ensure temp directory exists
  ensureTempDirectory() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Export sales data
  async exportSalesData(format, parameters = {}) {
    try {
      const data = await this.getSalesData(parameters);
      const filename = `sales_export_${Date.now()}.${format}`;
      const filepath = path.join(this.tempDir, filename);

      switch (format.toLowerCase()) {
        case 'csv':
          return await this.exportToCSV(data, filepath);
        case 'excel':
          return await this.exportToExcel(data, filepath, 'Sales Data');
        case 'pdf':
          return await this.exportToPDF(data, filepath, 'Sales Report');
        case 'json':
          return await this.exportToJSON(data, filepath);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Error exporting sales data:', error);
      throw error;
    }
  }

  // Export KPI data
  async exportKPIData(format, kpiIds = [], parameters = {}) {
    try {
      const kpiCalculationService = require('./kpiCalculationService');
      const kpiResults = await kpiCalculationService.calculateMultipleKPIs(kpiIds, parameters);
      
      const data = kpiResults.map(result => ({
        kpiId: result.kpiId,
        name: result.data?.name || 'Unknown KPI',
        value: result.data?.value || 0,
        unit: result.data?.unit || '',
        status: result.data?.status || 'unknown',
        target: result.data?.target || 0,
        trend: result.data?.trend || 'flat',
        calculatedAt: result.data?.calculatedAt || new Date(),
        success: result.success,
        error: result.error
      }));

      const filename = `kpi_export_${Date.now()}.${format}`;
      const filepath = path.join(this.tempDir, filename);

      switch (format.toLowerCase()) {
        case 'csv':
          return await this.exportToCSV(data, filepath);
        case 'excel':
          return await this.exportToExcel(data, filepath, 'KPI Dashboard');
        case 'pdf':
          return await this.exportToPDF(data, filepath, 'KPI Report');
        case 'json':
          return await this.exportToJSON(data, filepath);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Error exporting KPI data:', error);
      throw error;
    }
  }

  // Export chart data
  async exportChartData(format, chartType, parameters = {}) {
    try {
      let data;
      
      switch (chartType) {
        case 'sales-trend':
          data = await this.getSalesTrendData(parameters);
          break;
        case 'channel-performance':
          data = await this.getChannelPerformanceData(parameters);
          break;
        case 'product-analysis':
          data = await this.getProductAnalysisData(parameters);
          break;
        default:
          throw new Error(`Unsupported chart type: ${chartType}`);
      }

      const filename = `${chartType}_export_${Date.now()}.${format}`;
      const filepath = path.join(this.tempDir, filename);

      switch (format.toLowerCase()) {
        case 'csv':
          return await this.exportToCSV(data, filepath);
        case 'excel':
          return await this.exportToExcel(data, filepath, `${chartType} Data`);
        case 'pdf':
          return await this.exportToPDF(data, filepath, `${chartType} Report`);
        case 'json':
          return await this.exportToJSON(data, filepath);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Error exporting chart data:', error);
      throw error;
    }
  }

  // Get sales data from database
  async getSalesData(parameters = {}) {
    const client = await pool.connect();
    try {
      const { startDate, endDate, channel, limit = 1000 } = parameters;
      
      let query = `
        SELECT 
          o.id,
          o.order_number,
          o.customer_email,
          o.channel,
          o.status,
          o.total_amount,
          o.created_at,
          o.updated_at,
          COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE 1=1
      `;
      
      const queryParams = [];
      let paramIndex = 1;
      
      if (startDate) {
        query += ` AND o.created_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }
      
      if (endDate) {
        query += ` AND o.created_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }
      
      if (channel) {
        query += ` AND o.channel = $${paramIndex}`;
        queryParams.push(channel);
        paramIndex++;
      }
      
      query += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $${paramIndex}`;
      queryParams.push(limit);
      
      const result = await client.query(query, queryParams);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Get sales trend data
  async getSalesTrendData(parameters = {}) {
    const client = await pool.connect();
    try {
      const { startDate, endDate, interval = 'day' } = parameters;
      
      const query = `
        SELECT 
          DATE_TRUNC($1, created_at) as period,
          COUNT(*) as order_count,
          SUM(total_amount) as revenue,
          AVG(total_amount) as avg_order_value
        FROM orders
        WHERE created_at >= $2 AND created_at <= $3
        AND status IN ('completed', 'processing', 'shipped')
        GROUP BY DATE_TRUNC($1, created_at)
        ORDER BY period
      `;
      
      const result = await client.query(query, [interval, startDate, endDate]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Get channel performance data
  async getChannelPerformanceData(parameters = {}) {
    const client = await pool.connect();
    try {
      const { startDate, endDate } = parameters;
      
      const query = `
        SELECT 
          channel,
          COUNT(*) as order_count,
          SUM(total_amount) as revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(DISTINCT customer_email) as unique_customers
        FROM orders
        WHERE created_at >= $1 AND created_at <= $2
        AND status IN ('completed', 'processing', 'shipped')
        GROUP BY channel
        ORDER BY revenue DESC
      `;
      
      const result = await client.query(query, [startDate, endDate]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Get product analysis data
  async getProductAnalysisData(parameters = {}) {
    const client = await pool.connect();
    try {
      const { startDate, endDate, limit = 100 } = parameters;
      
      const query = `
        SELECT 
          oi.product_name,
          oi.sku,
          COUNT(*) as order_count,
          SUM(oi.quantity) as total_quantity,
          SUM(oi.price * oi.quantity) as revenue,
          AVG(oi.price) as avg_price
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= $1 AND o.created_at <= $2
        AND o.status IN ('completed', 'processing', 'shipped')
        GROUP BY oi.product_name, oi.sku
        ORDER BY revenue DESC
        LIMIT $3
      `;
      
      const result = await client.query(query, [startDate, endDate, limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Export to CSV
  async exportToCSV(data, filepath) {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      fs.writeFileSync(filepath, csvContent, 'utf8');
      
      return {
        success: true,
        filename: path.basename(filepath),
        filepath,
        format: 'csv',
        recordCount: data.length,
        fileSize: fs.statSync(filepath).size
      };
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  // Export to Excel
  async exportToExcel(data, filepath, sheetName = 'Data') {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);

      // Add headers
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);

      // Style headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows
      data.forEach(row => {
        const values = headers.map(header => row[header]);
        worksheet.addRow(values);
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });

      await workbook.xlsx.writeFile(filepath);
      
      return {
        success: true,
        filename: path.basename(filepath),
        filepath,
        format: 'excel',
        recordCount: data.length,
        fileSize: fs.statSync(filepath).size
      };
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  }

  // Export to PDF
  async exportToPDF(data, filepath, title = 'Data Report') {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filepath));

      // Title
      doc.fontSize(20).text(title, 50, 50);
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, 50, 80);
      doc.text(`Total Records: ${data.length}`, 50, 100);

      // Add some spacing
      doc.moveDown(2);

      // Table headers
      const headers = Object.keys(data[0]);
      const startY = doc.y;
      const columnWidth = 80;
      
      headers.forEach((header, index) => {
        doc.text(header, 50 + (index * columnWidth), startY, { width: columnWidth - 5 });
      });

      doc.moveDown();

      // Table data (limit to first 50 rows for PDF readability)
      const limitedData = data.slice(0, 50);
      limitedData.forEach((row, rowIndex) => {
        const rowY = doc.y;
        headers.forEach((header, colIndex) => {
          const value = row[header];
          const displayValue = value !== null && value !== undefined ? value.toString() : '';
          doc.text(displayValue.substring(0, 15), 50 + (colIndex * columnWidth), rowY, { 
            width: columnWidth - 5 
          });
        });
        doc.moveDown(0.5);
        
        // Add new page if needed
        if (doc.y > 700) {
          doc.addPage();
        }
      });

      if (data.length > 50) {
        doc.moveDown();
        doc.text(`... and ${data.length - 50} more records`, 50, doc.y);
      }

      doc.end();
      
      return {
        success: true,
        filename: path.basename(filepath),
        filepath,
        format: 'pdf',
        recordCount: data.length,
        fileSize: fs.statSync(filepath).size
      };
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  }

  // Export to JSON
  async exportToJSON(data, filepath) {
    try {
      const jsonData = {
        exportedAt: new Date().toISOString(),
        recordCount: data.length,
        data: data
      };

      fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2), 'utf8');
      
      return {
        success: true,
        filename: path.basename(filepath),
        filepath,
        format: 'json',
        recordCount: data.length,
        fileSize: fs.statSync(filepath).size
      };
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      throw error;
    }
  }

  // Clean up old export files
  async cleanupOldExports(maxAgeHours = 24) {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      let deletedCount = 0;
      files.forEach(file => {
        const filepath = path.join(this.tempDir, file);
        const stats = fs.statSync(filepath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      });

      return { deletedCount };
    } catch (error) {
      console.error('Error cleaning up old exports:', error);
      throw error;
    }
  }

  // Get export file info
  getExportInfo(filename) {
    const filepath = path.join(this.tempDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return null;
    }

    const stats = fs.statSync(filepath);
    return {
      filename,
      filepath,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime
    };
  }

  // Get supported formats
  getSupportedFormats() {
    return this.exportFormats;
  }
}

module.exports = new DataExportService();
