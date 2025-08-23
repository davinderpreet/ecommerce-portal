// =====================================================
// FILE: backend/services/validationRuleEngine.js
// MILESTONE 12: Data Validation System - Rule Engine
// =====================================================

const pool = require('../database/connection');

class ValidationRuleEngine {
  constructor() {
    this.customRules = new Map();
    this.ruleExecutionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0
    };
  }

  async initialize() {
    console.log('⚙️ Initializing Validation Rule Engine...');
    
    try {
      await this.createRuleEngineTables();
      await this.loadCustomRules();
      await this.setupBusinessRules();
      console.log('✅ ValidationRuleEngine initialized successfully');
    } catch (error) {
      console.error('❌ ValidationRuleEngine initialization failed:', error.message);
      throw error;
    }
  }

  async createRuleEngineTables() {
    const createTablesQuery = `
      -- Custom validation rules table
      CREATE TABLE IF NOT EXISTS custom_validation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_name VARCHAR(255) NOT NULL UNIQUE,
        rule_description TEXT,
        rule_category VARCHAR(100) NOT NULL,
        entity_types TEXT[] NOT NULL,
        conditions JSONB NOT NULL,
        actions JSONB NOT NULL,
        priority INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Rule execution history
      CREATE TABLE IF NOT EXISTS rule_execution_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id UUID REFERENCES custom_validation_rules(id),
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID,
        execution_status VARCHAR(50) NOT NULL,
        execution_time_ms INTEGER,
        conditions_met JSONB,
        actions_taken JSONB,
        error_details TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Business rule configurations
      CREATE TABLE IF NOT EXISTS business_rule_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_name VARCHAR(255) NOT NULL UNIQUE,
        config_type VARCHAR(100) NOT NULL,
        config_values JSONB NOT NULL,
        applies_to_channels TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Rule violation alerts
      CREATE TABLE IF NOT EXISTS rule_violation_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id UUID REFERENCES custom_validation_rules(id),
        violation_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID,
        severity VARCHAR(50) NOT NULL,
        alert_message TEXT NOT NULL,
        alert_data JSONB,
        status VARCHAR(50) DEFAULT 'active',
        acknowledged_by UUID,
        acknowledged_at TIMESTAMP,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_rule_execution_history_rule ON rule_execution_history(rule_id);
      CREATE INDEX IF NOT EXISTS idx_rule_execution_history_entity ON rule_execution_history(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_rule_violation_alerts_status ON rule_violation_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_custom_validation_rules_category ON custom_validation_rules(rule_category);
    `;

    await pool.query(createTablesQuery);
    console.log('⚙️ Validation rule engine tables created successfully');
  }

  async setupBusinessRules() {
    const businessRules = [
      {
        config_name: 'pricing_rules',
        config_type: 'pricing',
        config_values: {
          min_profit_margin: 0.15,
          max_discount_percentage: 0.50,
          price_change_threshold: 0.20,
          competitor_price_monitoring: true
        },
        applies_to_channels: ['shopify', 'amazon', 'bestbuy']
      },
      {
        config_name: 'inventory_rules',
        config_type: 'inventory',
        config_values: {
          low_stock_threshold: 10,
          overselling_prevention: true,
          safety_stock_percentage: 0.10,
          reorder_point_calculation: 'automatic'
        },
        applies_to_channels: ['shopify', 'amazon', 'bestbuy']
      },
      {
        config_name: 'order_processing_rules',
        config_type: 'order_processing',
        config_values: {
          max_order_value: 50000,
          fraud_detection_enabled: true,
          auto_approval_threshold: 1000,
          manual_review_required_countries: ['CN', 'RU', 'NG']
        },
        applies_to_channels: ['shopify', 'amazon', 'bestbuy']
      },
      {
        config_name: 'data_quality_rules',
        config_type: 'data_quality',
        config_values: {
          required_product_fields: ['sku', 'name', 'price', 'category'],
          image_requirements: { min_count: 1, min_resolution: '800x600' },
          description_min_length: 50,
          title_max_length: 200
        },
        applies_to_channels: ['shopify', 'amazon', 'bestbuy']
      }
    ];

    for (const rule of businessRules) {
      await this.upsertBusinessRuleConfig(rule);
    }

    console.log(`📋 Loaded ${businessRules.length} business rule configurations`);
  }

  async loadCustomRules() {
    const customRules = [
      {
        rule_name: 'high_value_order_review',
        rule_description: 'Flag high-value orders for manual review',
        rule_category: 'order_processing',
        entity_types: ['order'],
        conditions: {
          field: 'total_amount',
          operator: 'greater_than',
          value: 5000
        },
        actions: {
          flag_for_review: true,
          notify_manager: true,
          hold_fulfillment: true
        },
        priority: 1
      },
      {
        rule_name: 'duplicate_sku_prevention',
        rule_description: 'Prevent duplicate SKUs across channels',
        rule_category: 'product_integrity',
        entity_types: ['product'],
        conditions: {
          field: 'sku',
          operator: 'duplicate_check',
          scope: 'global'
        },
        actions: {
          reject_duplicate: true,
          generate_alert: true,
          suggest_alternative: true
        },
        priority: 2
      },
      {
        rule_name: 'negative_inventory_alert',
        rule_description: 'Alert when inventory goes negative',
        rule_category: 'inventory_monitoring',
        entity_types: ['inventory'],
        conditions: {
          field: 'quantity',
          operator: 'less_than',
          value: 0
        },
        actions: {
          generate_alert: true,
          notify_inventory_team: true,
          pause_sales: true
        },
        priority: 1
      },
      {
        rule_name: 'price_deviation_check',
        rule_description: 'Check for significant price deviations',
        rule_category: 'pricing_integrity',
        entity_types: ['product'],
        conditions: {
          field: 'price_change_percentage',
          operator: 'greater_than',
          value: 25
        },
        actions: {
          require_approval: true,
          log_price_change: true,
          notify_pricing_team: true
        },
        priority: 2
      },
      {
        rule_name: 'customer_data_completeness',
        rule_description: 'Ensure customer data completeness',
        rule_category: 'data_quality',
        entity_types: ['order'],
        conditions: {
          required_fields: ['customer_email', 'shipping_address', 'billing_address'],
          operator: 'all_present'
        },
        actions: {
          reject_incomplete: false,
          request_completion: true,
          flag_for_followup: true
        },
        priority: 3
      }
    ];

    for (const rule of customRules) {
      await this.upsertCustomRule(rule);
    }

    console.log(`⚙️ Loaded ${customRules.length} custom validation rules`);
  }

  async upsertCustomRule(rule) {
    const query = `
      INSERT INTO custom_validation_rules 
      (rule_name, rule_description, rule_category, entity_types, conditions, actions, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (rule_name) 
      DO UPDATE SET 
        rule_description = EXCLUDED.rule_description,
        rule_category = EXCLUDED.rule_category,
        entity_types = EXCLUDED.entity_types,
        conditions = EXCLUDED.conditions,
        actions = EXCLUDED.actions,
        priority = EXCLUDED.priority,
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [
      rule.rule_name,
      rule.rule_description,
      rule.rule_category,
      rule.entity_types,
      JSON.stringify(rule.conditions),
      JSON.stringify(rule.actions),
      rule.priority
    ]);
  }

  async upsertBusinessRuleConfig(config) {
    const query = `
      INSERT INTO business_rule_configs 
      (config_name, config_type, config_values, applies_to_channels)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (config_name) 
      DO UPDATE SET 
        config_type = EXCLUDED.config_type,
        config_values = EXCLUDED.config_values,
        applies_to_channels = EXCLUDED.applies_to_channels,
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [
      config.config_name,
      config.config_type,
      JSON.stringify(config.config_values),
      config.applies_to_channels
    ]);
  }

  async executeRulesForEntity(entityType, entityData, channelId = null) {
    const startTime = Date.now();
    
    try {
      // Get applicable rules for this entity type
      const rules = await this.getApplicableRules(entityType);
      const results = [];

      for (const rule of rules) {
        const ruleResult = await this.executeRule(rule, entityData, channelId);
        results.push(ruleResult);
      }

      const executionTime = Date.now() - startTime;
      this.updateExecutionStats(true, executionTime);

      return {
        success: true,
        entityType,
        entityId: entityData.id,
        rulesExecuted: results.length,
        executionTimeMs: executionTime,
        results: results.filter(r => r.triggered) // Only return triggered rules
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateExecutionStats(false, executionTime);
      throw error;
    }
  }

  async executeRule(rule, entityData, channelId) {
    const startTime = Date.now();
    
    try {
      const conditionsMet = await this.evaluateConditions(rule.conditions, entityData, channelId);
      
      if (conditionsMet.result) {
        const actionResults = await this.executeActions(rule.actions, entityData, rule.id);
        
        await this.logRuleExecution(
          rule.id, entityData.id || null, rule.entity_types[0],
          'success', Date.now() - startTime, conditionsMet.details, actionResults
        );

        return {
          ruleId: rule.id,
          ruleName: rule.rule_name,
          triggered: true,
          conditionsMet: conditionsMet.details,
          actionsExecuted: actionResults,
          executionTimeMs: Date.now() - startTime
        };
      } else {
        return {
          ruleId: rule.id,
          ruleName: rule.rule_name,
          triggered: false,
          reason: 'Conditions not met'
        };
      }

    } catch (error) {
      await this.logRuleExecution(
        rule.id, entityData.id || null, rule.entity_types[0],
        'error', Date.now() - startTime, null, null, error.message
      );

      return {
        ruleId: rule.id,
        ruleName: rule.rule_name,
        triggered: false,
        error: error.message
      };
    }
  }

  async evaluateConditions(conditions, entityData, channelId) {
    const details = {};
    
    try {
      if (conditions.field && conditions.operator && conditions.value !== undefined) {
        // Simple field-based condition
        const fieldValue = this.getNestedValue(entityData, conditions.field);
        const result = this.evaluateOperator(conditions.operator, fieldValue, conditions.value, entityData, channelId);
        
        details[conditions.field] = {
          expected: conditions.value,
          actual: fieldValue,
          operator: conditions.operator,
          result
        };

        return { result, details };
      }

      if (conditions.required_fields && conditions.operator === 'all_present') {
        // Check if all required fields are present
        let allPresent = true;
        for (const field of conditions.required_fields) {
          const value = this.getNestedValue(entityData, field);
          const isPresent = value !== undefined && value !== null && value !== '';
          details[field] = { present: isPresent, value };
          if (!isPresent) allPresent = false;
        }

        return { result: allPresent, details };
      }

      // Complex conditions (AND/OR logic)
      if (conditions.and || conditions.or) {
        return await this.evaluateComplexConditions(conditions, entityData, channelId);
      }

      return { result: false, details: { error: 'Unknown condition format' } };

    } catch (error) {
      return { result: false, details: { error: error.message } };
    }
  }

  async evaluateOperator(operator, fieldValue, expectedValue, entityData, channelId) {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      
      case 'not_equals':
        return fieldValue !== expectedValue;
      
      case 'greater_than':
        return parseFloat(fieldValue) > parseFloat(expectedValue);
      
      case 'less_than':
        return parseFloat(fieldValue) < parseFloat(expectedValue);
      
      case 'greater_than_or_equal':
        return parseFloat(fieldValue) >= parseFloat(expectedValue);
      
      case 'less_than_or_equal':
        return parseFloat(fieldValue) <= parseFloat(expectedValue);
      
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(expectedValue).toLowerCase());
      
      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(expectedValue).toLowerCase());
      
      case 'in_array':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      
      case 'duplicate_check':
        return await this.checkForDuplicates(fieldValue, entityData, channelId);
      
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  async executeActions(actions, entityData, ruleId) {
    const actionResults = {};

    try {
      if (actions.flag_for_review) {
        actionResults.flagged = await this.flagForReview(entityData, ruleId);
      }

      if (actions.generate_alert) {
        actionResults.alert = await this.generateAlert(entityData, ruleId, actions);
      }

      if (actions.reject_duplicate || actions.reject_incomplete) {
        actionResults.rejected = true;
        actionResults.reason = actions.reject_duplicate ? 'Duplicate detected' : 'Incomplete data';
      }

      if (actions.notify_manager || actions.notify_inventory_team || actions.notify_pricing_team) {
        actionResults.notification = await this.sendNotification(entityData, ruleId, actions);
      }

      if (actions.hold_fulfillment || actions.pause_sales) {
        actionResults.hold = await this.holdProcessing(entityData, ruleId, actions);
      }

      if (actions.log_price_change) {
        actionResults.logged = await this.logPriceChange(entityData, ruleId);
      }

      return actionResults;

    } catch (error) {
      return { error: error.message };
    }
  }

  async flagForReview(entityData, ruleId) {
    // Implementation would flag the entity for manual review
    console.log(`🚩 Flagged entity ${entityData.id} for review (Rule: ${ruleId})`);
    return true;
  }

  async generateAlert(entityData, ruleId, actions) {
    const alertQuery = `
      INSERT INTO rule_violation_alerts 
      (rule_id, violation_type, entity_type, entity_id, severity, alert_message, alert_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const alertMessage = `Rule violation detected: ${actions.alert_message || 'Validation rule triggered'}`;
    const severity = actions.severity || 'medium';
    
    const result = await pool.query(alertQuery, [
      ruleId,
      'rule_violation',
      'unknown', // Would be determined from context
      entityData.id,
      severity,
      alertMessage,
      JSON.stringify(entityData)
    ]);

    return result.rows[0].id;
  }

  async sendNotification(entityData, ruleId, actions) {
    // Implementation would send notifications to relevant teams
    console.log(`📧 Notification sent for entity ${entityData.id} (Rule: ${ruleId})`);
    return true;
  }

  async holdProcessing(entityData, ruleId, actions) {
    // Implementation would hold processing of the entity
    console.log(`⏸️ Processing held for entity ${entityData.id} (Rule: ${ruleId})`);
    return true;
  }

  async logPriceChange(entityData, ruleId) {
    // Implementation would log price changes
    console.log(`💰 Price change logged for entity ${entityData.id} (Rule: ${ruleId})`);
    return true;
  }

  async checkForDuplicates(value, entityData, channelId) {
    // Implementation would check for duplicates in the database
    // This is a simplified version
    return false;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  async getApplicableRules(entityType) {
    const query = `
      SELECT * FROM custom_validation_rules 
      WHERE $1 = ANY(entity_types) AND is_active = true
      ORDER BY priority ASC
    `;
    
    const result = await pool.query(query, [entityType]);
    return result.rows.map(row => ({
      ...row,
      conditions: row.conditions,
      actions: row.actions
    }));
  }

  async logRuleExecution(ruleId, entityId, entityType, status, executionTime, conditionsMet, actionsTaken, errorDetails = null) {
    const query = `
      INSERT INTO rule_execution_history 
      (rule_id, entity_id, entity_type, execution_status, execution_time_ms, conditions_met, actions_taken, error_details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await pool.query(query, [
      ruleId, entityId, entityType, status, executionTime,
      JSON.stringify(conditionsMet), JSON.stringify(actionsTaken), errorDetails
    ]);
  }

  updateExecutionStats(success, executionTime) {
    this.ruleExecutionStats.totalExecutions++;
    if (success) {
      this.ruleExecutionStats.successfulExecutions++;
    } else {
      this.ruleExecutionStats.failedExecutions++;
    }

    // Update average execution time
    this.ruleExecutionStats.averageExecutionTime = 
      (this.ruleExecutionStats.averageExecutionTime * (this.ruleExecutionStats.totalExecutions - 1) + executionTime) / 
      this.ruleExecutionStats.totalExecutions;
  }

  async getExecutionStats() {
    return {
      success: true,
      stats: this.ruleExecutionStats,
      timestamp: new Date().toISOString()
    };
  }

  async getRuleViolationAlerts(status = 'active', limit = 50) {
    const query = `
      SELECT 
        a.*,
        r.rule_name,
        r.rule_description
      FROM rule_violation_alerts a
      JOIN custom_validation_rules r ON a.rule_id = r.id
      WHERE a.status = $1
      ORDER BY a.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [status, limit]);
    return {
      success: true,
      alerts: result.rows
    };
  }
}

module.exports = ValidationRuleEngine;
