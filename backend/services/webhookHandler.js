const crypto = require('crypto');
const express = require('express');

/**
 * Webhook Handler Service for Multi-Channel E-commerce Portal
 * Handles real-time updates from channel partners (Shopify, BestBuy, Amazon)
 * Part of Milestone 8: Data Sync Services
 */
class WebhookHandler {
  constructor(syncService, dataMapper) {
    this.syncService = syncService;
    this.dataMapper = dataMapper;
    this.router = express.Router();
    this.setupRoutes();
  }

  /**
   * Setup webhook routes
   */
  setupRoutes() {
    // Shopify webhooks
    this.router.post('/shopify/orders/create', this.handleShopifyOrderCreate.bind(this));
    this.router.post('/shopify/orders/update', this.handleShopifyOrderUpdate.bind(this));
    this.router.post('/shopify/products/create', this.handleShopifyProductCreate.bind(this));
    this.router.post('/shopify/products/update', this.handleShopifyProductUpdate.bind(this));
    this.router.post('/shopify/inventory/update', this.handleShopifyInventoryUpdate.bind(this));

    // BestBuy (Mirakl) webhooks
    this.router.post('/bestbuy/orders/create', this.handleBestBuyOrderCreate.bind(this));
    this.router.post('/bestbuy/orders/update', this.handleBestBuyOrderUpdate.bind(this));
    this.router.post('/bestbuy/offers/update', this.handleBestBuyOfferUpdate.bind(this));

    // Amazon webhooks (placeholder)
    this.router.post('/amazon/orders/create', this.handleAmazonOrderCreate.bind(this));
    this.router.post('/amazon/inventory/update', this.handleAmazonInventoryUpdate.bind(this));

    // Generic webhook test endpoint
    this.router.post('/test', this.handleTestWebhook.bind(this));
  }

