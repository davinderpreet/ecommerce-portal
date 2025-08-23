// =====================================================
// FIXED SERVER.JS - ALL SYNTAX ERRORS CORRECTED
// =====================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
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

// Authentication middleware
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
// BASIC ENDPOINTS
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
      amazon: false
    }
  });
});

// Database test
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
// AUTHENTICATION ENDPOINTS - FIXED
// =====================================================

// Register user - FIXED ERROR MESSAGES
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required' 
      });
    }
    
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role',
      [email, hashedPassword, firstName, lastName, 'user']
    );
    
    const user = result.rows[0];
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
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
    console.error('Registration error:', error); // ✅ FIXED - correct error message
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed', // ✅ FIXED - correct error message
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
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'simple-secret-change-in-production');
    
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
// PRODUCTS MODULE
// =====================================================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { page = 1, limit = 50, category, brand, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM products WHERE is_active = true';
    let queryParams = [];
    let paramCount = 0;
    
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
    const { sku, name, description, brand, category, basePrice, costPrice, weight, dimensions } = req.body;
    
    if (!sku || !name || !basePrice) {
      return res.status(400).json({
        success: false,
        message: 'SKU, name, and base price are required'
      });
    }
    
    const existingProduct = await pool.query('SELECT id FROM products WHERE sku = $1', [sku]);
    
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
// BEST BUY CANADA TEST ENDPOINT
// =====================================================

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

    // Simple test - try to make a request to account endpoint (Mirakl API)
    try {
      const testUrl = 'https://marketplace.bestbuy.ca/api/account';
      const response = await axios.get(testUrl, {
        headers: {
          'Authorization': process.env.BESTBUY_CANADA_API_KEY,
          'Accept': 'application/json',
          'User-Agent': 'EcommercePortal/1.0'
        },
        timeout: 15000
      });

      res.json({
        success: true,
        message: 'Best Buy Canada marketplace connection successful',
        apiKey: `${process.env.BESTBUY_CANADA_API_KEY.substring(0, 8)}...`,
        platform: 'Mirakl Marketplace Platform',
        data: response.data
      });

    } catch (apiError) {
      console.error('Best Buy Canada API Error:', apiError.response?.data || apiError.message);
      
      res.status(400).json({
        success: false,
        message: 'Failed to connect to Best Buy Canada marketplace',
        error: apiError.response?.data || apiError.message,
        apiKey: `${process.env.BESTBUY_CANADA_API_KEY.substring(0, 8)}...`,
        troubleshooting: {
          apiKey: 'Check if your API key is valid and active',
          permissions: 'Ensure your API key has required permissions',
          account: 'Verify your seller account is approved'
        }
      });
    }

  } catch (error) {
    console.error('Best Buy test error:', error);
    res.status(500).json({
      success: false,
      message: 'Best Buy API test failed',
      error: error.message
    });
  }
});

// =====================================================
// DATA SYNC SERVICES - MILESTONE 8
// =====================================================

const SyncService = require('./services/syncService');
const DataMapper = require('./services/dataMapper');
const WebhookHandler = require('./services/webhookHandler');

// Initialize sync service
const syncService = new SyncService();
const dataMapper = new DataMapper();
const webhookHandler = new WebhookHandler(syncService, dataMapper);

// Initialize sync service on startup (with error handling)
syncService.initialize().then(() => {
  console.log('✅ Sync Service initialized');
  // Start automatic sync scheduler (every 15 minutes)
  syncService.startScheduler(15);
}).catch(error => {
  console.error('❌ Failed to initialize Sync Service:', error.message);
  console.log('⚠️ Sync Service will retry initialization on first API call');
});

// Manual sync trigger endpoint
app.post('/api/sync/trigger', authenticateToken, async (req, res) => {
  try {
    const { channelId, syncType, priority = 5 } = req.body;

    if (!channelId || !syncType) {
      return res.status(400).json({
        success: false,
        message: 'channelId and syncType are required'
      });
    }

    const jobId = await syncService.addSyncJob(channelId, syncType, {}, priority);

    res.json({
      success: true,
      message: 'Sync job queued successfully',
      jobId: jobId
    });

  } catch (error) {
    console.error('Sync trigger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger sync',
      error: error.message
    });
  }
});

// Get sync status and statistics
app.get('/api/sync/status', authenticateToken, async (req, res) => {
  try {
    const stats = syncService.getSyncStats();
    const recentLogs = await syncService.getSyncLogs(20);

    res.json({
      success: true,
      stats: stats,
      recentLogs: recentLogs,
      isProcessing: syncService.isProcessing
    });

  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: error.message
    });
  }
});

// Bulk sync all channels
app.post('/api/sync/bulk', authenticateToken, async (req, res) => {
  try {
    const { syncTypes = ['products', 'orders', 'inventory'] } = req.body;

    // Get all active channels
    const channelsResult = await pool.query(
      'SELECT id, name FROM channels WHERE is_active = true'
    );

    const channels = channelsResult.rows;
    const queuedJobs = [];

    // Queue sync jobs for all channels and types
    for (const channel of channels) {
      for (const syncType of syncTypes) {
        const jobId = await syncService.addSyncJob(channel.id, syncType, {}, 7); // High priority
        queuedJobs.push({
          jobId,
          channel: channel.name,
          syncType
        });
      }
    }

    res.json({
      success: true,
      message: `Queued ${queuedJobs.length} sync jobs`,
      jobs: queuedJobs
    });

  } catch (error) {
    console.error('Bulk sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to queue bulk sync',
      error: error.message
    });
  }
});

