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
