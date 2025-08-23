// =====================================================
// FILE: backend/services/dataQualityMonitor.js
// MILESTONE 12: Data Validation System - Quality Monitor
// =====================================================

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class DataQualityMonitor {
  constructor() {
    this.monitoringActive = false;
    this.qualityThresholds = {
      critical: 95, // 95% quality score required
      warning: 85,  // 85% quality score triggers warning
      acceptable: 75 // 75% minimum acceptable quality
    };
    this.monitoringInterval = null;
    this.alertSubscribers = new Set();
  }

  async initialize() {
    console.log('📊 Initializing Data Quality Monitor...');
    
    try {
      await this.createMonitoringTables();
      await this.setupQualityMetrics();
      await this.startMonitoring();
      console.log('✅ DataQualityMonitor initialized successfully');
    } catch (error) {
      console.error('❌ DataQualityMonitor initialization failed:', error.message);
      throw error;
    }
  }

  async createMonitoringTables() {
    const createTablesQuery = `
      -- Data quality monitoring dashboard
      CREATE TABLE IF NOT EXISTS data_quality_dashboard (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_name VARCHAR(255) NOT NULL,
        metric_category VARCHAR(100) NOT NULL,
        current_value DECIMAL(10,4),
        previous_value DECIMAL(10,4),
        threshold_critical DECIMAL(10,4),
        threshold_warning DECIMAL(10,4),
        status VARCHAR(50) DEFAULT 'healthy',
        trend VARCHAR(20) DEFAULT 'stable',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(metric_name, metric_category)
      );

      -- Real-time quality alerts
      CREATE TABLE IF NOT EXISTS quality_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        entity_type VARCHAR(100),
        entity_id UUID,
        channel_id UUID,
        alert_title VARCHAR(255) NOT NULL,
        alert_message TEXT NOT NULL,
        alert_data JSONB,
        status VARCHAR(50) DEFAULT 'active',
        acknowledged_by UUID,
        acknowledged_at TIMESTAMP,
        resolved_at TIMESTAMP,
        auto_resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Quality trend analysis
      CREATE TABLE IF NOT EXISTS quality_trends (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trend_date DATE NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        channel_id UUID,
        quality_score DECIMAL(5,2),
        total_records INTEGER,
        valid_records INTEGER,
        invalid_records INTEGER,
        critical_errors INTEGER,
        warnings INTEGER,
        improvement_suggestions JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Data quality rules monitoring
      CREATE TABLE IF NOT EXISTS quality_rule_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id UUID,
        rule_name VARCHAR(255) NOT NULL,
        execution_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        avg_execution_time_ms DECIMAL(10,2),
        last_execution TIMESTAMP,
        performance_score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for monitoring performance
      CREATE INDEX IF NOT EXISTS idx_quality_alerts_status ON quality_alerts(status, severity);
      CREATE INDEX IF NOT EXISTS idx_quality_trends_date ON quality_trends(trend_date, entity_type);
      CREATE INDEX IF NOT EXISTS idx_quality_dashboard_category ON data_quality_dashboard(metric_category);
      CREATE INDEX IF NOT EXISTS idx_quality_rule_performance_name ON quality_rule_performance(rule_name);
    `;

    await pool.query(createTablesQuery);
    console.log('📊 Data quality monitoring tables created successfully');
  }

  async setupQualityMetrics() {
    const defaultMetrics = [
      {
        metric_name: 'overall_data_quality',
        metric_category: 'system',
        threshold_critical: 95,
        threshold_warning: 85
      },
      {
        metric_name: 'product_data_completeness',
        metric_category: 'product',
        threshold_critical: 98,
        threshold_warning: 90
      },
      {
        metric_name: 'order_data_accuracy',
        metric_category: 'order',
        threshold_critical: 99,
        threshold_warning: 95
      },
      {
        metric_name: 'inventory_data_consistency',
        metric_category: 'inventory',
        threshold_critical: 97,
        threshold_warning: 90
      },
      {
        metric_name: 'channel_sync_reliability',
        metric_category: 'sync',
        threshold_critical: 98,
        threshold_warning: 92
      },
      {
        metric_name: 'validation_rule_effectiveness',
        metric_category: 'validation',
        threshold_critical: 90,
        threshold_warning: 80
      }
    ];

    for (const metric of defaultMetrics) {
      await this.upsertQualityMetric(metric);
    }

    console.log(`📈 Initialized ${defaultMetrics.length} quality metrics`);
  }

  async upsertQualityMetric(metric) {
    const query = `
      INSERT INTO data_quality_dashboard 
      (metric_name, metric_category, threshold_critical, threshold_warning, current_value)
      VALUES ($1, $2, $3, $4, 0)
      ON CONFLICT (metric_name, metric_category) 
      DO UPDATE SET 
        threshold_critical = EXCLUDED.threshold_critical,
        threshold_warning = EXCLUDED.threshold_warning,
        last_updated = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [
      metric.metric_name,
      metric.metric_category,
      metric.threshold_critical,
      metric.threshold_warning
    ]);
  }

  async startMonitoring() {
    if (this.monitoringActive) {
      console.log('📊 Data quality monitoring already active');
      return;
    }

    this.monitoringActive = true;
    
    // Run initial quality assessment
    await this.runQualityAssessment();

    // Set up periodic monitoring (every 15 minutes)
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runQualityAssessment();
      } catch (error) {
        console.error('Quality monitoring error:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    console.log('🔄 Data quality monitoring started (15-minute intervals)');
  }

  async stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.monitoringActive = false;
    console.log('⏹️ Data quality monitoring stopped');
  }

  async runQualityAssessment() {
    console.log('🔍 Running data quality assessment...');

    try {
      const assessmentResults = await Promise.all([
        this.assessProductDataQuality(),
        this.assessOrderDataQuality(),
        this.assessInventoryDataQuality(),
        this.assessChannelSyncQuality(),
        this.assessValidationRuleEffectiveness()
      ]);

      // Calculate overall quality score
      const overallScore = this.calculateOverallQualityScore(assessmentResults);
      await this.updateQualityMetric('overall_data_quality', 'system', overallScore);

      // Generate alerts if necessary
      await this.checkQualityThresholds();

      // Update trends
      await this.updateQualityTrends(assessmentResults);

      console.log(`📊 Quality assessment completed. Overall score: ${overallScore.toFixed(2)}%`);

    } catch (error) {
      console.error('Quality assessment failed:', error);
      await this.createAlert('system_error', 'critical', null, null, null,
        'Quality Assessment Failed', `Quality monitoring system error: ${error.message}`);
    }
  }

  async assessProductDataQuality() {
    const query = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN sku IS NOT NULL AND sku != '' THEN 1 END) as has_sku,
        COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as has_name,
        COUNT(CASE WHEN base_price IS NOT NULL AND base_price > 0 THEN 1 END) as has_valid_price,
        COUNT(CASE WHEN category IS NOT NULL AND category != '' THEN 1 END) as has_category,
        COUNT(CASE WHEN description IS NOT NULL AND LENGTH(description) >= 50 THEN 1 END) as has_description
      FROM products
      WHERE is_active = true
    `;

    const result = await pool.query(query);
    const data = result.rows[0];

    if (data.total_products === 0) {
      return { category: 'product', score: 100, details: 'No products to assess' };
    }

    const completenessScore = (
      (parseInt(data.has_sku) / parseInt(data.total_products)) * 0.25 +
      (parseInt(data.has_name) / parseInt(data.total_products)) * 0.25 +
      (parseInt(data.has_valid_price) / parseInt(data.total_products)) * 0.25 +
      (parseInt(data.has_category) / parseInt(data.total_products)) * 0.15 +
      (parseInt(data.has_description) / parseInt(data.total_products)) * 0.10
    ) * 100;

    await this.updateQualityMetric('product_data_completeness', 'product', completenessScore);

    return {
      category: 'product',
      score: completenessScore,
      details: {
        total_products: data.total_products,
        completeness_breakdown: {
          sku: (parseInt(data.has_sku) / parseInt(data.total_products)) * 100,
          name: (parseInt(data.has_name) / parseInt(data.total_products)) * 100,
          price: (parseInt(data.has_valid_price) / parseInt(data.total_products)) * 100,
          category: (parseInt(data.has_category) / parseInt(data.total_products)) * 100,
          description: (parseInt(data.has_description) / parseInt(data.total_products)) * 100
        }
      }
    };
  }

  async assessOrderDataQuality() {
    const query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN customer_email IS NOT NULL AND customer_email ~ '^[^@]+@[^@]+\\.[^@]+$' THEN 1 END) as valid_emails,
        COUNT(CASE WHEN total_amount IS NOT NULL AND total_amount > 0 THEN 1 END) as valid_amounts,
        COUNT(CASE WHEN channel_order_id IS NOT NULL AND channel_order_id != '' THEN 1 END) as has_channel_id,
        COUNT(CASE WHEN status IS NOT NULL THEN 1 END) as has_status
      FROM sales_orders
      WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const result = await pool.query(query);
    const data = result.rows[0];

    if (data.total_orders === 0) {
      return { category: 'order', score: 100, details: 'No recent orders to assess' };
    }

    const accuracyScore = (
      (parseInt(data.valid_emails) / parseInt(data.total_orders)) * 0.30 +
      (parseInt(data.valid_amounts) / parseInt(data.total_orders)) * 0.30 +
      (parseInt(data.has_channel_id) / parseInt(data.total_orders)) * 0.25 +
      (parseInt(data.has_status) / parseInt(data.total_orders)) * 0.15
    ) * 100;

    await this.updateQualityMetric('order_data_accuracy', 'order', accuracyScore);

    return {
      category: 'order',
      score: accuracyScore,
      details: {
        total_orders: data.total_orders,
        accuracy_breakdown: {
          valid_emails: (parseInt(data.valid_emails) / parseInt(data.total_orders)) * 100,
          valid_amounts: (parseInt(data.valid_amounts) / parseInt(data.total_orders)) * 100,
          has_channel_id: (parseInt(data.has_channel_id) / parseInt(data.total_orders)) * 100,
          has_status: (parseInt(data.has_status) / parseInt(data.total_orders)) * 100
        }
      }
    };
  }

  async assessInventoryDataQuality() {
    const query = `
      SELECT 
        COUNT(*) as total_inventory,
        COUNT(CASE WHEN quantity IS NOT NULL AND quantity >= 0 THEN 1 END) as valid_quantities,
        COUNT(CASE WHEN product_id IS NOT NULL THEN 1 END) as has_product_id,
        COUNT(CASE WHEN channel_id IS NOT NULL THEN 1 END) as has_channel_id,
        COUNT(CASE WHEN reserved_quantity IS NULL OR reserved_quantity <= quantity THEN 1 END) as valid_reserved
      FROM inventory
    `;

    const result = await pool.query(query);
    const data = result.rows[0];

    if (data.total_inventory === 0) {
      return { category: 'inventory', score: 100, details: 'No inventory to assess' };
    }

    const consistencyScore = (
      (parseInt(data.valid_quantities) / parseInt(data.total_inventory)) * 0.35 +
      (parseInt(data.has_product_id) / parseInt(data.total_inventory)) * 0.25 +
      (parseInt(data.has_channel_id) / parseInt(data.total_inventory)) * 0.20 +
      (parseInt(data.valid_reserved) / parseInt(data.total_inventory)) * 0.20
    ) * 100;

    await this.updateQualityMetric('inventory_data_consistency', 'inventory', consistencyScore);

    return {
      category: 'inventory',
      score: consistencyScore,
      details: {
        total_inventory: data.total_inventory,
        consistency_breakdown: {
          valid_quantities: (parseInt(data.valid_quantities) / parseInt(data.total_inventory)) * 100,
          has_product_id: (parseInt(data.has_product_id) / parseInt(data.total_inventory)) * 100,
          has_channel_id: (parseInt(data.has_channel_id) / parseInt(data.total_inventory)) * 100,
          valid_reserved: (parseInt(data.valid_reserved) / parseInt(data.total_inventory)) * 100
        }
      }
    };
  }

  async assessChannelSyncQuality() {
    const query = `
      SELECT 
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_sync_time
      FROM sync_logs
      WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `;

    const result = await pool.query(query);
    const data = result.rows[0];

    if (data.total_syncs === 0) {
      return { category: 'sync', score: 100, details: 'No recent syncs to assess' };
    }

    const reliabilityScore = (parseInt(data.successful_syncs) / parseInt(data.total_syncs)) * 100;

    await this.updateQualityMetric('channel_sync_reliability', 'sync', reliabilityScore);

    return {
      category: 'sync',
      score: reliabilityScore,
      details: {
        total_syncs: data.total_syncs,
        successful_syncs: data.successful_syncs,
        failed_syncs: data.failed_syncs,
        success_rate: reliabilityScore,
        avg_sync_time: parseFloat(data.avg_sync_time || 0)
      }
    };
  }

  async assessValidationRuleEffectiveness() {
    const query = `
      SELECT 
        COUNT(*) as total_validations,
        COUNT(CASE WHEN validation_status = 'passed' THEN 1 END) as passed_validations,
        COUNT(CASE WHEN validation_status = 'failed' THEN 1 END) as failed_validations,
        COUNT(CASE WHEN severity = 'critical' AND validation_status = 'failed' THEN 1 END) as critical_failures
      FROM data_validation_results
      WHERE validated_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `;

    const result = await pool.query(query);
    const data = result.rows[0];

    if (data.total_validations === 0) {
      return { category: 'validation', score: 100, details: 'No recent validations to assess' };
    }

    const effectivenessScore = (parseInt(data.passed_validations) / parseInt(data.total_validations)) * 100;

    await this.updateQualityMetric('validation_rule_effectiveness', 'validation', effectivenessScore);

    return {
      category: 'validation',
      score: effectivenessScore,
      details: {
        total_validations: data.total_validations,
        passed_validations: data.passed_validations,
        failed_validations: data.failed_validations,
        critical_failures: data.critical_failures,
        effectiveness_rate: effectivenessScore
      }
    };
  }

  calculateOverallQualityScore(assessmentResults) {
    const weights = {
      product: 0.25,
      order: 0.30,
      inventory: 0.20,
      sync: 0.15,
      validation: 0.10
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const result of assessmentResults) {
      if (weights[result.category]) {
        totalScore += result.score * weights[result.category];
        totalWeight += weights[result.category];
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  async updateQualityMetric(metricName, category, currentValue) {
    const query = `
      UPDATE data_quality_dashboard 
      SET 
        previous_value = current_value,
        current_value = $3,
        trend = CASE 
          WHEN current_value IS NULL THEN 'stable'
          WHEN $3 > current_value THEN 'improving'
          WHEN $3 < current_value THEN 'declining'
          ELSE 'stable'
        END,
        status = CASE 
          WHEN $3 >= threshold_critical THEN 'healthy'
          WHEN $3 >= threshold_warning THEN 'warning'
          ELSE 'critical'
        END,
        last_updated = CURRENT_TIMESTAMP
      WHERE metric_name = $1 AND metric_category = $2
    `;

    await pool.query(query, [metricName, category, currentValue]);
  }

  async checkQualityThresholds() {
    const query = `
      SELECT * FROM data_quality_dashboard 
      WHERE status IN ('warning', 'critical')
    `;

    const result = await pool.query(query);
    
    for (const metric of result.rows) {
      if (metric.status === 'critical') {
        await this.createAlert('quality_threshold', 'critical', null, null, null,
          `Critical Quality Issue: ${metric.metric_name}`,
          `Quality metric "${metric.metric_name}" has fallen below critical threshold. Current: ${metric.current_value}%, Required: ${metric.threshold_critical}%`
        );
      } else if (metric.status === 'warning') {
        await this.createAlert('quality_threshold', 'warning', null, null, null,
          `Quality Warning: ${metric.metric_name}`,
          `Quality metric "${metric.metric_name}" has fallen below warning threshold. Current: ${metric.current_value}%, Warning: ${metric.threshold_warning}%`
        );
      }
    }
  }

  async createAlert(alertType, severity, entityType, entityId, channelId, title, message, data = null) {
    const query = `
      INSERT INTO quality_alerts 
      (alert_type, severity, entity_type, entity_id, channel_id, alert_title, alert_message, alert_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const result = await pool.query(query, [
      alertType, severity, entityType, entityId, channelId, title, message, JSON.stringify(data)
    ]);

    const alertId = result.rows[0].id;
    
    // Notify subscribers
    this.notifySubscribers({
      id: alertId,
      type: alertType,
      severity,
      title,
      message,
      timestamp: new Date().toISOString()
    });

    return alertId;
  }

  async updateQualityTrends(assessmentResults) {
    const today = new Date().toISOString().split('T')[0];

    for (const result of assessmentResults) {
      const query = `
        INSERT INTO quality_trends 
        (trend_date, entity_type, quality_score, total_records, valid_records, invalid_records)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (trend_date, entity_type) 
        DO UPDATE SET 
          quality_score = EXCLUDED.quality_score,
          total_records = EXCLUDED.total_records,
          valid_records = EXCLUDED.valid_records,
          invalid_records = EXCLUDED.invalid_records
      `;

      const totalRecords = result.details?.total_products || result.details?.total_orders || 
                          result.details?.total_inventory || result.details?.total_syncs || 
                          result.details?.total_validations || 0;
      
      const validRecords = Math.round((result.score / 100) * totalRecords);
      const invalidRecords = totalRecords - validRecords;

      await pool.query(query, [
        today, result.category, result.score, totalRecords, validRecords, invalidRecords
      ]);
    }
  }

  subscribeToAlerts(callback) {
    this.alertSubscribers.add(callback);
  }

  unsubscribeFromAlerts(callback) {
    this.alertSubscribers.delete(callback);
  }

  notifySubscribers(alert) {
    for (const callback of this.alertSubscribers) {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert notification error:', error);
      }
    }
  }

  async getQualityDashboard() {
    const query = `
      SELECT * FROM data_quality_dashboard 
      ORDER BY metric_category, metric_name
    `;

    const result = await pool.query(query);
    return {
      success: true,
      dashboard: result.rows,
      lastUpdated: new Date().toISOString()
    };
  }

  async getActiveAlerts(limit = 50) {
    const query = `
      SELECT * FROM quality_alerts 
      WHERE status = 'active'
      ORDER BY severity DESC, created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return {
      success: true,
      alerts: result.rows
    };
  }

  async getQualityTrends(startDate, endDate, entityType = null) {
    let query = `
      SELECT * FROM quality_trends 
      WHERE trend_date BETWEEN $1 AND $2
    `;

    const params = [startDate, endDate];

    if (entityType) {
      query += ` AND entity_type = $3`;
      params.push(entityType);
    }

    query += ` ORDER BY trend_date DESC, entity_type`;

    const result = await pool.query(query, params);
    return {
      success: true,
      trends: result.rows
    };
  }
}

module.exports = DataQualityMonitor;
