const fetch = require('node-fetch');

async function testMercadoPagoDirect() {
  console.log('=== PRUEBA DIRECTA DE MERCADOPAGO ===');
  
  // Simular el token (deberías reemplazar esto con tu token real)
  const token = process.env.MP_ACCESS_TOKEN || 'TU_TOKEN_AQUI';
  
  if (token === 'TU_TOKEN_AQUI') {
    console.log('ERROR: Debes configurar MP_ACCESS_TOKEN en las variables de entorno');
    return;
  }

  console.log('DEBUG: Token configurado:', !!token);
  console.log('DEBUG: Primeros 10 caracteres:', token.substring(0, 10) + '...');
  console.log('DEBUG: Longitud del token:', token.length);

  const testData = {
    items: [{
      id: 'test_direct_item',
      title: 'Producto de Prueba Directa',
      quantity: 1,
      unit_price: 1.00,
      currency_id: "ARS"
    }],
    external_reference: 'test_direct_' + Date.now()
  };

  console.log('DEBUG: Datos de prueba:', JSON.stringify(testData, null, 2));

  try {
    console.log('DEBUG: Enviando petición a MercadoPago...');
    
    const startTime = Date.now();
    
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Servido-Test/1.0'
      },
      body: JSON.stringify(testData)
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log('DEBUG: Tiempo de respuesta:', responseTime + 'ms');
    console.log('DEBUG: Status:', response.status);
    console.log('DEBUG: StatusText:', response.statusText);
    console.log('DEBUG: URL:', response.url);

    // Log de headers de respuesta
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    console.log('DEBUG: Headers de respuesta:', JSON.stringify(responseHeaders, null, 2));

    if (!response.ok) {
      console.log('ERROR: Respuesta no exitosa');
      
      let errorBody = '';
      try {
        errorBody = await response.text();
        console.log('ERROR: Response body (raw):', errorBody);
        
        // Intentar parsear como JSON
        try {
          const errorJson = JSON.parse(errorBody);
          console.log('ERROR: Response body (parsed):', JSON.stringify(errorJson, null, 2));
        } catch (parseError) {
          console.log('ERROR: Response body no es JSON válido');
        }
      } catch (e) {
        console.log('ERROR: No se pudo leer response body:', e.message);
      }

      // Análisis específico del error
      if (response.status === 403) {
        console.log('ERROR: Error 403 - Posibles causas:');
        console.log('  - Token expirado');
        console.log('  - Token sin permisos');
        console.log('  - Rate limiting');
        console.log('  - IP bloqueada');
        
        if (responseHeaders.rps === 'w403') {
          console.log('  - Confirmado: Error específico de MercadoPago (rps: w403)');
        }
      } else if (response.status === 401) {
        console.log('ERROR: Error 401 - Token inválido o expirado');
      } else if (response.status === 429) {
        console.log('ERROR: Error 429 - Rate limiting');
      }

      return;
    }

    const result = await response.json();
    console.log('SUCCESS: Preferencia creada exitosamente');
    console.log('SUCCESS: ID de preferencia:', result.id);
    console.log('SUCCESS: Respuesta completa:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('ERROR: Error en petición:', error);
    console.error('ERROR: Tipo de error:', error.constructor.name);
    console.error('ERROR: Mensaje:', error.message);
    
    if (error.type === 'invalid-json') {
      console.error('ERROR: MercadoPago devolvió una respuesta JSON inválida');
      console.error('ERROR: Esto confirma que el token está expirado o sin permisos');
    }
  }
}

// Ejecutar prueba
testMercadoPagoDirect().catch(console.error); 