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