// Data mapping test endpoint
app.post('/api/sync/map-test', authenticateToken, async (req, res) => {
  try {
    const { channelName, dataType, rawData } = req.body;

    if (!channelName || !dataType || !rawData) {
      return res.status(400).json({
        success: false,
        message: 'channelName, dataType, and rawData are required'
      });
    }

    const mappedData = dataMapper.mapData(channelName, dataType, rawData);
    dataMapper.validateMappedData(dataType, mappedData);

    res.json({
      success: true,
      message: 'Data mapping successful',
      originalData: rawData,
      mappedData: mappedData
    });

  } catch (error) {
    console.error('Data mapping test error:', error);
    res.status(400).json({
      success: false,
      message: 'Data mapping failed',
      error: error.message
    });
  }
});

// Sync logs with pagination
app.get('/api/sync/logs', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, channelId, syncType, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT sl.*, c.name as channel_name
      FROM sync_logs sl
      JOIN channels c ON sl.channel_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (channelId) {
      params.push(channelId);
      query += ` AND sl.channel_id = $${++paramCount}`;
    }

    if (syncType) {
      params.push(syncType);
      query += ` AND sl.sync_type = $${++paramCount}`;
    }

    if (status) {
      params.push(status);
      query += ` AND sl.status = $${++paramCount}`;
    }

    query += ` ORDER BY sl.started_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM sync_logs sl
      JOIN channels c ON sl.channel_id = c.id
      WHERE 1=1
    `;
    const countParams = [];
    let countParamCount = 0;

    if (channelId) {
      countParams.push(channelId);
      countQuery += ` AND sl.channel_id = $${++countParamCount}`;
    }

    if (syncType) {
      countParams.push(syncType);
      countQuery += ` AND sl.sync_type = $${++countParamCount}`;
    }

    if (status) {
      countParams.push(status);
      countQuery += ` AND sl.status = $${++countParamCount}`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Sync logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync logs',
      error: error.message
    });
  }
});

// Webhook endpoints
app.use('/api/webhooks', webhookHandler.getRouter());

// Webhook status endpoint
app.get('/api/webhooks/status', authenticateToken, async (req, res) => {
  try {
    const stats = webhookHandler.getWebhookStats();
    
    res.json({
      success: true,
      webhookStats: stats,
      endpoints: {
        shopify: {
          orders_create: '/api/webhooks/shopify/orders/create',
          orders_update: '/api/webhooks/shopify/orders/update',
          products_create: '/api/webhooks/shopify/products/create',
          products_update: '/api/webhooks/shopify/products/update',
          inventory_update: '/api/webhooks/shopify/inventory/update'
        },
        bestbuy: {
          orders_create: '/api/webhooks/bestbuy/orders/create',
          orders_update: '/api/webhooks/bestbuy/orders/update',
          offers_update: '/api/webhooks/bestbuy/offers/update'
        },
        amazon: {
          orders_create: '/api/webhooks/amazon/orders/create',
          inventory_update: '/api/webhooks/amazon/inventory/update'
        },
        test: '/api/webhooks/test'
      }
    });
    
  } catch (error) {
    console.error('Webhook status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get webhook status',
      error: error.message
    });
  }
});

// =====================================================
// CHANNELS MODULE - FIXED SQL PARAMETERS
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
// INVENTORY MODULE - FIXED SQL PARAMETERS
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
      query += ` AND c.name = $${paramCount}`; // ✅ FIXED - added missing $
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
// SALES MODULE - FIXED SQL PARAMETERS
// =====================================================

// Get sales orders
app.get('/api/sales/orders', async (req, res) => {
  try {
    const { page = 1, limit = 50, channel, status, startDate, endDate } = req.query;
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
      query += ` AND c.name = $${paramCount}`; // ✅ FIXED - added missing $
      queryParams.push(channel);
    }
    
    if (status) {
      paramCount++;
      query += ` AND so.status = $${paramCount}`; // ✅ FIXED - added missing $
      queryParams.push(status);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND so.order_date >= $${paramCount}`; // ✅ FIXED - added missing $
      queryParams.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND so.order_date <= $${paramCount}`; // ✅ FIXED - added missing $
      queryParams.push(endDate);
    }
    
    query += ` GROUP BY so.id, c.name ORDER BY so.order_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
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

// Sales analytics endpoint - FIXED SQL PARAMETERS
app.get('/api/sales/analytics', async (req, res) => {
  try {
    const { startDate, endDate, channel } = req.query;
    
    let dateFilter = '';
    let queryParams = [];
    let paramCount = 0;
    
    if (startDate) {
      paramCount++;
      dateFilter += ` AND so.order_date >= $${paramCount}`; // ✅ FIXED - added missing $
      queryParams.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      dateFilter += ` AND so.order_date <= $${paramCount}`; // ✅ FIXED - added missing $
      queryParams.push(endDate);
    }
    
    if (channel) {
      paramCount++;
      dateFilter += ` AND c.name = $${paramCount}`; // ✅ FIXED - added missing $
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

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`🚀 E-commerce Portal API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🍁 Best Buy Canada test: http://localhost:${PORT}/api/bestbuy/test`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Integrations available:`);
  console.log(`  - Shopify: ${!!process.env.SHOPIFY_ACCESS_TOKEN}`);
  console.log(`  - Best Buy Canada: ${!!process.env.BESTBUY_CANADA_API_KEY}`);
});
