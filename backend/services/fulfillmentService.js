const { Pool } = require('pg');

class FulfillmentService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    this.initialized = false;
    this.carriers = {
      'fedex': { name: 'FedEx', trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=' },
      'ups': { name: 'UPS', trackingUrl: 'https://www.ups.com/track?tracknum=' },
      'usps': { name: 'USPS', trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' },
      'dhl': { name: 'DHL', trackingUrl: 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=' },
      'canada_post': { name: 'Canada Post', trackingUrl: 'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=' }
    };
  }

  async initialize() {
    try {
      await this.createTables();
      this.initialized = true;
      console.log('✅ FulfillmentService initialized successfully');
    } catch (error) {
      console.error('❌ FulfillmentService initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      // Shipping methods and rates
      await client.query(`
        CREATE TABLE IF NOT EXISTS shipping_methods (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          carrier VARCHAR(50) NOT NULL,
          service_type VARCHAR(100) NOT NULL,
          base_rate DECIMAL(10,2) NOT NULL,
          per_item_rate DECIMAL(10,2) DEFAULT 0,
          weight_rate DECIMAL(10,2) DEFAULT 0,
          distance_rate DECIMAL(10,2) DEFAULT 0,
          min_delivery_days INTEGER DEFAULT 1,
          max_delivery_days INTEGER DEFAULT 7,
          active BOOLEAN DEFAULT TRUE,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Fulfillment centers/warehouses
      await client.query(`
        CREATE TABLE IF NOT EXISTS fulfillment_centers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(20) UNIQUE NOT NULL,
          address JSONB NOT NULL,
          contact_info JSONB DEFAULT '{}',
          operating_hours JSONB DEFAULT '{}',
          capacity_limits JSONB DEFAULT '{}',
          supported_carriers TEXT[] DEFAULT '{}',
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Inventory allocation tracking
      await client.query(`
        CREATE TABLE IF NOT EXISTS inventory_allocations (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          product_id VARCHAR(255) NOT NULL,
          sku VARCHAR(100) NOT NULL,
          quantity INTEGER NOT NULL,
          fulfillment_center_id INTEGER REFERENCES fulfillment_centers(id),
          allocation_status VARCHAR(50) DEFAULT 'pending',
          allocated_at TIMESTAMP NULL,
          released_at TIMESTAMP NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Shipping labels and tracking
      await client.query(`
        CREATE TABLE IF NOT EXISTS shipping_labels (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          carrier VARCHAR(50) NOT NULL,
          service_type VARCHAR(100) NOT NULL,
          tracking_number VARCHAR(255) UNIQUE NOT NULL,
          label_url TEXT NULL,
          shipping_cost DECIMAL(10,2) NOT NULL,
          weight DECIMAL(8,2) NULL,
          dimensions JSONB NULL,
          from_address JSONB NOT NULL,
          to_address JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          shipped_at TIMESTAMP NULL
        )
      `);

      // Delivery tracking and updates
      await client.query(`
        CREATE TABLE IF NOT EXISTS delivery_tracking (
          id SERIAL PRIMARY KEY,
          tracking_number VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          location VARCHAR(255) NULL,
          timestamp TIMESTAMP NOT NULL,
          description TEXT NULL,
          is_delivered BOOLEAN DEFAULT FALSE,
          delivery_signature VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default shipping methods
      await client.query(`
        INSERT INTO shipping_methods (name, carrier, service_type, base_rate, min_delivery_days, max_delivery_days)
        VALUES 
          ('Standard Shipping', 'canada_post', 'regular', 9.99, 3, 7),
          ('Express Shipping', 'canada_post', 'express', 19.99, 1, 3),
          ('FedEx Ground', 'fedex', 'ground', 12.99, 2, 5),
          ('FedEx Express', 'fedex', 'express', 24.99, 1, 2),
          ('UPS Ground', 'ups', 'ground', 11.99, 2, 5),
          ('UPS Express', 'ups', 'express', 22.99, 1, 2)
        ON CONFLICT DO NOTHING
      `);

      // Insert default fulfillment center
      await client.query(`
        INSERT INTO fulfillment_centers (name, code, address, contact_info, supported_carriers)
        VALUES (
          'Main Warehouse',
          'MAIN_WH',
          '{"street": "123 Warehouse St", "city": "Toronto", "province": "ON", "postal_code": "M1M 1M1", "country": "CA"}',
          '{"phone": "+1-416-555-0123", "email": "warehouse@example.com"}',
          '{"canada_post", "fedex", "ups", "dhl"}'
        )
        ON CONFLICT (code) DO NOTHING
      `);

      console.log('📦 Fulfillment service tables created successfully');
    } finally {
      client.release();
    }
  }

  // Calculate shipping rates
  async calculateShippingRates(orderData, destinationAddress) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM shipping_methods 
        WHERE active = TRUE 
        ORDER BY base_rate ASC
      `);

      const rates = result.rows.map(method => {
        const baseRate = parseFloat(method.base_rate);
        const itemCount = orderData.items?.length || 1;
        const totalWeight = orderData.totalWeight || 1;
        
        // Simple rate calculation (can be enhanced with real carrier APIs)
        let totalRate = baseRate;
        totalRate += parseFloat(method.per_item_rate) * itemCount;
        totalRate += parseFloat(method.weight_rate) * totalWeight;
        
        // Distance-based calculation (simplified)
        if (this.isInternational(destinationAddress)) {
          totalRate += 15.00; // International surcharge
        }

        return {
          id: method.id,
          name: method.name,
          carrier: method.carrier,
          serviceType: method.service_type,
          rate: totalRate.toFixed(2),
          estimatedDays: `${method.min_delivery_days}-${method.max_delivery_days}`,
          deliveryDate: this.calculateDeliveryDate(method.max_delivery_days)
        };
      });

      return {
        success: true,
        rates
      };
    } finally {
      client.release();
    }
  }

  // Allocate inventory for order
  async allocateInventory(orderData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const allocations = [];
      
      for (const item of orderData.items) {
        // Find best fulfillment center (simplified logic)
        const centerResult = await client.query(`
          SELECT id FROM fulfillment_centers 
          WHERE active = TRUE 
          ORDER BY id ASC 
          LIMIT 1
        `);

        if (centerResult.rows.length === 0) {
          throw new Error('No active fulfillment centers available');
        }

        const centerId = centerResult.rows[0].id;

        // Create allocation record
        const allocationResult = await client.query(`
          INSERT INTO inventory_allocations (
            order_id, product_id, sku, quantity, fulfillment_center_id, 
            allocation_status, allocated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          RETURNING *
        `, [
          orderData.orderId,
          item.productId,
          item.sku,
          item.quantity,
          centerId,
          'allocated'
        ]);

        allocations.push(allocationResult.rows[0]);
      }

      await client.query('COMMIT');

      return {
        success: true,
        allocations
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Create shipping label
  async createShippingLabel(orderData, shippingMethod) {
    const client = await this.pool.connect();
    try {
      // Get fulfillment center address
      const centerResult = await client.query(`
        SELECT address FROM fulfillment_centers 
        WHERE active = TRUE 
        ORDER BY id ASC 
        LIMIT 1
      `);

      const fromAddress = centerResult.rows[0]?.address || {
        street: "123 Warehouse St",
        city: "Toronto",
        province: "ON",
        postal_code: "M1M 1M1",
        country: "CA"
      };

      // Generate tracking number (in production, this would come from carrier API)
      const trackingNumber = this.generateTrackingNumber(shippingMethod.carrier);

      const result = await client.query(`
        INSERT INTO shipping_labels (
          order_id, carrier, service_type, tracking_number, 
          shipping_cost, from_address, to_address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        orderData.orderId,
        shippingMethod.carrier,
        shippingMethod.serviceType,
        trackingNumber,
        shippingMethod.rate,
        JSON.stringify(fromAddress),
        JSON.stringify(orderData.shippingAddress)
      ]);

      return {
        success: true,
        label: result.rows[0],
        trackingUrl: this.getTrackingUrl(shippingMethod.carrier, trackingNumber)
      };
    } finally {
      client.release();
    }
  }

  // Update shipping status
  async updateShippingStatus(trackingNumber, status, location = null, description = null) {
    const client = await this.pool.connect();
    try {
      // Update shipping label if shipped
      if (status === 'shipped') {
        await client.query(`
          UPDATE shipping_labels 
          SET shipped_at = CURRENT_TIMESTAMP 
          WHERE tracking_number = $1
        `, [trackingNumber]);
      }

      // Add tracking update
      const result = await client.query(`
        INSERT INTO delivery_tracking (tracking_number, status, location, timestamp, description, is_delivered)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
        RETURNING *
      `, [
        trackingNumber,
        status,
        location,
        description,
        status === 'delivered'
      ]);

      return {
        success: true,
        tracking: result.rows[0]
      };
    } finally {
      client.release();
    }
  }

  // Get fulfillment status for order
  async getFulfillmentStatus(orderId) {
    const client = await this.pool.connect();
    try {
      // Get allocations
      const allocationsResult = await client.query(`
        SELECT ia.*, fc.name as fulfillment_center_name
        FROM inventory_allocations ia
        LEFT JOIN fulfillment_centers fc ON ia.fulfillment_center_id = fc.id
        WHERE ia.order_id = $1
      `, [orderId]);

      // Get shipping info
      const shippingResult = await client.query(`
        SELECT * FROM shipping_labels 
        WHERE order_id = $1
      `, [orderId]);

      // Get tracking info
      let trackingInfo = [];
      if (shippingResult.rows.length > 0) {
        const trackingResult = await client.query(`
          SELECT * FROM delivery_tracking 
          WHERE tracking_number = $1 
          ORDER BY timestamp DESC
        `, [shippingResult.rows[0].tracking_number]);
        trackingInfo = trackingResult.rows;
      }

      return {
        success: true,
        orderId,
        allocations: allocationsResult.rows,
        shipping: shippingResult.rows[0] || null,
        tracking: trackingInfo
      };
    } finally {
      client.release();
    }
  }

  // Get fulfillment analytics
  async getFulfillmentAnalytics(days = 7) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          DATE(sl.created_at) as date,
          sl.carrier,
          COUNT(*) as total_shipments,
          AVG(sl.shipping_cost) as avg_shipping_cost,
          COUNT(CASE WHEN dt.is_delivered = TRUE THEN 1 END) as delivered_count,
          AVG(CASE WHEN dt.is_delivered = TRUE 
              THEN EXTRACT(EPOCH FROM (dt.timestamp - sl.shipped_at))/86400 
              END) as avg_delivery_days
        FROM shipping_labels sl
        LEFT JOIN delivery_tracking dt ON sl.tracking_number = dt.tracking_number AND dt.is_delivered = TRUE
        WHERE sl.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(sl.created_at), sl.carrier
        ORDER BY date DESC, carrier
      `);

      return {
        success: true,
        analytics: result.rows
      };
    } finally {
      client.release();
    }
  }

  // Helper methods
  generateTrackingNumber(carrier) {
    const prefix = carrier.toUpperCase().substring(0, 3);
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  getTrackingUrl(carrier, trackingNumber) {
    const carrierInfo = this.carriers[carrier];
    return carrierInfo ? carrierInfo.trackingUrl + trackingNumber : null;
  }

  isInternational(address) {
    return address.country && address.country.toUpperCase() !== 'CA';
  }

  calculateDeliveryDate(maxDays) {
    const date = new Date();
    date.setDate(date.getDate() + maxDays);
    return date.toISOString().split('T')[0];
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = FulfillmentService;
