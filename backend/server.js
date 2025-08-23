const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Simple database connection
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Basic middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// =====================================================
// SHOPIFY API CLIENT (EXISTING)
// =====================================================

class ShopifyAPIClient {
  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';
    this.baseURL = `https://${this.shopDomain}/admin/api/${this.apiVersion}`;
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      if (!this.shopDomain || !this.accessToken) {
        throw new Error('Shopify configuration missing');
      }

      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.data = data;
      }

      const response = await axios(config);
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Shopify API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status || 500
      };
    }
  }

  async getProducts(limit = 50) {
    const endpoint = `/products.json?limit=${limit}`;
    return await this.makeRequest(endpoint);
  }

  async getProduct(productId) {
    const endpoint = `/products/${productId}.json`;
    return await this.makeRequest(endpoint);
  }

  async createProduct(productData) {
    const endpoint = '/products.json';
    const data = { product: productData };
    return await this.makeRequest(endpoint, 'POST', data);
  }

  async getOrders(status = 'any', limit = 50, createdAtMin = null) {
    let endpoint = `/orders.json?status=${status}&limit=${limit}`;
    if (createdAtMin) {
      endpoint += `&created_at_min=${createdAtMin}`;
    }
    return await this.makeRequest(endpoint);
  }

  async getShopInfo() {
    const endpoint = '/shop.json';
    return await this.makeRequest(endpoint);
  }

  async getLocations() {
    const endpoint = '/locations.json';
    return await this.makeRequest(endpoint);
  }
}

// =====================================================
// BEST BUY CANADA MARKETPLACE API CLIENT (NEW)
// =====================================================

class BestBuyCanadaMarketplaceClient {
  constructor() {
    this.baseURL = 'https://marketplace.bestbuy.ca';
    this.apiKey = process.env.BESTBUY_CANADA_API_KEY;
    this.shopId = process.env.BESTBUY_CANADA_SHOP_ID;
    this.apiVersion = 'v1'; // Mirakl API version
  }

  // Make authenticated request to Best Buy Canada Marketplace API
  async makeRequest(endpoint, method = 'GET', data = null, customHeaders = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Best Buy Canada API key is missing');
      }

      // Build full URL - endpoint should start with /api
      const url = `${this.baseURL}${endpoint}`;
      
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'EcommercePortal/1.0',
        ...customHeaders
      };

      const config = {
        method,
        url,
        headers,
        timeout: 30000
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }

      console.log(`Best Buy Canada API Request: ${method} ${url}`);

      const response = await axios(config);
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Best Buy Canada API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status || 500
      };
    }
  }

  // Test API connection by getting shop info
  async testConnection() {
    const endpoint = `/api/shops/${this.shopId}`;
    return await this.makeRequest(endpoint);
  }

  // Alternative test - get account info if shop endpoint doesn't work
  async getAccountInfo() {
    const endpoint = '/api/account';
    return await this.makeRequest(endpoint);
  }

  // Get your products/offers on Best Buy Canada marketplace
  async getMyOffers(params = {}) {
    const { limit = 50, offset = 0, state = null } = params;
    let endpoint = `/api/shops/${this.shopId}/offers?limit=${limit}&offset=${offset}`;
    
    if (state) {
      endpoint += `&state=${state}`;
    }
    
    return await this.makeRequest(endpoint);
  }

  // Get specific offer by ID
  async getOffer(offerId) {
    const endpoint = `/api/shops/${this.shopId}/offers/${offerId}`;
    return await this.makeRequest(endpoint);
  }

  // Create a new offer/product on Best Buy Canada
  async createOffer(offerData) {
    const endpoint = `/api/shops/${this.shopId}/offers`;
    return await this.makeRequest(endpoint, 'POST', offerData);
  }

  // Update existing offer
  async updateOffer(offerId, offerData) {
    const endpoint = `/api/shops/${this.shopId}/offers/${offerId}`;
    return await this.makeRequest(endpoint, 'PUT', offerData);
  }

  // Delete/deactivate offer
  async deleteOffer(offerId) {
    const endpoint = `/api/shops/${this.shopId}/offers/${offerId}`;
    return await this.makeRequest(endpoint, 'DELETE');
  }

  // Get orders from Best Buy Canada marketplace
  async getOrders(params = {}) {
    const { limit = 50, offset = 0, order_state = null, start_date = null, end_date = null } = params;
    let endpoint = `/api/shops/${this.shopId}/orders?limit=${limit}&offset=${offset}`;
    
    if (order_state) {
      endpoint += `&order_state=${order_state}`;
    }
    if (start_date) {
      endpoint += `&start_date=${start_date}`;
    }
    if (end_date) {
      endpoint += `&end_date=${end_date}`;
    }
    
    return await this.makeRequest(endpoint);
  }

  // Get specific order details
  async getOrder(orderId) {
    const endpoint = `/api/shops/${this.shopId}/orders/${orderId}`;
    return await this.makeRequest(endpoint);
  }

  // Accept an order
  async acceptOrder(orderId) {
    const endpoint = `/api/shops/${this.shopId}/orders/${orderId}/accept`;
    return await this.makeRequest(endpoint, 'POST');
  }

  // Get inventory/stock levels for all offers
  async getInventory(params = {}) {
    const { limit = 100, offset = 0 } = params;
    const endpoint = `/api/shops/${this.shopId}/offers?with_stock=true&limit=${limit}&offset=${offset}`;
    return await this.makeRequest(endpoint);
  }

  // Update inventory for a specific offer
  async updateInventory(offerId, stockData) {
    const endpoint = `/api/shops/${this.shopId}/offers/${offerId}/stocks`;
    return await this.makeRequest(endpoint, 'PUT', stockData);
  }

  // Get shop information
  async getShopInfo() {
    const endpoint = `/api/shops/${this.shopId}`;
    return await this.makeRequest(endpoint);
  }

  // Get shipping options
  async getShippingOptions() {
    const endpoint = `/api/shops/${this.shopId}/shipping-options`;
    return await this.makeRequest(endpoint);
  }

  // Get sales reports
  async getSalesReport(params = {}) {
    const { start_date, end_date } = params;
    let endpoint = `/api/shops/${this.shopId}/accounting-documents`;
    
    if (start_date || end_date) {
      const queryParams = new URLSearchParams();
      if (start_date) queryParams.append('start_date', start_date);
      if (end_date) queryParams.append('end_date', end_date);
      endpoint += `?${queryParams.toString()}`;
    }
    
    return await this.makeRequest(endpoint);
  }
}

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'simple-jwt-secret-change-this-later');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
}

