const axios = require('axios');

// Configuración
const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend-url.onrender.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.servido.com.ar';

async function testFrontendConnection() {
  console.log('=== PRUEBA DE CONECTIVIDAD FRONTEND-BACKEND ===');
  console.log('Backend URL:', BACKEND_URL);
  console.log('Frontend URL:', FRONTEND_URL);
  console.log('');

  const tests = [
    {
      name: 'Diagnóstico de configuración',
      url: `${BACKEND_URL}/api/mercadopago/diagnose-config`,
      method: 'GET',
      headers: {
        'Origin': FRONTEND_URL,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Prueba de token simple',
      url: `${BACKEND_URL}/api/mercadopago/simple-token-test`,
      method: 'GET',
      headers: {
        'Origin': FRONTEND_URL,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Crear preferencia de prueba',
      url: `${BACKEND_URL}/api/mercadopago/payments/create-preference`,
      method: 'POST',
      headers: {
        'Origin': FRONTEND_URL,
        'Content-Type': 'application/json'
      },
      data: {
        products: [{
          productId: 'test_product_id',
          quantity: 1
        }],
        buyerId: 'test_buyer_id',
        buyerEmail: 'test@example.com'
      }
    }
  ];

  for (const test of tests) {
    console.log(`🧪 Probando: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Method: ${test.method}`);
    console.log(`   Headers:`, test.headers);
    
    try {
      const config = {
        method: test.method,
        url: test.url,
        headers: test.headers,
        timeout: 10000
      };

      if (test.data) {
        config.data = test.data;
      }

      const response = await axios(config);
      
      console.log(`   ✅ ÉXITO - Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log(`   ❌ ERROR - Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error:`, error.message);
      
      if (error.response) {
        console.log(`   Response data:`, JSON.stringify(error.response.data, null, 2));
        console.log(`   Response headers:`, error.response.headers);
      }
    }
    
    console.log('');
  }
}

// Ejecutar pruebas
testFrontendConnection().catch(console.error); 