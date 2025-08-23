# E-commerce Management Portal

High-end business management portal for multi-channel e-commerce operations (Amazon, Shopify, Best Buy).

## 🎯 Current Status: Milestone 7 - Best Buy API Integration (Week 11)

### ✅ Completed Milestones
- **M1**: Database Setup & Schema ✅
- **M2**: Authentication System ✅
- **M3**: Core API Structure ✅
- **M4**: Railway Deployment Pipeline ✅
- **M5**: Amazon API Integration (Planned)
- **M6**: Shopify API Integration ✅
- **M7**: Best Buy API Integration 🚧 **CURRENT**

### 🔄 Currently Working On
- Best Buy product search and catalog integration
- Store locator functionality  
- Product availability checking
- Database synchronization with Best Buy products

## Features

### 🔐 Authentication & Security
- JWT-based authentication
- User registration and login
- Protected API endpoints
- Role-based access control

### 🛍️ Multi-Channel Integration
- **Shopify**: Complete integration with product sync
- **Best Buy**: Product search, categories, stores, availability 
- **Amazon**: Planned for future milestone

### 📊 Core Functionality
- Product catalog management
- Inventory tracking across channels
- Sales order processing
- Real-time dashboard (coming in M13-M16)
- AI-powered analytics (coming in M25-M28)

### 🏪 Best Buy Integration (NEW)
- Product search across Best Buy catalog
- Category browsing and filtering
- Store locator by ZIP code or city
- Real-time product availability at stores
- Trending products based on customer reviews
- Automated product synchronization

## Tech Stack
- **Database:** Neon PostgreSQL
- **Backend:** Node.js + Express + TypeScript
- **Frontend:** React + TypeScript (Phase 4)
- **Deployment:** Railway App
- **Integrations:** Shopify API, Best Buy API

## Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Best Buy API key from [developer.bestbuy.com](https://developer.bestbuy.com/)
- Shopify store with private app credentials (optional)

### 1. Clone and Install
```bash
git clone [your-repo-url]
cd ecommerce-portal

# Install all dependencies
npm run setup
```

### 2. Environment Setup
```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit .env file with your credentials
nano backend/.env
```

**Required environment variables:**
```bash
NEON_DATABASE_URL=your_postgresql_url
JWT_SECRET=your_jwt_secret
BESTBUY_API_KEY=your_bestbuy_api_key

# Optional (for Shopify integration)
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token
```

### 3. Setup Best Buy Integration
```bash
cd backend
node scripts/setupBestBuy.js
```

This will:
- Validate your API key
- Configure database channels
- Test API connectivity
- Run a sample product sync

### 4. Start Development Server
```bash
npm run dev
```

Server will start at: `http://localhost:3001`

## API Endpoints

### 🔐 Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### 📦 Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `GET /api/products/:id` - Get product details

### 🏪 Best Buy Integration (NEW)
- `GET /api/bestbuy/test` - Test API connection
- `GET /api/bestbuy/products/search` - Search products
- `GET /api/bestbuy/products/:sku` - Get product by SKU
- `GET /api/bestbuy/categories` - Get product categories
- `GET /api/bestbuy/stores` - Find store locations
- `GET /api/bestbuy/products/:sku/availability