// =====================================================
// BASIC SYSTEM ENDPOINTS
// =====================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'E-commerce Portal API is running',
    timestamp: new Date().toISOString(),
    integrations: {
      shopify: !!process.env.SHOPIFY_ACCESS_TOKEN,
      bestbuy_canada: !!process.env.BESTBUY_CANADA_API_KEY,
      amazon: false // Future implementation
    }
  });
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'Database connected',
      time: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// =====================================================
// AUTHENTICATION ENDPOINTS (EXISTING)
// =====================================================

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }
    
    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role',
      [email, hashedPassword, firstName, lastName, 'user']
    );
    
    const user = result.rows[0];
    
    // Create token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'simple-secret-change-in-production',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      token
    });
    
  } catch (error) {
    console.error('Get Best Buy Canada orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Get specific order details
app.get('/api/bestbuy/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const result = await bestBuyCanadaClient.getOrder(orderId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        source: 'bestbuy-canada-marketplace'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Order not found',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get Best Buy Canada order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
});

// Accept an order
app.post('/api/bestbuy/orders/:orderId/accept', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const result = await bestBuyCanadaClient.acceptOrder(orderId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Order accepted successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to accept order',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Accept Best Buy Canada order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept order',
      error: error.message
    });
  }
});

// Get inventory from Best Buy Canada marketplace
app.get('/api/bestbuy/inventory', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await bestBuyCanadaClient.getInventory({
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data.offers || result.data,
        source: 'bestbuy-canada-marketplace',
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to fetch inventory from Best Buy Canada',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get Best Buy Canada inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory',
      error: error.message
    });
  }
});

// Update inventory for a specific offer
app.put('/api/bestbuy/inventory/:offerId', authenticateToken, async (req, res) => {
  try {
    const { offerId } = req.params;
    const { quantity, ...stockData } = req.body;
    
    if (quantity === undefined && quantity !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity is required'
      });
    }
    
    const updateData = {
      quantity,
      ...stockData
    };
    
    const result = await bestBuyCanadaClient.updateInventory(offerId, updateData);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Inventory updated successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to update inventory',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Update Best Buy Canada inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory',
      error: error.message
    });
  }
});

