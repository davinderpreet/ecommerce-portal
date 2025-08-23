import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://ecommerce-portal-production.up.railway.app';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  register: async (email: string, password: string, name: string) => {
    const response = await api.post('/auth/register', { email, password, name });
    return response.data;
  },
  
  logout: async () => {
    localStorage.removeItem('authToken');
    return { success: true };
  },
};

// Quality Metrics API
export const qualityAPI = {
  getDashboard: async () => {
    const response = await api.get('/validation/quality/dashboard');
    return response.data;
  },
  
  getAlerts: async () => {
    const response = await api.get('/validation/quality/alerts');
    return response.data;
  },
  
  getTrends: async (startDate: string, endDate: string) => {
    const response = await api.get(`/validation/quality/trends?startDate=${startDate}&endDate=${endDate}`);
    return response.data;
  },
  
  getMetrics: async (startDate: string, endDate: string) => {
    const response = await api.get(`/validation/quality/metrics?startDate=${startDate}&endDate=${endDate}`);
    return response.data;
  },
};

// Validation API
export const validationAPI = {
  getHistory: async (limit: number = 25, offset: number = 0) => {
    const response = await api.get(`/validation/history?limit=${limit}&offset=${offset}`);
    return response.data;
  },
  
  getRuleViolations: async (status: string = 'active', limit: number = 25) => {
    const response = await api.get(`/validation/rules/violations?status=${status}&limit=${limit}`);
    return response.data;
  },
  
  getRuleStats: async () => {
    const response = await api.get('/validation/rules/stats');
    return response.data;
  },
  
  validateProduct: async (productData: any, channelId: string) => {
    const response = await api.post('/validation/product', { productData, channelId });
    return response.data;
  },
  
  validateOrder: async (orderData: any, channelId: string) => {
    const response = await api.post('/validation/order', { orderData, channelId });
    return response.data;
  },
};

// Sales API
export const salesAPI = {
  getSummary: async (startDate?: string, endDate?: string, channelId?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (channelId) params.append('channelId', channelId);
    
    const response = await api.get(`/reports/sales/summary?${params.toString()}`);
    return response.data;
  },
  
  getChannelPerformance: async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/reports/sales/channels?${params.toString()}`);
    return response.data;
  },
  
  getTopProducts: async (limit: number = 10, channelId?: string) => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (channelId) params.append('channelId', channelId);
    
    const response = await api.get(`/reports/sales/products/top?${params.toString()}`);
    return response.data;
  },
};

// Health check
export const healthAPI = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;
