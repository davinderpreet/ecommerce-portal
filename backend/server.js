const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
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
    timestamp: new Date().toISOString()
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
// AUTHENTICATION ENDPOINTS
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
    console.error('Registration error:', error);
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
// INVENTORY MODULE
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
      query += ` AND c.name = $${paramCount}`;
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

// Update inventory quantity
app.put('/api/inventory/:productId/:channelId', authenticateToken, async (req, res) => {
  try {
    const { productId, channelId } = req.params;
    const { quantity, notes = 'Manual adjustment' } = req.body;
    
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    // Get current inventory
    const currentResult = await pool.query(
      'SELECT * FROM inventory WHERE product_id = $1 AND channel_id = $2',
      [productId, channelId]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventory record not found'
      });
    }
    
    const currentInventory = currentResult.rows[0];
    const previousQuantity = currentInventory.quantity;
    
    // Update inventory
    const updateResult = await pool.query(
      'UPDATE inventory SET quantity = $1, last_updated = NOW() WHERE product_id = $2 AND channel_id = $3 RETURNING *',
      [quantity, productId, channelId]
    );
    
    // Log inventory movement
    await pool.query(
      `INSERT INTO inventory_movements 
       (product_id, channel_id, movement_type, quantity_change, previous_quantity, new_quantity, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [productId, channelId, 'adjustment', quantity - previousQuantity, previousQuantity, quantity, notes]
    );
    
    res.json({
      success: true,
      message: 'Inventory updated successfully',
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory'
    });
  }
});

// Get inventory movements (history)
app.get('/api/inventory/movements/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 50 } = req.query;
    
    const result = await pool.query(
      `SELECT 
         im.*,
         c.name as channel_name,
         p.name as product_name,
         p.sku
       FROM inventory_movements im
       JOIN channels c ON im.channel_id = c.id
       JOIN products p ON im.product_id = p.id
       WHERE im.product_id = $1
       ORDER BY im.created_at DESC
       LIMIT $2`,
      [productId, limit]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Get inventory movements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory movements'
    });
  }
});

// =====================================================
// SALES MODULE - ISOLATED SALES DATA PROCESSING
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
      query += ` AND c.name = $${paramCount}`;
      queryParams.push(channel);
    }
    
    if (status) {
      paramCount++;
      query += ` AND so.status = $${paramCount}`;
      queryParams.push(status);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND so.order_date >= $${paramCount}`;
      queryParams.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND so.order_date <= $${paramCount}`;
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

// Get single order with items
app.get('/api/sales/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get order details
    const orderResult = await pool.query(
      `SELECT 
         so.*,
         c.name as channel_name
       FROM sales_orders so
       JOIN channels c ON so.channel_id = c.id
       WHERE so.id = $1`,
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Get order items
    const itemsResult = await pool.query(
      `SELECT 
         oi.*,
         p.name as product_name
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at`,
      [id]
    );
    
    const order = orderResult.rows[0];
    order.items = itemsResult.rows;
    
    res.json({
      success: true,
      data: order
    });
    
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
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
      dateFilter += ` AND so.order_date >= $${paramCount}`;
      queryParams.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      dateFilter += ` AND so.order_date <= $${paramCount}`;
      queryParams.push(endDate);
    }
    
    if (channel) {
      paramCount++;
      dateFilter += ` AND c.name = $${paramCount}`;
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
// CHANNELS MODULE
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

// Update channel status
app.put('/api/channels/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, syncStatus } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    if (isActive !== undefined) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      values.push(isActive);
    }
    
    if (syncStatus) {
      paramCount++;
      updates.push(`sync_status = $${paramCount}`);
      values.push(syncStatus);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }
    
    paramCount++;
    values.push(id);
    
    const result = await pool.query(
      `UPDATE channels SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Channel updated successfully',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update channel'
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
});