// Get sales reports
app.get('/api/bestbuy/reports/sales', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const result = await bestBuyCanadaClient.getSalesReport({
      start_date,
      end_date
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        source: 'bestbuy-canada-marketplace'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to fetch sales report',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get Best Buy Canada sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales report',
      error: error.message
    });
  }
});

// Sync offers from Best Buy Canada to local database
app.post('/api/bestbuy/sync/offers', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, syncAll = false } = req.body;
    
    console.log('Starting Best Buy Canada offers sync...');
    
    // Get offers from Best Buy Canada
    const bestBuyResult = await bestBuyCanadaClient.getMyOffers({ 
      limit: syncAll ? 1000 : limit 
    });
    
    if (!bestBuyResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch offers from Best Buy Canada',
        error: bestBuyResult.error
      });
    }

    const offers = bestBuyResult.data.offers || bestBuyResult.data || [];
    let syncedCount = 0;
    let errors = [];

    // Get Best Buy Canada channel ID
    const channelResult = await pool.query(
      "SELECT id FROM channels WHERE channel_type = 'bestbuy_canada' OR name ILIKE '%best buy%canada%' LIMIT 1"
    );
    
    let bestBuyChannelId;
    
    if (channelResult.rows.length === 0) {
      // Create Best Buy Canada channel
      const createChannelResult = await pool.query(
        `INSERT INTO channels (name, channel_type, api_config, is_active, sync_status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          'Best Buy Canada Marketplace',
          'bestbuy_canada',
          JSON.stringify({
            api_key: process.env.BESTBUY_CANADA_API_KEY,
            shop_id: process.env.BESTBUY_CANADA_SHOP_ID,
            base_url: 'https://marketplace.bestbuy.ca',
            platform: 'Mirakl'
          }),
          true,
          'syncing'
        ]
      );
      bestBuyChannelId = createChannelResult.rows[0].id;
    } else {
      bestBuyChannelId = channelResult.rows[0].id;
    }

    // Process each Best Buy Canada offer
    for (const offer of offers) {
      try {
        // Extract offer data (adjust based on actual Best Buy Canada API response)
        const offerSku = offer.product_id || offer.sku || offer.id;
        const offerName = offer.product_title || offer.title || offer.name || `Product ${offerSku}`;
        const offerPrice = offer.price || offer.total_price || 0;
        const offerDescription = offer.description || offer.product_description || '';
        
        // Check if product already exists
        const existingProduct = await pool.query(
          'SELECT id FROM products WHERE sku = $1',
          [offerSku]
        );

        let productId;

        if (existingProduct.rows.length === 0) {
          // Create new product
          const productResult = await pool.query(
            `INSERT INTO products 
             (sku, name, description, brand, category, base_price, cost_price) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id`,
            [
              offerSku,
              offerName,
              offerDescription,
              offer.brand || 'Unknown',
              offer.category_code || offer.category || 'General',
              offerPrice,
              offer.min_price || offerPrice
            ]
          );
          productId = productResult.rows[0].id;
        } else {
          productId = existingProduct.rows[0].id;
          
          // Update existing product price if different
          await pool.query(
            'UPDATE products SET base_price = $1, updated_at = NOW() WHERE id = $2',
            [offerPrice, productId]
          );
        }

        // Create or update channel product mapping
        await pool.query(
          `INSERT INTO channel_products 
           (product_id, channel_id, channel_sku, channel_product_id, channel_name, channel_price, sync_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (product_id, channel_id) 
           DO UPDATE SET 
             channel_sku = $3,
             channel_product_id = $4,
             channel_name = $5,
             channel_price = $6,
             sync_status = $7,
             last_synced = NOW()`,
          [
            productId,
            bestBuyChannelId,
            offerSku,
            offer.id || offerSku,
            offerName,
            offerPrice,
            'completed'
          ]
        );

        // Update/create inventory record
        if (offer.quantity !== undefined) {
          await pool.query(
            `INSERT INTO inventory (product_id, channel_id, quantity, available_quantity, last_updated)
             VALUES ($1, $2, $3, $3, NOW())
             ON CONFLICT (product_id, channel_id)
             DO UPDATE SET 
               quantity = $3,
               available_quantity = $3,
               last_updated = NOW()`,
            [productId, bestBuyChannelId, offer.quantity || 0]
          );
        }

        syncedCount++;
      } catch (error) {
        console.error(`Error syncing Best Buy Canada offer ${offer.id || 'unknown'}:`, error);
        errors.push({
          offerId: offer.id || 'unknown',
          error: error.message
        });
      }
    }

    // Update channel sync status
    await pool.query(
      `UPDATE channels SET 
       sync_status = 'completed', 
       last_sync = NOW() 
       WHERE id = $1`,
      [bestBuyChannelId]
    );

    res.json({
      success: true,
      message: `Synced ${syncedCount} offers from Best Buy Canada`,
      data: {
        syncedCount,
        totalOffers: offers.length,
        channelId: bestBuyChannelId,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error) {
    console.error('Best Buy Canada offers sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync offers from Best Buy Canada',
      error: error.message
    });
  }
});

// =====================================================
// SHOPIFY API ENDPOINTS (EXISTING - KEEPING FOR COMPATIBILITY)
// =====================================================

// Initialize Shopify client
const shopifyClient = new ShopifyAPIClient();

// Test Shopify connection
app.get('/api/shopify/test', authenticateToken, async (req, res) => {
  try {
    if (!process.env.SHOPIFY_SHOP_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) {
      return res.status(400).json({
        success: false,
        message: 'Shopify configuration missing',
        required: {
          SHOPIFY_SHOP_DOMAIN: 'your-shop.myshopify.com',
          SHOPIFY_ACCESS_TOKEN: 'your-access-token',
          SHOPIFY_API_VERSION: '2024-01 (optional)'
        }
      });
    }

    const result = await shopifyClient.getShopInfo();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Shopify connection successful',
        shop: result.data.shop,
        apiVersion: shopifyClient.apiVersion
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to connect to Shopify',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Shopify test error:', error);
    res.status(500).json({
      success: false,
      message: 'Shopify test failed',
      error: error.message
    });
  }
});

// Get Shopify products
app.get('/api/shopify/products', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const result = await shopifyClient.getProducts(limit);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data.products,
        source: 'shopify',
        apiVersion: shopifyClient.apiVersion,
        count: result.data.products.length
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to fetch Shopify products',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get Shopify products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Shopify products',
      error: error.message
    });
  }
});

// =====================================================
// INVENTORY MODULE (EXISTING)
// =====================================================

// Get inventory for all products
app.get('/api/inventory', async (req, res) => {
  try {
    const { channel, lowStock = false } = req.query;
    
    let query = `
      SELECT 
        i.*,
        p.name as product_name,
        p.sku,
        c.name as channel_name
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN channels c ON i.channel_id = c.id
      WHERE p.is_active = true
    `;
    
    let queryParams = [];
    let paramCount = 0;
    
    if (channel) {
      paramCount++;
      query += ` AND c.name = ${paramCount}`;
      queryParams.push(channel);
    }
    
    if (lowStock === 'true') {
      query += ` AND i.available_quantity <= i.reorder_point`;
    }
    
    query += ` ORDER BY i.last_updated DESC`;
    
    const result = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory'
    });
  }
});

// =====================================================
// CHANNELS MODULE (EXISTING)
// =====================================================

// Get all channels
app.get('/api/channels', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, channel_type, is_active, sync_status, last_sync FROM channels ORDER BY name'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch channels'
    });
  }
});

// =====================================================
// SALES MODULE (EXISTING)
// =====================================================

// Get sales orders
app.get('/api/sales/orders', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      channel, 
      status, 
      startDate, 
      endDate 
    } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        so.*,
        c.name as channel_name,
        COUNT(oi.id) as item_count
      FROM sales_orders so
      JOIN channels c ON so.channel_id = c.id
      LEFT JOIN order_items oi ON so.id = oi.order_id
      WHERE 1=1
    `;
    
    let queryParams = [];
    let paramCount = 0;
    
    if (channel) {
      paramCount++;
      query += ` AND c.name = ${paramCount}`;
      queryParams.push(channel);
    }
    
    if (status) {
      paramCount++;
      query += ` AND so.status = ${paramCount}`;
      queryParams.push(status);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND so.order_date >= ${paramCount}`;
      queryParams.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND so.order_date <= ${paramCount}`;
      queryParams.push(endDate);
    }
    
    query += ` GROUP BY so.id, c.name ORDER BY so.order_date DESC LIMIT ${paramCount + 1} OFFSET ${paramCount + 2}`;
    queryParams.push(limit, offset);
    
    const result = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Get sales orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales orders'
    });
  }
});

