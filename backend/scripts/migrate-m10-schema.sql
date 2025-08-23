-- M10 Database Schema Migration
-- Adds missing columns and tables required for Order Management System

-- Add missing columns to sales_orders table
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS order_status VARCHAR(50) DEFAULT 'pending';

-- Create order_status_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255),
    change_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create M10 Order Lifecycle tables
CREATE TABLE IF NOT EXISTS order_lifecycle_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL,
    stage VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create M10 Fulfillment tables
CREATE TABLE IF NOT EXISTS fulfillment_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address JSONB NOT NULL,
    capacity INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    carrier VARCHAR(100) NOT NULL,
    service_code VARCHAR(50) NOT NULL,
    estimated_days INTEGER,
    base_cost DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_fulfillments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL,
    fulfillment_center_id UUID REFERENCES fulfillment_centers(id),
    shipping_method_id UUID REFERENCES shipping_methods(id),
    tracking_number VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create M10 Customer Notification tables
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    subject VARCHAR(500),
    html_content TEXT,
    text_content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_email VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES notification_templates(id),
    order_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'queued',
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_email VARCHAR(255) NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_email, notification_type)
);

-- Create M10 Analytics tables
CREATE TABLE IF NOT EXISTS order_analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    avg_fulfillment_time INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date)
);

-- Insert default fulfillment centers
INSERT INTO fulfillment_centers (name, code, address) VALUES
('Main Warehouse', 'MAIN', '{"street": "123 Main St", "city": "Toronto", "province": "ON", "postal_code": "M1A 1A1", "country": "CA"}'),
('Secondary Warehouse', 'SEC', '{"street": "456 Oak Ave", "city": "Vancouver", "province": "BC", "postal_code": "V1A 1A1", "country": "CA"}')
ON CONFLICT (code) DO NOTHING;

-- Insert default shipping methods
INSERT INTO shipping_methods (name, carrier, service_code, estimated_days, base_cost) VALUES
('Standard Shipping', 'Canada Post', 'STANDARD', 5, 9.99),
('Express Shipping', 'Canada Post', 'EXPRESS', 2, 19.99),
('Overnight Shipping', 'FedEx', 'OVERNIGHT', 1, 39.99)
ON CONFLICT DO NOTHING;

-- Insert default notification templates
INSERT INTO notification_templates (name, type, subject, html_content, text_content) VALUES
('Order Confirmation', 'order_confirmation', 'Order Confirmation - #{order_id}', 
 '<h1>Thank you for your order!</h1><p>Order ID: #{order_id}</p><p>Total: #{total}</p>',
 'Thank you for your order! Order ID: #{order_id}, Total: #{total}'),
('Order Shipped', 'order_shipped', 'Your order has shipped - #{order_id}',
 '<h1>Your order is on its way!</h1><p>Tracking: #{tracking_number}</p>',
 'Your order is on its way! Tracking: #{tracking_number}'),
('Order Delivered', 'order_delivered', 'Order delivered - #{order_id}',
 '<h1>Your order has been delivered!</h1><p>Thank you for shopping with us.</p>',
 'Your order has been delivered! Thank you for shopping with us.')
ON CONFLICT DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lifecycle_stages_order_id ON order_lifecycle_stages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_order_id ON order_fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for);

COMMIT;
