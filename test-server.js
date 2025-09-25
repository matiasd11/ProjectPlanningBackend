// Script de prueba para verificar la conectividad con Bonita
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Función para probar el servidor
async function testServer() {
  console.log('🧪 Testing Bonita Express Backend...\n');
  
  try {
    // 1. Test Health Check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // 2. Test API Info
    console.log('\n2. Testing API info...');
    const infoResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ API info received:', infoResponse.data.message);
    
    // 3. Test Login (esto requerirá que Bonita esté ejecutándose)
    console.log('\n3. Testing login endpoint...');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: process.env.BONITA_USERNAME || 'install',
        password: process.env.BONITA_PASSWORD || 'install'
      }, {
        validateStatus: function (status) {
          return status < 600; // No arrojar error para códigos de estado < 600
        }
      });
      
      if (loginResponse.status === 200) {
        console.log('✅ Login test passed - Connected to Bonita successfully!');
        console.log('User:', loginResponse.data.user?.userName || 'Unknown');
        
        // Test logout
        if (loginResponse.headers['set-cookie']) {
          const cookies = loginResponse.headers['set-cookie'].join('; ');
          const logoutResponse = await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
            headers: { Cookie: cookies }
          });
          console.log('✅ Logout test passed');
        }
      } else {
        console.log('⚠️  Login failed (this is expected if Bonita is not running)');
        console.log('Status:', loginResponse.status);
        console.log('Response:', loginResponse.data);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
        console.log('⚠️  Could not connect to Bonita server - make sure Bonita is running on http://localhost:8080');
      } else {
        console.log('⚠️  Login test error:', error.message);
      }
    }
    
    console.log('\n🎉 Backend server is running correctly!');
    console.log('📋 To connect to Bonita BPM:');
    console.log('   1. Make sure Bonita server is running on http://localhost:8080');
    console.log('   2. Use the frontend client to make requests to this backend');
    console.log('   3. Check the README.md for usage examples');
    
  } catch (error) {
    console.error('❌ Server test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the Express server is running with: npm start');
    }
  }
}

// Ejecutar las pruebas
if (require.main === module) {
  testServer();
}

module.exports = { testServer };