// Sales analytics endpoint
app.get('/api/sales/analytics', async (req, res) => {
  try {
    const { startDate, endDate, channel } = req.query;
    
    let dateFilter = '';
    let queryParams = [];
    let paramCount = 0;
    
    if (startDate) {
      paramCount++;
      dateFilter += ` AND so.order_date >= ${paramCount}`;
      queryParams.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      dateFilter += ` AND so.order_date <= ${paramCount}`;
      queryParams.push(endDate);
    }
    
    if (channel) {
      paramCount++;
      dateFilter += ` AND c.name = ${paramCount}`;
      queryParams.push(channel);
    }
    
    // Total sales
    const totalSalesResult = await pool.query(
      `SELECT 
         COUNT(so.id) as order_count,
         COALESCE(SUM(so.total_amount), 0) as total_revenue,
         COALESCE(AVG(so.total_amount), 0) as avg_order_value
       FROM sales_orders so
       JOIN channels c ON so.channel_id = c.id
       WHERE so.status != 'cancelled' ${dateFilter}`,
      queryParams
    );
    
    // Sales by channel
    const channelSalesResult = await pool.query(
      `SELECT 
         c.name as channel_name,
         COUNT(so.id) as order_count,
         COALESCE(SUM(so.total_amount), 0) as total_revenue
       FROM sales_orders so
       JOIN channels c ON so.channel_id = c.id
       WHERE so.status != 'cancelled' ${dateFilter}
       GROUP BY c.name
       ORDER BY total_revenue DESC`,
      queryParams
    );
    
    res.json({
      success: true,
      data: {
        summary: totalSalesResult.rows[0],
        byChannel: channelSalesResult.rows
      }
    });
    
  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales analytics'
    });
  }
});

