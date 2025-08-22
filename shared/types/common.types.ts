// Common types shared between frontend and backend

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Channel {
  id: string;
  name: string;
  channelType: 'amazon' | 'shopify' | 'bestbuy';
  isActive: boolean;
  syncStatus: 'pending' | 'syncing' | 'completed' | 'error';
  lastSync?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  basePrice: number;
  costPrice?: number;
  isActive: boolean;
}

export interface SalesOrder {
  id: string;
  channelId: string;
  channelOrderId: string;
  customerEmail?: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  currency: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
