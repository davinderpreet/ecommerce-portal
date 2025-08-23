/**
 * Data Mapping Service for Multi-Channel E-commerce Portal
 * Handles data transformation between different channel formats
 * Part of Milestone 8: Data Sync Services
 */
class DataMapper {
  constructor() {
    this.channelMappings = {
      shopify: {
        product: this.mapShopifyProduct.bind(this),
        order: this.mapShopifyOrder.bind(this),
        inventory: this.mapShopifyInventory.bind(this)
      },
      bestbuy: {
        product: this.mapBestBuyProduct.bind(this),
        order: this.mapBestBuyOrder.bind(this),
        inventory: this.mapBestBuyInventory.bind(this)
      },
      amazon: {
        product: this.mapAmazonProduct.bind(this),
        order: this.mapAmazonOrder.bind(this),
        inventory: this.mapAmazonInventory.bind(this)
      }
    };
  }

  /**
   * Map data from channel-specific format to standard format
   */
  mapData(channelName, dataType, rawData) {
    const channel = channelName.toLowerCase();
    
    if (!this.channelMappings[channel]) {
      throw new Error(`Unsupported channel: ${channelName}`);
    }

    if (!this.channelMappings[channel][dataType]) {
      throw new Error(`Unsupported data type: ${dataType} for channel: ${channelName}`);
    }

    return this.channelMappings[channel][dataType](rawData);
  }

  /**
   * Shopify Product Mapping
   */
  mapShopifyProduct(shopifyProduct) {
    return {
      sku: shopifyProduct.variants?.[0]?.sku || shopifyProduct.handle,
      channel_sku: shopifyProduct.id.toString(),
      name: shopifyProduct.title,
      description: this.stripHtml(shopifyProduct.body_html || ''),
      brand: shopifyProduct.vendor || 'Unknown',
      category: shopifyProduct.product_type || 'General',
      price: parseFloat(shopifyProduct.variants?.[0]?.price || 0),
      weight: shopifyProduct.variants?.[0]?.weight || 0,
      dimensions: {
        length: 0,
        width: 0,
        height: 0
      },
      images: shopifyProduct.images?.map(img => img.src) || [],
      status: shopifyProduct.status === 'active' ? 'active' : 'inactive',
      inventory_quantity: shopifyProduct.variants?.[0]?.inventory_quantity || 0,
      tags: shopifyProduct.tags?.split(',').map(tag => tag.trim()) || [],
      created_at: shopifyProduct.created_at,
      updated_at: shopifyProduct.updated_at
    };
  }