// =====================================================
// CATCH ALL ROUTES
// =====================================================

// Catch all other routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// =====================================================
// START SERVER
// =====================================================

// Start server
app.listen(PORT, () => {
  console.log(`🚀 E-commerce Portal API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Database test: http://localhost:${PORT}/api/db-test`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
  console.log(`📦 Products: http://localhost:${PORT}/api/products`);
  console.log(`📊 Inventory: http://localhost:${PORT}/api/inventory`);
  console.log(`💰 Sales: http://localhost:${PORT}/api/sales/*`);
  console.log(`🔗 Channels: http://localhost:${PORT}/api/channels`);
  console.log(`🛍️ Shopify: http://localhost:${PORT}/api/shopify/*`);
  console.log(`🍁 Best Buy Canada: http://localhost:${PORT}/api/bestbuy/* (CANADA MARKETPLACE)`);
});error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password required' 
      });
    }
    
    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    const user = result.rows[0];
    
    if (!user.is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    // Create token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'simple-secret-change-in-production',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed',
      error: error.message
    });
  }
});

// Get user profile
app.get('/api/auth/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'simple-secret-change-in-production');
    
    // Get user data
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = result.rows[0];
    
    if (!user.is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at
      }
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token',
      error: error.message
    });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// =====================================================
// PRODUCTS MODULE (EXISTING)
// =====================================================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { page = 1, limit = 50, category, brand, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM products WHERE is_active = true';
    let queryParams = [];
    let paramCount = 0;
    
    // Add filters
    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      queryParams.push(category);
    }
    
    if (brand) {
      paramCount++;
      query += ` AND brand = $${paramCount}`;
      queryParams.push(brand);
    }
    
    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);
    
    const result = await pool.query(query, queryParams);
    
    // Get total count for pagination
    const countQuery = 'SELECT COUNT(*) FROM products WHERE is_active = true';
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = true',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product'
    });
  }
});

// Create new product (protected)
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const {
      sku,
      name,
      description,
      brand,
      category,
      basePrice,
      costPrice,
      weight,
      dimensions
    } = req.body;
    
    // Validate required fields
    if (!sku || !name || !basePrice) {
      return res.status(400).json({
        success: false,
        message: 'SKU, name, and base price are required'
      });
    }
    
    // Check if SKU already exists
    const existingProduct = await pool.query(
      'SELECT id FROM products WHERE sku = $1',
      [sku]
    );
    
    if (existingProduct.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO products 
       (sku, name, description, brand, category, base_price, cost_price, weight, dimensions) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [sku, name, description, brand, category, basePrice, costPrice, weight, dimensions]
    );
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product'
    });
  }
});

