const { Pool } = require('pg');
const nodemailer = require('nodemailer');

class CustomerNotificationService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    this.initialized = false;
    this.emailTransporter = null;
    this.templates = {};
    this.setupEmailTransporter();
    this.loadTemplates();
  }

  async initialize() {
    try {
      await this.createTables();
      this.initialized = true;
      console.log('✅ CustomerNotificationService initialized successfully');
    } catch (error) {
      console.error('❌ CustomerNotificationService initialization failed:', error.message);
      this.initialized = false;
    }
  }

  setupEmailTransporter() {
    // Configure email transporter (using Gmail as example)
    this.emailTransporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'noreply@ecommerce-portal.com',
        pass: process.env.EMAIL_PASSWORD || 'app-password'
      }
    });
  }

  loadTemplates() {
    this.templates = {
      order_confirmation: {
        subject: 'Order Confirmation - #{orderId}',
        html: `
          <h2>Thank you for your order!</h2>
          <p>Dear #{customerName},</p>
          <p>We've received your order <strong>#{orderId}</strong> and are processing it now.</p>
          <h3>Order Details:</h3>
          <ul>#{orderItems}</ul>
          <p><strong>Total: $#{orderTotal}</strong></p>
          <p>We'll send you another email when your order ships.</p>
          <p>Thank you for shopping with us!</p>
        `
      },
      order_shipped: {
        subject: 'Your order #{orderId} has shipped!',
        html: `
          <h2>Your order is on its way!</h2>
          <p>Dear #{customerName},</p>
          <p>Great news! Your order <strong>#{orderId}</strong> has been shipped.</p>
          <p><strong>Tracking Number:</strong> #{trackingNumber}</p>
          <p><strong>Carrier:</strong> #{carrier}</p>
          <p><strong>Estimated Delivery:</strong> #{estimatedDelivery}</p>
          <p><a href="#{trackingUrl}">Track your package</a></p>
          <p>Thank you for your business!</p>
        `
      },
      order_delivered: {
        subject: 'Your order #{orderId} has been delivered!',
        html: `
          <h2>Your order has been delivered!</h2>
          <p>Dear #{customerName},</p>
          <p>Your order <strong>#{orderId}</strong> has been successfully delivered.</p>
          <p>We hope you love your purchase! If you have any questions or concerns, please don't hesitate to contact us.</p>
          <p>Thank you for choosing us!</p>
        `
      },
      order_delayed: {
        subject: 'Update on your order #{orderId}',
        html: `
          <h2>Order Update</h2>
          <p>Dear #{customerName},</p>
          <p>We wanted to update you on your order <strong>#{orderId}</strong>.</p>
          <p>#{delayReason}</p>
          <p><strong>New Estimated Delivery:</strong> #{newEstimatedDelivery}</p>
          <p>We apologize for any inconvenience and appreciate your patience.</p>
          <p>If you have any questions, please contact our customer service team.</p>
        `
      },
      order_cancelled: {
        subject: 'Order #{orderId} has been cancelled',
        html: `
          <h2>Order Cancellation</h2>
          <p>Dear #{customerName},</p>
          <p>Your order <strong>#{orderId}</strong> has been cancelled as requested.</p>
          <p>#{cancellationReason}</p>
          <p>If a refund is applicable, it will be processed within 3-5 business days.</p>
          <p>Thank you for your understanding.</p>
        `
      },
      inventory_backorder: {
        subject: 'Item backordered for order #{orderId}',
        html: `
          <h2>Item Backordered</h2>
          <p>Dear #{customerName},</p>
          <p>We're writing to inform you that one or more items in your order <strong>#{orderId}</strong> are currently backordered.</p>
          <p><strong>Backordered Items:</strong></p>
          <ul>#{backorderedItems}</ul>
          <p><strong>Expected Restock Date:</strong> #{restockDate}</p>
          <p>We'll ship your order as soon as all items are available, or you can choose to receive available items now.</p>
          <p>Please contact us if you'd like to modify your order.</p>
        `
      }
    };
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      // Notification templates
      await client.query(`
        CREATE TABLE IF NOT EXISTS notification_templates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          html_content TEXT NOT NULL,
          text_content TEXT NULL,
          variables JSONB DEFAULT '{}',
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Notification queue
      await client.query(`
        CREATE TABLE IF NOT EXISTS notification_queue (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          customer_email VARCHAR(255) NOT NULL,
          notification_type VARCHAR(50) NOT NULL,
          template_name VARCHAR(100) NOT NULL,
          variables JSONB DEFAULT '{}',
          priority INTEGER DEFAULT 5,
          scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50) DEFAULT 'pending',
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          last_attempt_at TIMESTAMP NULL,
          sent_at TIMESTAMP NULL,
          error_message TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Notification history
      await client.query(`
        CREATE TABLE IF NOT EXISTS notification_history (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(255) NOT NULL,
          customer_email VARCHAR(255) NOT NULL,
          notification_type VARCHAR(50) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          channel VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          sent_at TIMESTAMP NOT NULL,
          opened_at TIMESTAMP NULL,
          clicked_at TIMESTAMP NULL,
          metadata JSONB DEFAULT '{}'
        )
      `);

      // Customer preferences
      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_notification_preferences (
          id SERIAL PRIMARY KEY,
          customer_email VARCHAR(255) UNIQUE NOT NULL,
          order_confirmations BOOLEAN DEFAULT TRUE,
          shipping_updates BOOLEAN DEFAULT TRUE,
          delivery_notifications BOOLEAN DEFAULT TRUE,
          marketing_emails BOOLEAN DEFAULT FALSE,
          sms_notifications BOOLEAN DEFAULT FALSE,
          phone_number VARCHAR(20) NULL,
          timezone VARCHAR(50) DEFAULT 'America/Toronto',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('📧 Customer notification tables created successfully');
    } finally {
      client.release();
    }
  }

  // Queue notification for sending
  async queueNotification(notificationData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO notification_queue (
          order_id, customer_email, notification_type, template_name, 
          variables, priority, scheduled_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        notificationData.orderId,
        notificationData.customerEmail,
        notificationData.type,
        notificationData.templateName || notificationData.type,
        JSON.stringify(notificationData.variables || {}),
        notificationData.priority || 5,
        notificationData.scheduledAt || new Date()
      ]);

      return {
        success: true,
        notification: result.rows[0]
      };
    } finally {
      client.release();
    }
  }

  // Send immediate notification
  async sendNotification(notificationData) {
    try {
      // Check customer preferences
      const preferences = await this.getCustomerPreferences(notificationData.customerEmail);
      if (!this.shouldSendNotification(notificationData.type, preferences)) {
        return {
          success: false,
          message: 'Customer has opted out of this notification type'
        };
      }

      // Get template
      const template = this.templates[notificationData.type];
      if (!template) {
        throw new Error(`Template not found for notification type: ${notificationData.type}`);
      }

      // Process template
      const processedContent = this.processTemplate(template, notificationData.variables);

      // Send email
      const emailResult = await this.sendEmail({
        to: notificationData.customerEmail,
        subject: processedContent.subject,
        html: processedContent.html
      });

      // Save to history
      await this.saveNotificationHistory({
        orderId: notificationData.orderId,
        customerEmail: notificationData.customerEmail,
        type: notificationData.type,
        subject: processedContent.subject,
        content: processedContent.html,
        status: emailResult.success ? 'sent' : 'failed'
      });

      return emailResult;
    } catch (error) {
      console.error('Notification send error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Process notification queue
  async processNotificationQueue(limit = 10) {
    const client = await this.pool.connect();
    try {
      // Get pending notifications
      const result = await client.query(`
        SELECT * FROM notification_queue 
        WHERE status = 'pending' AND scheduled_at <= CURRENT_TIMESTAMP
        ORDER BY priority ASC, created_at ASC
        LIMIT $1
      `, [limit]);

      const processed = [];
      
      for (const notification of result.rows) {
        try {
          // Send notification
          const sendResult = await this.sendNotification({
            orderId: notification.order_id,
            customerEmail: notification.customer_email,
            type: notification.notification_type,
            variables: notification.variables
          });

          // Update queue status
          await client.query(`
            UPDATE notification_queue 
            SET status = $1, sent_at = $2, attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP,
                error_message = $3
            WHERE id = $4
          `, [
            sendResult.success ? 'sent' : 'failed',
            sendResult.success ? new Date() : null,
            sendResult.success ? null : sendResult.message,
            notification.id
          ]);

          processed.push({
            id: notification.id,
            success: sendResult.success,
            message: sendResult.message
          });

        } catch (error) {
          // Update failed attempt
          await client.query(`
            UPDATE notification_queue 
            SET attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP,
                error_message = $1, status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END
            WHERE id = $2
          `, [error.message, notification.id]);

          processed.push({
            id: notification.id,
            success: false,
            message: error.message
          });
        }
      }

      return {
        success: true,
        processed: processed.length,
        results: processed
      };
    } finally {
      client.release();
    }
  }

  // Send email using configured transporter
  async sendEmail(emailData) {
    try {
      if (!this.emailTransporter) {
        return {
          success: false,
          message: 'Email transporter not configured'
        };
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@ecommerce-portal.com',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      };

      const info = await this.emailTransporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Process template with variables
  processTemplate(template, variables = {}) {
    let subject = template.subject;
    let html = template.html;

    // Replace template variables
    Object.keys(variables).forEach(key => {
      const placeholder = `#{${key}}`;
      const value = variables[key] || '';
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      html = html.replace(new RegExp(placeholder, 'g'), value);
    });

    return { subject, html };
  }

  // Get customer notification preferences
  async getCustomerPreferences(customerEmail) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM customer_notification_preferences 
        WHERE customer_email = $1
      `, [customerEmail]);

      if (result.rows.length === 0) {
        // Create default preferences
        const defaultResult = await client.query(`
          INSERT INTO customer_notification_preferences (customer_email)
          VALUES ($1)
          RETURNING *
        `, [customerEmail]);
        return defaultResult.rows[0];
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Check if notification should be sent based on preferences
  shouldSendNotification(type, preferences) {
    const typeMap = {
      'order_confirmation': 'order_confirmations',
      'order_shipped': 'shipping_updates',
      'order_delivered': 'delivery_notifications',
      'order_delayed': 'shipping_updates',
      'order_cancelled': 'order_confirmations',
      'inventory_backorder': 'shipping_updates'
    };

    const prefKey = typeMap[type];
    return prefKey ? preferences[prefKey] : true;
  }

  // Save notification to history
  async saveNotificationHistory(historyData) {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO notification_history (
          order_id, customer_email, notification_type, subject, 
          content, channel, status, sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `, [
        historyData.orderId,
        historyData.customerEmail,
        historyData.type,
        historyData.subject,
        historyData.content,
        'email',
        historyData.status
      ]);
    } finally {
      client.release();
    }
  }

  // Get notification history for order
  async getNotificationHistory(orderId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM notification_history 
        WHERE order_id = $1 
        ORDER BY sent_at DESC
      `, [orderId]);

      return {
        success: true,
        history: result.rows
      };
    } finally {
      client.release();
    }
  }

  // Update customer preferences
  async updateCustomerPreferences(customerEmail, preferences) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO customer_notification_preferences (
          customer_email, order_confirmations, shipping_updates, 
          delivery_notifications, marketing_emails, sms_notifications, phone_number
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (customer_email) 
        DO UPDATE SET 
          order_confirmations = $2,
          shipping_updates = $3,
          delivery_notifications = $4,
          marketing_emails = $5,
          sms_notifications = $6,
          phone_number = $7,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        customerEmail,
        preferences.orderConfirmations !== undefined ? preferences.orderConfirmations : true,
        preferences.shippingUpdates !== undefined ? preferences.shippingUpdates : true,
        preferences.deliveryNotifications !== undefined ? preferences.deliveryNotifications : true,
        preferences.marketingEmails !== undefined ? preferences.marketingEmails : false,
        preferences.smsNotifications !== undefined ? preferences.smsNotifications : false,
        preferences.phoneNumber || null
      ]);

      return {
        success: true,
        preferences: result.rows[0]
      };
    } finally {
      client.release();
    }
  }

  // Get notification analytics
  async getNotificationAnalytics(days = 7) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          notification_type,
          COUNT(*) as total_sent,
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
          COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked_count,
          ROUND(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as open_rate,
          ROUND(COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as click_rate
        FROM notification_history 
        WHERE sent_at >= NOW() - INTERVAL '${days} days'
        GROUP BY notification_type
        ORDER BY total_sent DESC
      `);

      return {
        success: true,
        analytics: result.rows
      };
    } finally {
      client.release();
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = CustomerNotificationService;