  /**
   * Shopify Order Mapping
   */
  mapShopifyOrder(shopifyOrder) {
    return {
      id: shopifyOrder.id.toString(),
      channel_order_id: shopifyOrder.order_number || shopifyOrder.name,
      customer: {
        email: shopifyOrder.email,
        name: `${shopifyOrder.customer?.first_name || ''} ${shopifyOrder.customer?.last_name || ''}`.trim(),
        phone: shopifyOrder.customer?.phone || null
      },
      date: shopifyOrder.created_at,
      status: this.mapShopifyOrderStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
      total: parseFloat(shopifyOrder.total_price),
      subtotal: parseFloat(shopifyOrder.subtotal_price || 0),
      tax: parseFloat(shopifyOrder.total_tax || 0),
      shipping: parseFloat(shopifyOrder.total_shipping_price_set?.shop_money?.amount || 0),
      currency: shopifyOrder.currency,
      items: shopifyOrder.line_items?.map(item => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total: parseFloat(item.price) * item.quantity
      })) || [],
      shipping_address: shopifyOrder.shipping_address ? {
        name: `${shopifyOrder.shipping_address.first_name || ''} ${shopifyOrder.shipping_address.last_name || ''}`.trim(),
        address1: shopifyOrder.shipping_address.address1,
        address2: shopifyOrder.shipping_address.address2,
        city: shopifyOrder.shipping_address.city,
        province: shopifyOrder.shipping_address.province,
        country: shopifyOrder.shipping_address.country,
        zip: shopifyOrder.shipping_address.zip
      } : null
    };
  }

  /**
   * Shopify Inventory Mapping
   */
  mapShopifyInventory(shopifyInventory) {
    return {
      sku: shopifyInventory.sku,
      quantity: shopifyInventory.available || 0,
      reserved: shopifyInventory.reserved || 0,
      location: shopifyInventory.location_id,
      updated_at: shopifyInventory.updated_at || new Date().toISOString()
    };
  }

  /**
   * BestBuy Product Mapping (Mirakl Offers)
   */
  mapBestBuyProduct(bestbuyOffer) {
    return {
      sku: bestbuyOffer.product_sku || bestbuyOffer.offer_id,
      channel_sku: bestbuyOffer.offer_id,
      name: bestbuyOffer.product_title || 'Unknown Product',
      description: bestbuyOffer.description || '',
      brand: bestbuyOffer.brand || 'Unknown',
      category: bestbuyOffer.category_code || 'General',
      price: parseFloat(bestbuyOffer.price || 0),
      weight: 0, // Not typically provided in Mirakl offers
      dimensions: {
        length: 0,
        width: 0,
        height: 0
      },
      images: [], // Would need separate API call for images
      status: bestbuyOffer.state === 11 ? 'active' : 'inactive', // Mirakl state codes
      inventory_quantity: bestbuyOffer.quantity || 0,
      tags: [],
      created_at: bestbuyOffer.date_created,
      updated_at: bestbuyOffer.last_updated
    };
  }

  /**
   * BestBuy Order Mapping (Mirakl Orders)
   */
  mapBestBuyOrder(bestbuyOrder) {
    return {
      id: bestbuyOrder.order_id,
      channel_order_id: bestbuyOrder.commercial_id || bestbuyOrder.order_id,
      customer: {
        email: bestbuyOrder.customer?.email || null,
        name: bestbuyOrder.customer?.firstname && bestbuyOrder.customer?.lastname 
          ? `${bestbuyOrder.customer.firstname} ${bestbuyOrder.customer.lastname}` 
          : 'Unknown Customer',
        phone: bestbuyOrder.customer?.phone || null
      },
      date: bestbuyOrder.date_created,
      status: this.mapBestBuyOrderStatus(bestbuyOrder.order_state),
      total: parseFloat(bestbuyOrder.total_price || 0),
      subtotal: parseFloat(bestbuyOrder.price || 0),
      tax: parseFloat(bestbuyOrder.total_commission || 0),
      shipping: parseFloat(bestbuyOrder.shipping_price || 0),
      currency: bestbuyOrder.currency_iso_code || 'CAD',
      items: bestbuyOrder.order_lines?.map(line => ({
        sku: line.offer_sku,
        name: line.product_title || 'Unknown Product',
        quantity: line.quantity,
        price: parseFloat(line.price),
        total: parseFloat(line.price) * line.quantity
      })) || [],
      shipping_address: bestbuyOrder.customer_shipping_address ? {
        name: `${bestbuyOrder.customer_shipping_address.firstname || ''} ${bestbuyOrder.customer_shipping_address.lastname || ''}`.trim(),
        address1: bestbuyOrder.customer_shipping_address.street_1,
        address2: bestbuyOrder.customer_shipping_address.street_2,
        city: bestbuyOrder.customer_shipping_address.city,
        province: bestbuyOrder.customer_shipping_address.state,
        country: bestbuyOrder.customer_shipping_address.country,
        zip: bestbuyOrder.customer_shipping_address.zip_code
      } : null
    };
  }

  /**
   * BestBuy Inventory Mapping
   */
  mapBestBuyInventory(bestbuyInventory) {
    return {
      sku: bestbuyInventory.product_sku,
      quantity: bestbuyInventory.quantity || 0,
      reserved: 0, // Not typically tracked in Mirakl
      location: bestbuyInventory.location_id || 'default',
      updated_at: bestbuyInventory.updated_at || new Date().toISOString()
    };
  }

  /**
   * Amazon Product Mapping (placeholder)
   */
  mapAmazonProduct(amazonProduct) {
    // Amazon SP-API product mapping
    return {
      sku: amazonProduct.SellerSKU,
      channel_sku: amazonProduct.ASIN,
      name: amazonProduct.ItemName || 'Unknown Product',
      description: amazonProduct.ItemDescription || '',
      brand: amazonProduct.Brand || 'Unknown',
      category: amazonProduct.ProductType || 'General',
      price: parseFloat(amazonProduct.Price?.Amount || 0),
      weight: 0,
      dimensions: {
        length: 0,
        width: 0,
        height: 0
      },
      images: [],
      status: amazonProduct.Status === 'Active' ? 'active' : 'inactive',
      inventory_quantity: 0, // Requires separate inventory API call
      tags: [],
      created_at: amazonProduct.OpenDate,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Amazon Order Mapping (placeholder)
   */
  mapAmazonOrder(amazonOrder) {
    return {
      id: amazonOrder.AmazonOrderId,
      channel_order_id: amazonOrder.AmazonOrderId,
      customer: {
        email: null, // Amazon doesn't provide customer email
        name: amazonOrder.BuyerName || 'Amazon Customer',
        phone: null
      },
      date: amazonOrder.PurchaseDate,
      status: this.mapAmazonOrderStatus(amazonOrder.OrderStatus),
      total: parseFloat(amazonOrder.OrderTotal?.Amount || 0),
      subtotal: 0,
      tax: 0,
      shipping: 0,
      currency: amazonOrder.OrderTotal?.CurrencyCode || 'USD',
      items: [], // Requires separate order items API call
      shipping_address: null // Requires separate shipping address API call
    };
  }

  /**
   * Amazon Inventory Mapping (placeholder)
   */
  mapAmazonInventory(amazonInventory) {
    return {
      sku: amazonInventory.SellerSKU,
      quantity: amazonInventory.InStockSupplyQuantity || 0,
      reserved: amazonInventory.ReservedQuantity || 0,
      location: amazonInventory.FulfillmentChannelSKU || 'FBA',
      updated_at: amazonInventory.LastUpdatedTime || new Date().toISOString()
    };
  }

  /**
   * Map Shopify order status to standard format
   */
  mapShopifyOrderStatus(financialStatus, fulfillmentStatus) {
    if (fulfillmentStatus === 'fulfilled') return 'fulfilled';
    if (fulfillmentStatus === 'partial') return 'partially_fulfilled';
    if (financialStatus === 'paid') return 'processing';
    if (financialStatus === 'pending') return 'pending';
    if (financialStatus === 'refunded') return 'refunded';
    return 'unknown';
  }

  /**
   * Map BestBuy order status to standard format
   */
  mapBestBuyOrderStatus(orderState) {
    const statusMap = {
      'WAITING_ACCEPTANCE': 'pending',
      'WAITING_DEBIT': 'processing',
      'WAITING_DEBIT_PAYMENT': 'processing',
      'SHIPPING': 'processing',
      'SHIPPED': 'fulfilled',
      'TO_COLLECT': 'fulfilled',
      'RECEIVED': 'fulfilled',
      'CLOSED': 'completed',
      'REFUSED': 'cancelled',
      'CANCELED': 'cancelled'
    };
    
    return statusMap[orderState] || 'unknown';
  }

  /**
   * Map Amazon order status to standard format
   */
  mapAmazonOrderStatus(orderStatus) {
    const statusMap = {
      'Pending': 'pending',
      'Unshipped': 'processing',
      'PartiallyShipped': 'partially_fulfilled',
      'Shipped': 'fulfilled',
      'Canceled': 'cancelled',
      'Unfulfillable': 'cancelled'
    };
    
    return statusMap[orderStatus] || 'unknown';
  }

  /**
   * Strip HTML tags from text
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Validate mapped data
   */
  validateMappedData(dataType, mappedData) {
    const validators = {
      product: this.validateProduct.bind(this),
      order: this.validateOrder.bind(this),
      inventory: this.validateInventory.bind(this)
    };

    if (!validators[dataType]) {
      throw new Error(`No validator for data type: ${dataType}`);
    }

    return validators[dataType](mappedData);
  }

  /**
   * Validate product data
   */
  validateProduct(product) {
    const errors = [];
    
    if (!product.sku) errors.push('SKU is required');
    if (!product.name) errors.push('Product name is required');
    if (typeof product.price !== 'number' || product.price < 0) {
      errors.push('Valid price is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Product validation failed: ${errors.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Validate order data
   */
  validateOrder(order) {
    const errors = [];
    
    if (!order.id) errors.push('Order ID is required');
    if (!order.date) errors.push('Order date is required');
    if (typeof order.total !== 'number' || order.total < 0) {
      errors.push('Valid order total is required');
    }
    if (!Array.isArray(order.items) || order.items.length === 0) {
      errors.push('Order must have at least one item');
    }
    
    if (errors.length > 0) {
      throw new Error(`Order validation failed: ${errors.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Validate inventory data
   */
  validateInventory(inventory) {
    const errors = [];
    
    if (!inventory.sku) errors.push('SKU is required');
    if (typeof inventory.quantity !== 'number' || inventory.quantity < 0) {
      errors.push('Valid quantity is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Inventory validation failed: ${errors.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Batch map data
   */
  batchMapData(channelName, dataType, rawDataArray) {
    const mappedData = [];
    const errors = [];

    for (let i = 0; i < rawDataArray.length; i++) {
      try {
        const mapped = this.mapData(channelName, dataType, rawDataArray[i]);
        this.validateMappedData(dataType, mapped);
        mappedData.push(mapped);
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
          data: rawDataArray[i]
        });
      }
    }

    return {
      success: mappedData,
      errors: errors,
      stats: {
        total: rawDataArray.length,
        successful: mappedData.length,
        failed: errors.length
      }
    };
  }
}

module.exports = DataMapper;