// =====================================================
// BEST BUY CANADA MARKETPLACE API ENDPOINTS (NEW)
// =====================================================

// Initialize Best Buy Canada client
const bestBuyCanadaClient = new BestBuyCanadaMarketplaceClient();

// Test Best Buy Canada connection
app.get('/api/bestbuy/test', authenticateToken, async (req, res) => {
  try {
    if (!process.env.BESTBUY_CANADA_API_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Best Buy Canada marketplace configuration missing',
        required: {
          BESTBUY_CANADA_API_KEY: 'your-canada-marketplace-api-key',
          BESTBUY_CANADA_SHOP_ID: 'your-shop-id (optional for some endpoints)'
        },
        help: 'Check your Best Buy Canada seller dashboard for API credentials'
      });
    }

    // Try to get account info first (doesn't need shop ID)
    let result = await bestBuyCanadaClient.getAccountInfo();
    
    if (!result.success && process.env.BESTBUY_CANADA_SHOP_ID) {
      // Fall back to shop info if account endpoint doesn't work
      result = await bestBuyCanadaClient.getShopInfo();
    }
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Best Buy Canada marketplace connection successful',
        apiKey: `${process.env.BESTBUY_CANADA_API_KEY.substring(0, 8)}...`,
        data: result.data,
        platform: 'Mirakl Marketplace Platform'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to connect to Best Buy Canada marketplace',
        error: result.error,
        troubleshooting: {
          apiKey: 'Check if your API key is valid and active',
          shopId: 'Verify your shop ID if using shop-specific endpoints',
          permissions: 'Ensure your API key has required permissions'
        }
      });
    }
  } catch (error) {
    console.error('Best Buy Canada test error:', error);
    res.status(500).json({
      success: false,
      message: 'Best Buy Canada API test failed',
      error: error.message
    });
  }
});

// Get your offers/products on Best Buy Canada marketplace
app.get('/api/bestbuy/offers', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, state } = req.query;
    
    if (!process.env.BESTBUY_CANADA_SHOP_ID) {
      return res.status(400).json({
        success: false,
        message: 'BESTBUY_CANADA_SHOP_ID is required for this endpoint'
      });
    }
    
    const result = await bestBuyCanadaClient.getMyOffers({ 
      limit: parseInt(limit), 
      offset: parseInt(offset),
      state 
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data.offers || result.data,
        source: 'bestbuy-canada-marketplace',
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.data.total_count || result.data.length
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to fetch offers from Best Buy Canada',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get Best Buy Canada offers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offers',
      error: error.message
    });
  }
});

// Get specific offer details
app.get('/api/bestbuy/offers/:offerId', authenticateToken, async (req, res) => {
  try {
    const { offerId } = req.params;
    
    const result = await bestBuyCanadaClient.getOffer(offerId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        source: 'bestbuy-canada-marketplace'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Offer not found',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get Best Buy Canada offer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offer',
      error: error.message
    });
  }
});

// Create new offer on Best Buy Canada marketplace
app.post('/api/bestbuy/offers', authenticateToken, async (req, res) => {
  try {
    const offerData = req.body;
    
    // Basic validation for Best Buy Canada offer
    const requiredFields = ['product_id', 'price'];
    const missingFields = requiredFields.filter(field => !offerData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    const result = await bestBuyCanadaClient.createOffer(offerData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Offer created successfully on Best Buy Canada',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to create offer on Best Buy Canada',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Create Best Buy Canada offer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create offer',
      error: error.message
    });
  }
});

// Update existing offer
app.put('/api/bestbuy/offers/:offerId', authenticateToken, async (req, res) => {
  try {
    const { offerId } = req.params;
    const offerData = req.body;
    
    const result = await bestBuyCanadaClient.updateOffer(offerId, offerData);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Offer updated successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to update offer',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Update Best Buy Canada offer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update offer',
      error: error.message
    });
  }
});

// Get orders from Best Buy Canada marketplace
app.get('/api/bestbuy/orders', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, order_state, start_date, end_date } = req.query;
    
    const result = await bestBuyCanadaClient.getOrders({
      limit: parseInt(limit),
      offset: parseInt(offset),
      order_state,
      start_date,
      end_date
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data.orders || result.data,
        source: 'bestbuy-canada-marketplace',
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.data.total_count || result.data.length
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to fetch orders from Best Buy Canada',
        error: result.error
      });
    }
  } catch (error) {
    console.
