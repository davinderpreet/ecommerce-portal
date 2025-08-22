// =====================================================
// FILE: backend/src/modules/auth/auth.test.ts
// =====================================================
import { AuthService } from './auth.service';
import { UserCreateData, LoginCredentials } from './auth.types';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData: UserCreateData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      const result = await authService.registerUser(userData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user?.email).toBe(userData.email);
    });

    it('should not register user with existing email', async () => {
      const userData: UserCreateData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      // Register first user
      await authService.registerUser(userData);
      
      // Try to register again with same email
      const result = await authService.registerUser(userData);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });
  });

  describe('User Login', () => {
    it('should login with valid credentials', async () => {
      const userData: UserCreateData = {
        email: 'login@example.com',
        password: 'password123',
        firstName: 'Login',
        lastName: 'User'
      };

      // Register user first
      await authService.registerUser(userData);

      // Login
      const loginData: LoginCredentials = {
        email: userData.email,
        password: userData.password
      };

      const result = await authService.loginUser(loginData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should not login with invalid credentials', async () => {
      const loginData: LoginCredentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      };

      const result = await authService.loginUser(loginData);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });
  });
});

// =====================================================
// FILE: backend/scripts/setup.js
// =====================================================
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up E-commerce Portal Backend...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Please create one using .env.example as template');
  console.log('📋 Required environment variables:');
  console.log('   - NEON_DATABASE_URL');
  console.log('   - JWT_SECRET');
  console.log('   - NODE_ENV\n');
  process.exit(1);
}

try {
  // Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: __dirname + '/..' });

  // Build TypeScript
  console.log('\n🔨 Building TypeScript...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname + '/..' });

  // Test database connection
  console.log('\n🗄️  Testing database connection...');
  execSync('node dist/config/database.js', { stdio: 'inherit', cwd: __dirname + '/..' });

  console.log('\n✅ Backend setup completed successfully!');
  console.log('\n🎯 Next steps:');
  console.log('   1. Run: npm run dev');
  console.log('   2. Test auth endpoints at: http://localhost:3001/api/auth');
  console.log('   3. Health check: http://localhost:3001/api/health\n');

} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
}

// =====================================================
// FILE: backend/scripts/createAdmin.js
// =====================================================
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createAdminUser() {
  console.log('🔐 Creating Admin User\n');

  try {
    const email = await askQuestion('Admin email: ');
    const password = await askQuestion('Admin password (min 8 chars): ');
    const firstName = await askQuestion('First name: ');
    const lastName = await askQuestion('Last name: ');

    if (password.length < 8) {
      console.log('❌ Password must be at least 8 characters');
      return;
    }

    const response = await axios.post('http://localhost:3001/api/auth/register', {
      email,
      password,
      firstName,
      lastName,
      role: 'admin'
    });

    if (response.data.success) {
      console.log('\n✅ Admin user created successfully!');
      console.log('📧 Email:', email);
      console.log('🎫 Token:', response.data.token);
      console.log('\n💡 Save this token for API testing');
    } else {
      console.log('\n❌ Failed to create admin user:', response.data.message);
    }
  } catch (error) {
    if (error.response) {
      console.log('\n❌ Error:', error.response.data.message);
    } else {
      console.log('\n❌ Error:', error.message);
      console.log('💡 Make sure the server is running (npm run dev)');
    }
  } finally {
    rl.close();
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

createAdminUser();

// =====================================================
// FILE: backend/scripts/testAuth.js
// =====================================================
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testAuthSystem() {
  console.log('🧪 Testing Authentication System\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.message);

    // Test 2: Register User
    console.log('\n2. Testing user registration...');
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'User'
    };

    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log('✅ Registration passed:', registerResponse.data.message);
    const token = registerResponse.data.token;

    // Test 3: Login
    console.log('\n3. Testing user login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ Login passed:', loginResponse.data.message);

    // Test 4: Protected Route
    console.log('\n4. Testing protected route...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('✅ Protected route passed:', profileResponse.data.data.email);

    // Test 5: Invalid Token
    console.log('\n5. Testing invalid token...');
    try {
      await axios.get(`${BASE_URL}/auth/profile`, {
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      });
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Invalid token correctly rejected');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 All authentication tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Health check');
    console.log('   ✅ User registration'); 
    console.log('   ✅ User login');
    console.log('   ✅ Protected routes');
    console.log('   ✅ Token validation');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.log('\n💡 Make sure the server is running: npm run dev');
  }
}

testAuthSystem();

// =====================================================
// FILE: backend/.env.example (UPDATED)
// =====================================================
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/ecommerce_portal
NEON_DATABASE_URL=postgresql://neondb_owner:your_password@your-neon-endpoint.neon.tech/neondb?sslmode=require

# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Authentication (IMPORTANT: Change these in production!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d

# Redis Configuration (for future use)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info

# Channel API Configurations (will be used in Phase 2)
# Amazon
AMAZON_ACCESS_KEY_ID=your-amazon-access-key
AMAZON_SECRET_ACCESS_KEY=your-amazon-secret-key
AMAZON_MARKETPLACE_ID=your-marketplace-id
AMAZON_REGION=us-east-1

# Shopify
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-shopify-access-token
SHOPIFY_API_VERSION=2023-07

# Best Buy
BESTBUY_API_KEY=your-bestbuy-api-key
BESTBUY_ENVIRONMENT=sandbox

# AI/ML Configuration (for future use)
OPENAI_API_KEY=your-openai-api-key

# Monitoring & Error Tracking (optional)
SENTRY_DSN=your-sentry-dsn
