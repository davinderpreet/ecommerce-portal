-- E-commerce Management Portal Database Schema
-- Optimized for Neon PostgreSQL

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- CORE SYSTEM TABLES
-- =====================================================

-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Orders
CREATE TABLE sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) UNIQUE NOT NULL,
    external_order_id VARCHAR(255),
    channel_id UUID REFERENCES channels(id),
    customer_email VARCHAR(255) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    order_status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CAD',
    shipping_address JSONB,
    billing_address JSONB,
    items JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channels Configuration
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    channel_type VARCHAR(50) NOT NULL, -- 'amazon', 'shopify', 'bestbuy'
    api_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sync_status VARCHAR(50) DEFAULT 'pending',
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PRODUCT MANAGEMENT
-- =====================================================

-- Master Product Catalog
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    brand VARCHAR(200),
    category VARCHAR(200),
    subcategory VARCHAR(200),
    base_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    weight DECIMAL(8,2),
    dimensions JSONB, -- {length, width, height, unit}
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channel-specific Product Mappings
CREATE TABLE channel_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    channel_sku VARCHAR(200) NOT NULL,
    channel_product_id VARCHAR(200),
    channel_name VARCHAR(500),
    channel_price DECIMAL(10,2),
    channel_status VARCHAR(50) DEFAULT 'active',
    sync_status VARCHAR(50) DEFAULT 'pending',
    last_synced TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, channel_id)
);

-- =====================================================
-- INVENTORY MANAGEMENT
-- =====================================================

-- Inventory Tracking
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    reorder_point INTEGER DEFAULT 10,
    reorder_quantity INTEGER DEFAULT 50,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, channel_id)
);

-- Inventory Movement History
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- 'sale', 'restock', 'adjustment', 'return'
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reference_id VARCHAR(200), -- order_id, adjustment_id, etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Status History
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255),
    change_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SALES & ORDERS
-- =====================================================

-- Sales Orders
CREATE TABLE sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES channels(id) ON DELETE RESTRICT,
    channel_order_id VARCHAR(200) NOT NULL,
    order_number VARCHAR(100),
    customer_email VARCHAR(255),
    customer_name VARCHAR(200),
    customer_phone VARCHAR(50),
    billing_address JSONB,
    shipping_address JSONB,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled',
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    shipping_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id, channel_order_id)
);

-- Order Line Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    channel_product_id VARCHAR(200),
    sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    profit DECIMAL(10,2) GENERATED ALWAYS AS (total_price - (cost_price * quantity)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS & REPORTING
-- =====================================================

-- Daily Sales Summary (Materialized for Performance)
CREATE TABLE daily_sales_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity_sold INTEGER NOT NULL DEFAULT 0,
    gross_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
    net_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    profit DECIMAL(10,2) NOT NULL DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, channel_id, product_id)
);

-- Channel Performance Summary
CREATE TABLE channel_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_profit DECIMAL(10,2) DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    return_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id, date)
);

-- =====================================================
-- AI & INSIGHTS
-- =====================================================

-- AI Generated Insights
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_type VARCHAR(100) NOT NULL, -- 'forecast', 'recommendation', 'alert', 'trend'
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    data JSONB NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'dismissed', 'acted_upon'
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Forecasting Data
CREATE TABLE sales_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    forecasted_quantity INTEGER NOT NULL,
    forecasted_revenue DECIMAL(10,2) NOT NULL,
    confidence_interval JSONB, -- {lower_bound, upper_bound}
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, channel_id, forecast_date)
);

-- =====================================================
-- SYSTEM AUDIT & LOGS
-- =====================================================

-- System Activity Logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data Sync Logs
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'products', 'orders', 'inventory'
    status VARCHAR(20) NOT NULL, -- 'success', 'partial', 'failed'
    records_processed INTEGER DEFAULT 0,
    records_successful INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER) STORED
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Product indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active);

-- Sales indexes
CREATE INDEX idx_sales_orders_channel_date ON sales_orders(channel_id, order_date);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_email);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Inventory indexes
CREATE INDEX idx_inventory_product_channel ON inventory(product_id, channel_id);
CREATE INDEX idx_inventory_low_stock ON inventory(available_quantity) WHERE available_quantity <= reorder_point;

-- Analytics indexes
CREATE INDEX idx_daily_sales_date ON daily_sales_summary(date);
CREATE INDEX idx_daily_sales_channel_date ON daily_sales_summary(channel_id, date);
CREATE INDEX idx_daily_sales_product_date ON daily_sales_summary(product_id, date);

-- Text search indexes
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_products_description_search ON products USING gin(to_tsvector('english', description));

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channel_products_updated_at BEFORE UPDATE ON channel_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inventory update trigger
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_timestamp BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamp();

-- Inventory movement logging
CREATE OR REPLACE FUNCTION log_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity THEN
        INSERT INTO inventory_movements (
            product_id, 
            channel_id, 
            movement_type, 
            quantity_change, 
            previous_quantity, 
            new_quantity,
            notes
        ) VALUES (
            NEW.product_id,
            NEW.channel_id,
            'adjustment',
            NEW.quantity - OLD.quantity,
            OLD.quantity,
            NEW.quantity,
            'Automatic inventory adjustment'
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_inventory_changes AFTER UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION log_inventory_movement();

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Insert default channels
INSERT INTO channels (name, channel_type, api_config) VALUES
('Amazon Seller Central', 'amazon', '{"region": "us-east-1", "marketplace_id": "", "access_key": "", "secret_key": ""}'),
('Shopify Store', 'shopify', '{"shop_domain": "", "access_token": "", "api_version": "2023-07"}'),
('Best Buy Partner', 'bestbuy', '{"api_key": "", "environment": "sandbox"}');

-- Create admin user (password: 'admin123' - change in production)
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
('admin@yourdomain.com', '$2b$10$YourHashedPasswordHere', 'Admin', 'User', 'admin');

-- Sample product categories for initial setup
INSERT INTO products (sku, name, description, brand, category, base_price, cost_price) VALUES
('SKU-001', 'Sample Product 1', 'This is a sample product for testing', 'Sample Brand', 'Electronics', 99.99, 60.00),
('SKU-002', 'Sample Product 2', 'Another sample product', 'Sample Brand', 'Home & Garden', 149.99, 90.00);