  /**
   * Verify Shopify webhook signature
   */
  verifyShopifyWebhook(data, signature) {
    if (!process.env.SHOPIFY_WEBHOOK_SECRET) {
      console.warn('SHOPIFY_WEBHOOK_SECRET not configured');
      return true; // Allow in development
    }

    const hmac = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET);
    hmac.update(data, 'utf8');
    const calculatedSignature = hmac.digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(calculatedSignature, 'base64')
    );
  }

  /**
   * Verify BestBuy (Mirakl) webhook signature
   */
  verifyBestBuyWebhook(data, signature) {
    if (!process.env.BESTBUY_WEBHOOK_SECRET) {
      console.warn('BESTBUY_WEBHOOK_SECRET not configured');
      return true; // Allow in development
    }

    // Mirakl uses HMAC-SHA1 for webhook signatures
    const hmac = crypto.createHmac('sha1', process.env.BESTBUY_WEBHOOK_SECRET);
    hmac.update(data, 'utf8');
    const calculatedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );
  }

  /**
   * Handle Shopify order creation
   */
  async handleShopifyOrderCreate(req, res) {
    try {
      const signature = req.get('X-Shopify-Hmac-Sha256');
      const rawBody = JSON.stringify(req.body);

      if (!this.verifyShopifyWebhook(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📦 Shopify order created:', req.body.order_number);

      // Map Shopify order to standard format
      const mappedOrder = this.dataMapper.mapData('shopify', 'order', req.body);

      // Get Shopify channel ID
      const channelId = await this.getChannelId('shopify');

      // Queue immediate sync for this specific order
      await this.syncService.addSyncJob(channelId, 'orders', {
        specificOrderId: req.body.id,
        webhook: true
      }, 9); // Highest priority

      res.status(200).json({ 
        success: true, 
        message: 'Order webhook processed',
        orderId: req.body.id
      });

    } catch (error) {
      console.error('Shopify order webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle Shopify order updates
   */
  async handleShopifyOrderUpdate(req, res) {
    try {
      const signature = req.get('X-Shopify-Hmac-Sha256');
      const rawBody = JSON.stringify(req.body);

      if (!this.verifyShopifyWebhook(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📝 Shopify order updated:', req.body.order_number);

      const channelId = await this.getChannelId('shopify');

      // Queue sync for order update
      await this.syncService.addSyncJob(channelId, 'orders', {
        specificOrderId: req.body.id,
        webhook: true,
        action: 'update'
      }, 8);

      res.status(200).json({ 
        success: true, 
        message: 'Order update webhook processed' 
      });

    } catch (error) {
      console.error('Shopify order update webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle Shopify product creation
   */
  async handleShopifyProductCreate(req, res) {
    try {
      const signature = req.get('X-Shopify-Hmac-Sha256');
      const rawBody = JSON.stringify(req.body);

      if (!this.verifyShopifyWebhook(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('🆕 Shopify product created:', req.body.title);

      const channelId = await this.getChannelId('shopify');

      await this.syncService.addSyncJob(channelId, 'products', {
        specificProductId: req.body.id,
        webhook: true
      }, 7);

      res.status(200).json({ 
        success: true, 
        message: 'Product webhook processed' 
      });

    } catch (error) {
      console.error('Shopify product webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle Shopify product updates
   */
  async handleShopifyProductUpdate(req, res) {
    try {
      const signature = req.get('X-Shopify-Hmac-Sha256');
      const rawBody = JSON.stringify(req.body);

      if (!this.verifyShopifyWebhook(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📝 Shopify product updated:', req.body.title);

      const channelId = await this.getChannelId('shopify');

      await this.syncService.addSyncJob(channelId, 'products', {
        specificProductId: req.body.id,
        webhook: true,
        action: 'update'
      }, 7);

      res.status(200).json({ 
        success: true, 
        message: 'Product update webhook processed' 
      });

    } catch (error) {
      console.error('Shopify product update webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle Shopify inventory updates
   */
  async handleShopifyInventoryUpdate(req, res) {
    try {
      const signature = req.get('X-Shopify-Hmac-Sha256');
      const rawBody = JSON.stringify(req.body);

      if (!this.verifyShopifyWebhook(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📊 Shopify inventory updated for item:', req.body.inventory_item_id);

      const channelId = await this.getChannelId('shopify');

      await this.syncService.addSyncJob(channelId, 'inventory', {
        specificInventoryId: req.body.inventory_item_id,
        webhook: true
      }, 8);

      res.status(200).json({ 
        success: true, 
        message: 'Inventory webhook processed' 
      });

    } catch (error) {
      console.error('Shopify inventory webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle BestBuy order creation
   */
  async handleBestBuyOrderCreate(req, res) {
    try {
      const signature = req.get('X-Mirakl-Signature');
      const rawBody = JSON.stringify(req.body);

      if (!this.verifyBestBuyWebhook(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📦 BestBuy order created:', req.body.order_id);

      const channelId = await this.getChannelId('bestbuy');

      await this.syncService.addSyncJob(channelId, 'orders', {
        specificOrderId: req.body.order_id,
        webhook: true
      }, 9);

      res.status(200).json({ 
        success: true, 
        message: 'BestBuy order webhook processed' 
      });

    } catch (error) {
      console.error('BestBuy order webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle BestBuy order updates
   */
  async handleBestBuyOrderUpdate(req, res) {
    try {
      const signature = req.get('X-Mirakl-Signature');
      const rawBody = JSON.stringify(req.body);

      if (!this.verifyBestBuyWebhook(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📝 BestBuy order updated:', req.body.order_id);

      const channelId = await this.getChannelId('bestbuy');

      await this.syncService.addSyncJob(channelId, 'orders', {
        specificOrderId: req.body.order_id,
        webhook: true,
        action: 'update'
      }, 8);

      res.status(200).json({ 
        success: true, 
        message: 'BestBuy order update webhook processed' 
      });

    } catch (error) {
      console.error('BestBuy order update webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle BestBuy offer updates
   */
  async handleBestBuyOfferUpdate(req, res) {
    try {
      const signature = req.get('X-Mirakl-Signature');
      const rawBody = JSON.stringify(req.body);

      if (!this.verifyBestBuyWebhook(rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      console.log('📝 BestBuy offer updated:', req.body.offer_id);

      const channelId = await this.getChannelId('bestbuy');

      await this.syncService.addSyncJob(channelId, 'products', {
        specificOfferId: req.body.offer_id,
        webhook: true,
        action: 'update'
      }, 7);

      res.status(200).json({ 
        success: true, 
        message: 'BestBuy offer update webhook processed' 
      });

    } catch (error) {
      console.error('BestBuy offer webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle Amazon order creation (placeholder)
   */
  async handleAmazonOrderCreate(req, res) {
    try {
      console.log('📦 Amazon order created:', req.body.AmazonOrderId);

      const channelId = await this.getChannelId('amazon');

      await this.syncService.addSyncJob(channelId, 'orders', {
        specificOrderId: req.body.AmazonOrderId,
        webhook: true
      }, 9);

      res.status(200).json({ 
        success: true, 
        message: 'Amazon order webhook processed' 
      });

    } catch (error) {
      console.error('Amazon order webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle Amazon inventory updates (placeholder)
   */
  async handleAmazonInventoryUpdate(req, res) {
    try {
      console.log('📊 Amazon inventory updated for SKU:', req.body.SellerSKU);

      const channelId = await this.getChannelId('amazon');

      await this.syncService.addSyncJob(channelId, 'inventory', {
        specificSKU: req.body.SellerSKU,
        webhook: true
      }, 8);

      res.status(200).json({ 
        success: true, 
        message: 'Amazon inventory webhook processed' 
      });

    } catch (error) {
      console.error('Amazon inventory webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle test webhook
   */
  async handleTestWebhook(req, res) {
    try {
      console.log('🧪 Test webhook received:', req.body);

      res.status(200).json({ 
        success: true, 
        message: 'Test webhook processed successfully',
        timestamp: new Date().toISOString(),
        data: req.body
      });

    } catch (error) {
      console.error('Test webhook error:', error);
      res.status(500).json({ error: 'Test webhook processing failed' });
    }
  }

  /**
   * Get channel ID by name
   */
  async getChannelId(channelName) {
    // This would typically query the database
    // For now, return mock IDs based on channel name
    const channelMap = {
      'shopify': 1,
      'bestbuy': 2,
      'amazon': 3
    };

    return channelMap[channelName.toLowerCase()] || null;
  }

  /**
   * Log webhook activity
   */
  async logWebhookActivity(channel, event, data, success = true, error = null) {
    try {
      // This would log to database or monitoring service
      const logEntry = {
        timestamp: new Date().toISOString(),
        channel: channel,
        event: event,
        success: success,
        error: error,
        dataSize: JSON.stringify(data).length
      };

      console.log('📋 Webhook activity:', logEntry);

      // TODO: Store in database webhook_logs table
      
    } catch (logError) {
      console.error('Failed to log webhook activity:', logError);
    }
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats() {
    // This would return statistics from database
    return {
      totalWebhooks: 0,
      successfulWebhooks: 0,
      failedWebhooks: 0,
      lastWebhook: null,
      channelBreakdown: {
        shopify: { total: 0, success: 0, failed: 0 },
        bestbuy: { total: 0, success: 0, failed: 0 },
        amazon: { total: 0, success: 0, failed: 0 }
      }
    };
  }

  /**
   * Get router for Express app
   */
  getRouter() {
    return this.router;
  }
}

module.exports = WebhookHandler;
