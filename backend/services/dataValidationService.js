// =====================================================
// FILE: backend/services/dataValidationService.js
// MILESTONE 12: Data Validation System
// =====================================================

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class DataValidationService {
  constructor() {
    this.validationRules = new Map();
    this.validationHistory = [];
    this.qualityMetrics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      criticalErrors: 0
    };
  }

  async initialize() {
    console.log('🔍 Initializing Data Validation Service...');
    
    try {
      await this.createValidationTables();
      await this.loadValidationRules();
      console.log('✅ DataValidationService initialized successfully');
    } catch (error) {
      console.error('❌ DataValidationService initialization failed:', error.message);
      throw error;
    }
  }

  async createValidationTables() {
    const createTablesQuery = `
      -- Data validation rules table
      CREATE TABLE IF NOT EXISTS data_validation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_name VARCHAR(255) NOT NULL UNIQUE,
        rule_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        field_name VARCHAR(255),
        validation_logic JSONB NOT NULL,
        severity VARCHAR(50) DEFAULT 'medium',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Data validation results table
      CREATE TABLE IF NOT EXISTS data_validation_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        validation_batch_id UUID NOT NULL,
        rule_id UUID REFERENCES data_validation_rules(id),
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID,
        field_name VARCHAR(255),
        validation_status VARCHAR(50) NOT NULL,
        error_message TEXT,
        severity VARCHAR(50),
        validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolution_notes TEXT
      );

      -- Data quality metrics table
      CREATE TABLE IF NOT EXISTS data_quality_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_date DATE NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        channel_id UUID,
        total_records INTEGER DEFAULT 0,
        valid_records INTEGER DEFAULT 0,
        invalid_records INTEGER DEFAULT 0,
        quality_score DECIMAL(5,2),
        critical_errors INTEGER DEFAULT 0,
        warnings INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Data validation batches table
      CREATE TABLE IF NOT EXISTS data_validation_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_name VARCHAR(255) NOT NULL,
        validation_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'running',
        total_records INTEGER DEFAULT 0,
        processed_records INTEGER DEFAULT 0,
        valid_records INTEGER DEFAULT 0,
        invalid_records INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        error_summary JSONB
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_validation_results_batch ON data_validation_results(validation_batch_id);
      CREATE INDEX IF NOT EXISTS idx_validation_results_entity ON data_validation_results(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_quality_metrics_date ON data_quality_metrics(metric_date);
      CREATE INDEX IF NOT EXISTS idx_validation_batches_status ON data_validation_batches(status);
    `;

    await pool.query(createTablesQuery);
    console.log('📊 Data validation tables created successfully');
  }

  async loadValidationRules() {
    // Load default validation rules
    const defaultRules = [
      {
        rule_name: 'product_sku_required',
        rule_type: 'required_field',
        entity_type: 'product',
        field_name: 'sku',
        validation_logic: { required: true, min_length: 1 },
        severity: 'critical'
      },
      {
        rule_name: 'product_price_positive',
        rule_type: 'numeric_range',
        entity_type: 'product',
        field_name: 'price',
        validation_logic: { min: 0.01, max: 999999.99 },
        severity: 'high'
      },
      {
        rule_name: 'order_email_format',
        rule_type: 'format_validation',
        entity_type: 'order',
        field_name: 'customer_email',
        validation_logic: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
        severity: 'high'
      },
      {
        rule_name: 'inventory_quantity_non_negative',
        rule_type: 'numeric_range',
        entity_type: 'inventory',
        field_name: 'quantity',
        validation_logic: { min: 0 },
        severity: 'medium'
      },
      {
        rule_name: 'channel_order_id_unique',
        rule_type: 'uniqueness',
        entity_type: 'order',
        field_name: 'channel_order_id',
        validation_logic: { unique_per_channel: true },
        severity: 'critical'
      }
    ];

    for (const rule of defaultRules) {
      await this.upsertValidationRule(rule);
    }

    console.log(`📋 Loaded ${defaultRules.length} default validation rules`);
  }

  async upsertValidationRule(rule) {
    const query = `
      INSERT INTO data_validation_rules 
      (rule_name, rule_type, entity_type, field_name, validation_logic, severity)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (rule_name) 
      DO UPDATE SET 
        rule_type = EXCLUDED.rule_type,
        entity_type = EXCLUDED.entity_type,
        field_name = EXCLUDED.field_name,
        validation_logic = EXCLUDED.validation_logic,
        severity = EXCLUDED.severity,
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [
      rule.rule_name,
      rule.rule_type,
      rule.entity_type,
      rule.field_name,
      JSON.stringify(rule.validation_logic),
      rule.severity
    ]);
  }

  async validateProduct(productData, channelId = null) {
    const batchId = await this.createValidationBatch('product_validation', 'Product Data Validation');
    const results = [];

    try {
      // SKU validation
      const skuResult = await this.validateField(
        productData, 'sku', 'product_sku_required', batchId, productData.id
      );
      results.push(skuResult);

      // Price validation
      if (productData.price !== undefined) {
        const priceResult = await this.validateField(
          productData, 'price', 'product_price_positive', batchId, productData.id
        );
        results.push(priceResult);
      }

      // Name validation
      if (!productData.name || productData.name.trim().length === 0) {
        results.push(await this.recordValidationResult(
          batchId, null, 'product', productData.id, 'name',
          'failed', 'Product name is required', 'high'
        ));
      }

      // Category validation
      if (productData.category && typeof productData.category !== 'string') {
        results.push(await this.recordValidationResult(
          batchId, null, 'product', productData.id, 'category',
          'failed', 'Product category must be a string', 'medium'
        ));
      }

      await this.completeValidationBatch(batchId, results);
      return this.formatValidationResults(batchId, results);

    } catch (error) {
      await this.failValidationBatch(batchId, error.message);
      throw error;
    }
  }

  async validateOrder(orderData, channelId = null) {
    const batchId = await this.createValidationBatch('order_validation', 'Order Data Validation');
    const results = [];

    try {
      // Email validation
      if (orderData.customer_email) {
        const emailResult = await this.validateField(
          orderData, 'customer_email', 'order_email_format', batchId, orderData.id
        );
        results.push(emailResult);
      }

      // Order amount validation
      if (orderData.total_amount !== undefined) {
        if (orderData.total_amount <= 0) {
          results.push(await this.recordValidationResult(
            batchId, null, 'order', orderData.id, 'total_amount',
            'failed', 'Order total must be positive', 'critical'
          ));
        }
      }

      // Channel order ID uniqueness
      if (orderData.channel_order_id && channelId) {
        const uniquenessResult = await this.validateChannelOrderIdUniqueness(
          orderData.channel_order_id, channelId, batchId, orderData.id
        );
        results.push(uniquenessResult);
      }

      // Order items validation
      if (orderData.items && Array.isArray(orderData.items)) {
        for (let i = 0; i < orderData.items.length; i++) {
          const item = orderData.items[i];
          if (!item.product_id || !item.quantity || item.quantity <= 0) {
            results.push(await this.recordValidationResult(
              batchId, null, 'order', orderData.id, `items[${i}]`,
              'failed', 'Order item must have valid product_id and positive quantity', 'high'
            ));
          }
        }
      }

      await this.completeValidationBatch(batchId, results);
      return this.formatValidationResults(batchId, results);

    } catch (error) {
      await this.failValidationBatch(batchId, error.message);
      throw error;
    }
  }

  async validateInventory(inventoryData, channelId = null) {
    const batchId = await this.createValidationBatch('inventory_validation', 'Inventory Data Validation');
    const results = [];

    try {
      // Quantity validation
      const quantityResult = await this.validateField(
        inventoryData, 'quantity', 'inventory_quantity_non_negative', batchId, inventoryData.id
      );
      results.push(quantityResult);

      // Product ID validation
      if (!inventoryData.product_id) {
        results.push(await this.recordValidationResult(
          batchId, null, 'inventory', inventoryData.id, 'product_id',
          'failed', 'Product ID is required for inventory records', 'critical'
        ));
      }

      // Reserved quantity validation
      if (inventoryData.reserved_quantity !== undefined) {
        if (inventoryData.reserved_quantity < 0) {
          results.push(await this.recordValidationResult(
            batchId, null, 'inventory', inventoryData.id, 'reserved_quantity',
            'failed', 'Reserved quantity cannot be negative', 'medium'
          ));
        }

        if (inventoryData.reserved_quantity > inventoryData.quantity) {
          results.push(await this.recordValidationResult(
            batchId, null, 'inventory', inventoryData.id, 'reserved_quantity',
            'failed', 'Reserved quantity cannot exceed total quantity', 'high'
          ));
        }
      }

      await this.completeValidationBatch(batchId, results);
      return this.formatValidationResults(batchId, results);

    } catch (error) {
      await this.failValidationBatch(batchId, error.message);
      throw error;
    }
  }

  async validateField(data, fieldName, ruleName, batchId, entityId) {
    const rule = await this.getValidationRule(ruleName);
    if (!rule) {
      return await this.recordValidationResult(
        batchId, null, 'unknown', entityId, fieldName,
        'error', `Validation rule ${ruleName} not found`, 'low'
      );
    }

    const fieldValue = data[fieldName];
    const logic = rule.validation_logic;

    try {
      let isValid = true;
      let errorMessage = null;

      switch (rule.rule_type) {
        case 'required_field':
          if (logic.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
            isValid = false;
            errorMessage = `${fieldName} is required`;
          }
          break;

        case 'numeric_range':
          if (fieldValue !== undefined && fieldValue !== null) {
            const numValue = parseFloat(fieldValue);
            if (isNaN(numValue)) {
              isValid = false;
              errorMessage = `${fieldName} must be a valid number`;
            } else {
              if (logic.min !== undefined && numValue < logic.min) {
                isValid = false;
                errorMessage = `${fieldName} must be at least ${logic.min}`;
              }
              if (logic.max !== undefined && numValue > logic.max) {
                isValid = false;
                errorMessage = `${fieldName} must not exceed ${logic.max}`;
              }
            }
          }
          break;

        case 'format_validation':
          if (fieldValue && logic.pattern) {
            const regex = new RegExp(logic.pattern);
            if (!regex.test(fieldValue)) {
              isValid = false;
              errorMessage = `${fieldName} format is invalid`;
            }
          }
          break;
      }

      return await this.recordValidationResult(
        batchId, rule.id, rule.entity_type, entityId, fieldName,
        isValid ? 'passed' : 'failed', errorMessage, rule.severity
      );

    } catch (error) {
      return await this.recordValidationResult(
        batchId, rule.id, rule.entity_type, entityId, fieldName,
        'error', `Validation error: ${error.message}`, 'medium'
      );
    }
  }

  async validateChannelOrderIdUniqueness(channelOrderId, channelId, batchId, entityId) {
    const query = `
      SELECT COUNT(*) as count 
      FROM sales_orders 
      WHERE channel_order_id = $1 AND channel_id = $2
    `;
    
    const result = await pool.query(query, [channelOrderId, channelId]);
    const count = parseInt(result.rows[0].count);

    const isValid = count === 0;
    const errorMessage = isValid ? null : `Channel order ID ${channelOrderId} already exists`;

    return await this.recordValidationResult(
      batchId, null, 'order', entityId, 'channel_order_id',
      isValid ? 'passed' : 'failed', errorMessage, 'critical'
    );
  }

  async createValidationBatch(validationType, batchName) {
    const query = `
      INSERT INTO data_validation_batches (batch_name, validation_type)
      VALUES ($1, $2)
      RETURNING id
    `;
    
    const result = await pool.query(query, [batchName, validationType]);
    return result.rows[0].id;
  }

  async recordValidationResult(batchId, ruleId, entityType, entityId, fieldName, status, errorMessage, severity) {
    const query = `
      INSERT INTO data_validation_results 
      (validation_batch_id, rule_id, entity_type, entity_id, field_name, validation_status, error_message, severity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await pool.query(query, [
      batchId, ruleId, entityType, entityId, fieldName, status, errorMessage, severity
    ]);

    // Update metrics
    this.qualityMetrics.totalValidations++;
    if (status === 'passed') {
      this.qualityMetrics.passedValidations++;
    } else if (status === 'failed') {
      this.qualityMetrics.failedValidations++;
      if (severity === 'critical') {
        this.qualityMetrics.criticalErrors++;
      }
    }

    return result.rows[0];
  }

  async completeValidationBatch(batchId, results) {
    const validCount = results.filter(r => r.validation_status === 'passed').length;
    const invalidCount = results.filter(r => r.validation_status === 'failed').length;

    const query = `
      UPDATE data_validation_batches 
      SET status = 'completed',
          total_records = $2,
          processed_records = $2,
          valid_records = $3,
          invalid_records = $4,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await pool.query(query, [batchId, results.length, validCount, invalidCount]);
  }

  async failValidationBatch(batchId, errorMessage) {
    const query = `
      UPDATE data_validation_batches 
      SET status = 'failed',
          completed_at = CURRENT_TIMESTAMP,
          error_summary = $2
      WHERE id = $1
    `;

    await pool.query(query, [batchId, JSON.stringify({ error: errorMessage })]);
  }

  async getValidationRule(ruleName) {
    const query = `
      SELECT * FROM data_validation_rules 
      WHERE rule_name = $1 AND is_active = true
    `;
    
    const result = await pool.query(query, [ruleName]);
    return result.rows[0] || null;
  }

  formatValidationResults(batchId, results) {
    const passed = results.filter(r => r.validation_status === 'passed').length;
    const failed = results.filter(r => r.validation_status === 'failed').length;
    const errors = results.filter(r => r.validation_status === 'error').length;
    const criticalErrors = results.filter(r => r.severity === 'critical' && r.validation_status === 'failed').length;

    return {
      success: true,
      batchId,
      summary: {
        total: results.length,
        passed,
        failed,
        errors,
        criticalErrors,
        qualityScore: results.length > 0 ? ((passed / results.length) * 100).toFixed(2) : 100
      },
      details: results.map(r => ({
        field: r.field_name,
        status: r.validation_status,
        severity: r.severity,
        message: r.error_message
      }))
    };
  }

  async getValidationHistory(limit = 50, offset = 0) {
    const query = `
      SELECT 
        b.*,
        COUNT(r.id) as total_results,
        COUNT(CASE WHEN r.validation_status = 'passed' THEN 1 END) as passed_count,
        COUNT(CASE WHEN r.validation_status = 'failed' THEN 1 END) as failed_count
      FROM data_validation_batches b
      LEFT JOIN data_validation_results r ON b.id = r.validation_batch_id
      GROUP BY b.id
      ORDER BY b.started_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);
    return {
      success: true,
      batches: result.rows,
      pagination: { limit, offset, total: result.rows.length }
    };
  }

  async getQualityMetrics(startDate, endDate, entityType = null) {
    let query = `
      SELECT 
        metric_date,
        entity_type,
        SUM(total_records) as total_records,
        SUM(valid_records) as valid_records,
        SUM(invalid_records) as invalid_records,
        AVG(quality_score) as avg_quality_score,
        SUM(critical_errors) as critical_errors,
        SUM(warnings) as warnings
      FROM data_quality_metrics
      WHERE metric_date BETWEEN $1 AND $2
    `;

    const params = [startDate, endDate];

    if (entityType) {
      query += ` AND entity_type = $3`;
      params.push(entityType);
    }

    query += ` GROUP BY metric_date, entity_type ORDER BY metric_date DESC`;

    const result = await pool.query(query, params);
    return {
      success: true,
      metrics: result.rows,
      summary: this.qualityMetrics
    };
  }
}

module.exports = DataValidationService;
