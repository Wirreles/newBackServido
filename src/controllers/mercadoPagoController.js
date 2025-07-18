const mercadopago = require('mercadopago');
const axios = require('axios');
const Vendedor = require('../models/vendedor');
const Subscription = require('../models/subscription');
const { db } = require('../firebase');

// Configuración más robusta del SDK de MercadoPago
let client;
let mpSub;

try {
  client = new mercadopago.MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
  });
  
  mpSub = new mercadopago.MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN_SUB 
  });
  
  console.log('DEBUG: Configuración de MercadoPago inicializada correctamente');
} catch (error) {
  console.error('ERROR: Error inicializando configuración de MercadoPago:', error);
}

class MercadoPagoController {
  // Función para probar creación de preferencia con debug detallado
  static async testPreferenceCreation(req, res) {
    try {
      console.log('=== PRUEBA DE CREACIÓN DE PREFERENCIA CON DEBUG ===');
      console.log('DEBUG: Timestamp:', new Date().toISOString());
      
      if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
      }

      if (!client) {
        return res.status(500).json({ error: 'Cliente de MercadoPago no inicializado' });
      }

      console.log('DEBUG: Token configurado:', !!process.env.MP_ACCESS_TOKEN);
      console.log('DEBUG: Primeros 10 caracteres del token:', process.env.MP_ACCESS_TOKEN.substring(0, 10) + '...');
      console.log('DEBUG: Cliente inicializado:', !!client);

      // Crear preferencia mínima para prueba
      const preference = new mercadopago.Preference(client);
      
      const testPreferenceData = {
        body: {
          items: [{
            id: 'test_item_minimal',
            title: 'Producto de Prueba Mínimo',
            quantity: 1,
            unit_price: 1.00,
            currency_id: "ARS"
          }],
          external_reference: 'test_minimal_' + Date.now()
        }
      };

      console.log('DEBUG: Datos de preferencia de prueba:', JSON.stringify(testPreferenceData, null, 2));
      console.log('DEBUG: Intentando crear preferencia mínima...');
      
      const startTime = Date.now();
      
      try {
        const result = await preference.create(testPreferenceData);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log('DEBUG: Preferencia creada exitosamente en', responseTime + 'ms');
        console.log('DEBUG: ID de preferencia:', result.id);
        console.log('DEBUG: Respuesta completa:', JSON.stringify(result, null, 2));

        res.json({
          success: true,
          message: 'Preferencia de prueba creada exitosamente',
          preferenceId: result.id,
          responseTime: responseTime + 'ms',
          result: result
        });

      } catch (preferenceError) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.error('ERROR: Error creando preferencia de prueba:', preferenceError);
        console.error('ERROR: Tipo de error:', preferenceError.constructor.name);
        console.error('ERROR: Mensaje:', preferenceError.message);
        console.error('ERROR: Tiempo de respuesta:', responseTime + 'ms');
        
        // Intentar obtener más información del error
        let errorDetails = {
          type: preferenceError.type || 'unknown',
          message: preferenceError.message,
          responseTime: responseTime + 'ms'
        };

        if (preferenceError.response) {
          console.error('ERROR: Status:', preferenceError.response.status);
          console.error('ERROR: StatusText:', preferenceError.response.statusText);
          
          errorDetails.status = preferenceError.response.status;
          errorDetails.statusText = preferenceError.response.statusText;
          
          try {
            const errorBody = await preferenceError.response.text();
            console.error('ERROR: Response body (raw):', errorBody);
            errorDetails.responseBody = errorBody;
            
            // Intentar parsear como JSON
            try {
              const errorJson = JSON.parse(errorBody);
              console.error('ERROR: Response body (parsed):', JSON.stringify(errorJson, null, 2));
              errorDetails.responseJson = errorJson;
            } catch (parseError) {
              console.error('ERROR: Response body no es JSON válido');
            }
          } catch (e) {
            console.error('ERROR: No se pudo leer response body:', e.message);
          }
        }

        res.status(500).json({
          success: false,
          error: 'Error creando preferencia de prueba',
          details: errorDetails
        });
      }

    } catch (error) {
      console.error('ERROR: Error en prueba de preferencia:', error);
      res.status(500).json({ 
        error: 'Error en prueba de preferencia', 
        details: error.message 
      });
    }
  }

  // Función para diagnosticar configuración de URLs
  static async diagnoseConfiguration(req, res) {
    try {
      console.log('=== DIAGNÓSTICO DE CONFIGURACIÓN ===');
      
      const config = {
        environment: {
          NODE_ENV: process.env.NODE_ENV || 'no configurado',
          PORT: process.env.PORT || 'no configurado'
        },
        urls: {
          BASE_URL: process.env.BASE_URL || 'no configurado',
          FRONTEND_URL: process.env.FRONTEND_URL || 'no configurado'
        },
        mercadopago: {
          MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN ? 'configurado' : 'no configurado',
          MP_ACCESS_TOKEN_SUB: process.env.MP_ACCESS_TOKEN_SUB ? 'configurado' : 'no configurado'
        },
        headers: {
          origin: req.headers.origin || 'no origin',
          host: req.headers.host || 'no host',
          referer: req.headers.referer || 'no referer'
        }
      };

      console.log('DEBUG: Configuración actual:', JSON.stringify(config, null, 2));

      // Verificar si las URLs están configuradas correctamente
      const issues = [];
      
      if (!process.env.BASE_URL) {
        issues.push('BASE_URL no está configurada');
      } else if (!process.env.BASE_URL.startsWith('http')) {
        issues.push('BASE_URL debe comenzar con http:// o https://');
      }
      
      if (!process.env.FRONTEND_URL) {
        issues.push('FRONTEND_URL no está configurada');
      } else if (!process.env.FRONTEND_URL.startsWith('http')) {
        issues.push('FRONTEND_URL debe comenzar con http:// o https://');
      }

      // Verificar si el origin del request está permitido
      const allowedOrigins = [
        'https://www.servido.com.ar',
        'https://servido.com.ar',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:4173',
        'https://new-front-servido.vercel.app'
      ];

      const requestOrigin = req.headers.origin;
      const isOriginAllowed = !requestOrigin || allowedOrigins.includes(requestOrigin);
      
      if (!isOriginAllowed) {
        issues.push(`Origin '${requestOrigin}' no está en la lista de orígenes permitidos`);
      }

      res.json({
        success: true,
        config: config,
        issues: issues,
        isOriginAllowed: isOriginAllowed,
        allowedOrigins: allowedOrigins
      });

    } catch (error) {
      console.error('ERROR: Error en diagnóstico:', error);
      res.status(500).json({ 
        error: 'Error en diagnóstico', 
        details: error.message 
      });
    }
  }

  // Función para probar múltiples endpoints de MercadoPago
  static async comprehensiveTokenTest(req, res) {
    try {
      console.log('=== PRUEBA COMPREHENSIVA DE TOKEN ===');
      console.log('DEBUG: Timestamp:', new Date().toISOString());
      
      if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
      }

      const results = {
        tokenInfo: {
          configured: true,
          length: process.env.MP_ACCESS_TOKEN.length,
          format: /^APP_USR-[a-zA-Z0-9-]+$/.test(process.env.MP_ACCESS_TOKEN),
          isSandbox: process.env.MP_ACCESS_TOKEN.includes('TEST')
        },
        tests: {}
      };

      // Test 1: Endpoint básico de MercadoPago
      console.log('DEBUG: Test 1 - Endpoint básico...');
      try {
        const response1 = await fetch('https://api.mercadopago.com', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        results.tests.basicEndpoint = {
          status: response1.status,
          statusText: response1.statusText,
          success: response1.ok
        };
        console.log('DEBUG: Test 1 resultado:', results.tests.basicEndpoint);
      } catch (error) {
        results.tests.basicEndpoint = { error: error.message };
        console.log('DEBUG: Test 1 error:', error.message);
      }

      // Test 2: Endpoint de usuarios (que falló antes)
      console.log('DEBUG: Test 2 - Endpoint de usuarios...');
      try {
        const response2 = await fetch('https://api.mercadopago.com/users/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        results.tests.usersEndpoint = {
          status: response2.status,
          statusText: response2.statusText,
          success: response2.ok
        };
        
        if (response2.ok) {
          const userData = await response2.json();
          results.tests.usersEndpoint.userData = userData;
        } else {
          const errorText = await response2.text();
          results.tests.usersEndpoint.errorDetails = errorText;
        }
        
        console.log('DEBUG: Test 2 resultado:', results.tests.usersEndpoint);
      } catch (error) {
        results.tests.usersEndpoint = { error: error.message };
        console.log('DEBUG: Test 2 error:', error.message);
      }

      // Test 3: Endpoint de preferencias (el que necesitamos)
      console.log('DEBUG: Test 3 - Endpoint de preferencias...');
      try {
        const testPreference = {
          items: [{
            id: 'test_item',
            title: 'Test Product',
            quantity: 1,
            unit_price: 1.00,
            currency_id: "ARS"
          }],
          external_reference: 'comprehensive_test'
        };

        const response3 = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPreference)
        });
        
        results.tests.preferencesEndpoint = {
          status: response3.status,
          statusText: response3.statusText,
          success: response3.ok
        };
        
        if (response3.ok) {
          const preferenceData = await response3.json();
          results.tests.preferencesEndpoint.preferenceId = preferenceData.id;
        } else {
          const errorText = await response3.text();
          results.tests.preferencesEndpoint.errorDetails = errorText;
        }
        
        console.log('DEBUG: Test 3 resultado:', results.tests.preferencesEndpoint);
      } catch (error) {
        results.tests.preferencesEndpoint = { error: error.message };
        console.log('DEBUG: Test 3 error:', error.message);
      }

      // Análisis final
      console.log('DEBUG: Análisis final de resultados:', JSON.stringify(results, null, 2));
      
      res.json({
        success: true,
        message: 'Prueba comprehensiva completada',
        results: results
      });

    } catch (error) {
      console.error('ERROR: Error en prueba comprehensiva:', error);
      res.status(500).json({ 
        error: 'Error en prueba comprehensiva', 
        details: error.message 
      });
    }
  }

  // Función simple para probar el token sin usar /users/me
  static async simpleTokenTest(req, res) {
    try {
      console.log('=== PRUEBA SIMPLE DE TOKEN ===');
      console.log('DEBUG: Timestamp:', new Date().toISOString());
      
      if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
      }

      console.log('DEBUG: Token configurado:', !!process.env.MP_ACCESS_TOKEN);
      console.log('DEBUG: Longitud del token:', process.env.MP_ACCESS_TOKEN.length);
      console.log('DEBUG: Primeros 10 caracteres:', process.env.MP_ACCESS_TOKEN.substring(0, 10) + '...');
      console.log('DEBUG: Últimos 10 caracteres:', '...' + process.env.MP_ACCESS_TOKEN.substring(process.env.MP_ACCESS_TOKEN.length - 10));
      
      // Verificar si el token tiene el formato correcto
      const tokenPattern = /^APP_USR-[a-zA-Z0-9-]+$/;
      const isValidFormat = tokenPattern.test(process.env.MP_ACCESS_TOKEN);
      console.log('DEBUG: Formato de token válido:', isValidFormat);
      
      // Probar con una petición más simple - crear una preferencia mínima
      const testPreference = {
        items: [{
          id: 'test_item',
          title: 'Test Product',
          quantity: 1,
          unit_price: 1.00,
          currency_id: "ARS"
        }],
        external_reference: 'test_token_verification'
      };

      console.log('DEBUG: Datos de preferencia a enviar:', JSON.stringify(testPreference, null, 2));
      console.log('DEBUG: Intentando crear preferencia de prueba...');
      
      // Crear headers detallados
      const headers = {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Servido-Backend/1.0'
      };
      
      console.log('DEBUG: Headers enviados:', JSON.stringify(headers, null, 2));
      console.log('DEBUG: URL de destino: https://api.mercadopago.com/checkout/preferences');
      
      const startTime = Date.now();
      
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(testPreference)
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log('DEBUG: Tiempo de respuesta:', responseTime + 'ms');
      console.log('DEBUG: Status de respuesta:', response.status);
      console.log('DEBUG: Status text:', response.statusText);
      console.log('DEBUG: URL de respuesta:', response.url);
      
      // Log detallado de headers de respuesta
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      console.log('DEBUG: Headers de respuesta completos:', JSON.stringify(responseHeaders, null, 2));
      
      // Verificar headers específicos de MercadoPago
      console.log('DEBUG: Content-Type de respuesta:', response.headers.get('content-type'));
      console.log('DEBUG: Content-Length de respuesta:', response.headers.get('content-length'));
      console.log('DEBUG: Rate limit headers:');
      console.log('  - X-RateLimit-Limit:', response.headers.get('x-ratelimit-limit'));
      console.log('  - X-RateLimit-Remaining:', response.headers.get('x-ratelimit-remaining'));
      console.log('  - X-RateLimit-Reset:', response.headers.get('x-ratelimit-reset'));

      if (!response.ok) {
        console.log('DEBUG: Error HTTP detectado');
        
        // Intentar leer el body de error
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.log('DEBUG: Error response body (raw):', errorBody);
          
          // Intentar parsear como JSON
          try {
            const errorJson = JSON.parse(errorBody);
            console.log('DEBUG: Error response body (parsed):', JSON.stringify(errorJson, null, 2));
          } catch (parseError) {
            console.log('DEBUG: Error response no es JSON válido');
          }
        } catch (readError) {
          console.log('DEBUG: No se pudo leer error response body:', readError.message);
        }
        
        // Análisis específico del error 403
        if (response.status === 403) {
          console.log('DEBUG: Análisis específico del error 403:');
          console.log('  - Posible token expirado');
          console.log('  - Posible token sin permisos');
          console.log('  - Posible rate limiting');
          console.log('  - Posible IP bloqueada');
          
          if (responseHeaders.rps === 'w403') {
            console.log('  - Confirmado: Error específico de MercadoPago (rps: w403)');
          }
        }
        
        return res.status(response.status).json({ 
          error: 'Error creando preferencia de prueba',
          status: response.status,
          statusText: response.statusText,
          details: errorBody || 'Sin detalles disponibles',
          responseTime: responseTime + 'ms',
          headers: responseHeaders
        });
      }

      const result = await response.json();
      console.log('DEBUG: Preferencia creada exitosamente:', result.id);
      console.log('DEBUG: Respuesta completa:', JSON.stringify(result, null, 2));

      res.json({
        success: true,
        message: 'Token válido - Preferencia creada exitosamente',
        preferenceId: result.id,
        isSandbox: process.env.MP_ACCESS_TOKEN.includes('TEST'),
        responseTime: responseTime + 'ms'
      });

    } catch (error) {
      console.error('ERROR: Error en prueba simple:', error);
      console.error('ERROR: Tipo de error:', error.constructor.name);
      console.error('ERROR: Stack trace:', error.stack);
      
      res.status(500).json({ 
        error: 'Error en prueba simple', 
        details: error.message,
        type: error.constructor.name
      });
    }
  }

  // Función para verificar el token de MercadoPago
  static async verifyMercadoPagoToken(req, res) {
    try {
      console.log('=== VERIFICACIÓN DE TOKEN MERCADOPAGO ===');
      
      if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
      }

      console.log('DEBUG: Token configurado:', !!process.env.MP_ACCESS_TOKEN);
      console.log('DEBUG: Primeros 10 caracteres del token:', process.env.MP_ACCESS_TOKEN.substring(0, 10) + '...');
      
      // Verificar si es token de sandbox o producción
      const isSandbox = process.env.MP_ACCESS_TOKEN.includes('TEST');
      console.log('DEBUG: Es token de sandbox:', isSandbox);

      // Intentar hacer una petición simple a la API de MercadoPago
      const response = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('DEBUG: Status de respuesta:', response.status);
      console.log('DEBUG: Headers de respuesta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('DEBUG: Error response:', errorText);
        return res.status(response.status).json({ 
          error: 'Error verificando token',
          status: response.status,
          details: errorText
        });
      }

      const userData = await response.json();
      console.log('DEBUG: Datos del usuario:', userData);

      res.json({
        success: true,
        message: 'Token válido',
        user: userData,
        isSandbox: isSandbox
      });

    } catch (error) {
      console.error('ERROR: Error verificando token:', error);
      res.status(500).json({ 
        error: 'Error verificando token', 
        details: error.message 
      });
    }
  }

  // Función de prueba para verificar conectividad con MercadoPago
  static async testMercadoPagoConnection(req, res) {
    try {
      console.log('DEBUG: Probando conectividad con MercadoPago...');
      
      if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
      }

      // Crear una preferencia de prueba simple
      const preference = new mercadopago.Preference(client);
      
      const testResult = await preference.create({
        body: {
          items: [{
            id: 'test_item',
            title: 'Producto de prueba',
            quantity: 1,
            unit_price: 1.00,
            currency_id: "ARS"
          }],
          external_reference: 'test_connection'
        }
      });

      console.log('DEBUG: Conexión exitosa con MercadoPago:', testResult.id);
      res.json({ 
        success: true, 
        message: 'Conexión exitosa con MercadoPago',
        preferenceId: testResult.id 
      });

    } catch (error) {
      console.error('ERROR: Fallo en prueba de conectividad:', error);
      res.status(500).json({ 
        error: 'Error de conectividad con MercadoPago', 
        details: error.message,
        type: error.type || 'unknown'
      });
    }
  }

  // Maneja el callback de OAuth
 
  // Suscripciones
  static async createSubscriptionPreference(req, res) {
    try {
      const { userId, planType } = req.body;
      console.log('Body recibido:', req.body);

      // Verificar usuario
      const vendedor = await Vendedor.getByUserId(userId);
      console.log('Vendedor encontrado:', vendedor);
      if (!vendedor) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Crear preferencia para suscripción con la instancia global
      const preference = new mercadopago.Preference(mpSub);

      const result = await preference.create({
        body: {
          items: [{
            id: `subscription_${planType}`,
            title: `Plan ${planType} de Vendedor`,
            quantity: 1,
            unit_price: Subscription.getPlanPrice(planType),
            currency_id: "ARS"
          }],
          payer: {
            email: vendedor.email
          },
          external_reference: `subscription_${userId}_${planType}`,
          notification_url: `${process.env.BASE_URL}/api/mercadopago/webhooks`,
          back_urls: {
            success: `${process.env.FRONTEND_URL}/dashboard/seller?subscription=success`,
            failure: `${process.env.FRONTEND_URL}/dashboard/seller?subscription=failure`
          },
          auto_return: "approved"
        }
      });

      res.json(result);
    } catch (error) {
      console.error('Error creando preferencia de suscripción:', error);
      res.status(500).json({ error: 'Error creando preferencia' });
    }
  }



  // PAGOS DE PRODUCTOS CENTRALIZADO - REESCRITO
static async createProductPreference(req, res) {
  try {
    console.log('=== INICIO DE CREACIÓN DE PREFERENCIA ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body (raw):', req.body);
    console.log('Body (stringified):', JSON.stringify(req.body, null, 2));

    const { products, buyerId, buyerEmail } = req.body;

    // Validaciones iniciales
    if (!process.env.MP_ACCESS_TOKEN || !process.env.BASE_URL || !process.env.FRONTEND_URL || !client) {
      return res.status(500).json({
        error: 'Configuración de entorno incompleta o cliente de MercadoPago no inicializado'
      });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'El array de productos es inválido o está vacío' });
    }

    if (!buyerId || !buyerEmail) {
      return res.status(400).json({ error: 'Faltan buyerId o buyerEmail' });
    }

    const validatedProducts = [];
    let totalAmount = 0;

    // Validar y recolectar productos
    for (const [i, product] of products.entries()) {
      const { productId, quantity } = product;

      if (!productId || typeof productId !== 'string' || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: `Datos inválidos en el producto ${i}` });
      }

      const productDoc = await db.collection('products').doc(productId).get();
      if (!productDoc.exists) {
        return res.status(404).json({ error: `Producto no encontrado: ${productId}` });
      }

      const productData = productDoc.data();

      if (productData.disponible === false) {
        return res.status(400).json({ error: `El producto ${productData.name} no está disponible` });
      }

      if (typeof productData.stock === 'number' && productData.stock < quantity) {
        return res.status(400).json({ error: `Stock insuficiente para el producto ${productData.name}` });
      }

      validatedProducts.push({
        productId,
        quantity,
        vendedorId: productData.sellerId,
        name: productData.name,
        price: productData.price,
        stock: productData.stock ?? null,
        paidToSeller: false
      });

      totalAmount += productData.price * quantity;
    }

    // Generar ID de la compra
    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const preference = new mercadopago.Preference(client);

    const preferenceData = {
      body: {
        items: validatedProducts.map((p) => ({
          id: p.productId,
          title: p.name,
          quantity: p.quantity,
          unit_price: parseFloat(p.price),
          currency_id: "ARS"
        })),
        back_urls: {
          success: `${process.env.FRONTEND_URL}/purchase/success`,
          failure: `${process.env.FRONTEND_URL}/purchase/failure`,
          pending: `${process.env.FRONTEND_URL}/purchase/pending`
        },
        auto_return: "approved",
        notification_url: `${process.env.BASE_URL}/api/mercadopago/webhooks`,
        external_reference: purchaseId,
        payer: {
          email: buyerEmail
        }
      }
    };

    // Crear preferencia
    let result;
    try {
      console.log('DEBUG: Intentando crear preferencia con MercadoPago...');
      console.log('DEBUG: Token usado:', process.env.MP_ACCESS_TOKEN.substring(0, 10) + '...');
      console.log('DEBUG: Datos de preferencia:', JSON.stringify(preferenceData, null, 2));
      
      result = await preference.create(preferenceData);
      console.log('DEBUG: Preferencia creada exitosamente:', result.id);
    } catch (preferenceError) {
      console.error('ERROR: Error creando preferencia:', preferenceError);
      console.error('ERROR: Tipo de error:', preferenceError.constructor.name);
      console.error('ERROR: Mensaje:', preferenceError.message);
      console.error('ERROR: Stack:', preferenceError.stack);
      
      // Intentar obtener más información del error
      if (preferenceError.response) {
        console.error('ERROR: Status:', preferenceError.response.status);
        console.error('ERROR: StatusText:', preferenceError.response.statusText);
        console.error('ERROR: Headers:', preferenceError.response.headers);
        try {
          const errorBody = await preferenceError.response.text();
          console.error('ERROR: Response body (raw):', errorBody);
          
          // Intentar parsear como JSON
          try {
            const errorJson = JSON.parse(errorBody);
            console.error('ERROR: Response body (parsed):', JSON.stringify(errorJson, null, 2));
          } catch (parseError) {
            console.error('ERROR: Response body no es JSON válido');
          }
        } catch (e) {
          console.error('ERROR: No se pudo leer response body:', e.message);
        }
      }
      
      // Análisis específico del error
      if (preferenceError.type === 'invalid-json') {
        console.error('ERROR: MercadoPago devolvió una respuesta JSON inválida');
        console.error('ERROR: Esto indica un problema con el token de acceso o la API');
        console.error('ERROR: Posibles causas:');
        console.error('  - Token expirado');
        console.error('  - Token sin permisos');
        console.error('  - Rate limiting');
        console.error('  - Problema temporal de MercadoPago');
      }
      
      throw preferenceError;
    }

    // Guardar en Firestore
    await db.collection('pending_purchases').doc(purchaseId).set({
      buyerId,
      buyerEmail,
      products: validatedProducts,
      totalAmount,
      status: 'pending',
      createdAt: new Date(),
      preferenceId: result.id
    });

    return res.json(result);

  } catch (error) {
    console.error('Error creando preferencia centralizada:', error);
    res.status(500).json({
      error: 'Error creando preferencia',
      details: error.message,
      type: error.type || 'unknown'
    });
  }
}


  // WEBHOOK CENTRALIZADO - ACTUALIZADO
  static async handleWebhook(req, res) {
    try {
      const { type, data } = req.body;
  
      if (type === 'payment') {
        const paymentInstance = new mercadopago.Payment(client);
        const paymentInfo = await paymentInstance.get({ id: data.id });
        const { external_reference, status } = paymentInfo;
  
        console.log('DEBUG: Webhook recibido:', { external_reference, status });
  
        if (external_reference.startsWith('purchase_')) {
          // Buscar la compra pendiente en Firestore
          const pendingPurchaseRef = db.collection('pending_purchases').doc(external_reference);
          const pendingPurchaseDoc = await pendingPurchaseRef.get();
  
          if (!pendingPurchaseDoc.exists) {
            console.error('Compra pendiente no encontrada:', external_reference);
            return res.status(404).json({ error: 'Compra pendiente no encontrada' });
          }
  
          const pendingPurchaseData = pendingPurchaseDoc.data();
  
          if (status === 'approved') {
            // Actualizar stock
            for (const prod of pendingPurchaseData.products) {
              const productRef = db.collection('products').doc(prod.productId);
              const productDoc = await productRef.get();
  
              if (!productDoc.exists) continue;
  
              const productData = productDoc.data();
              if (typeof productData.stock === 'number') {
                if (productData.stock < prod.quantity) {
                  await db.collection('failed_purchases').add({
                    reason: 'Stock insuficiente en webhook',
                    ...prod,
                    buyerId: pendingPurchaseData.buyerId,
                    paymentId: paymentInfo.id,
                    createdAt: new Date()
                  });
                  continue;
                }
  
                await productRef.update({ stock: productData.stock - prod.quantity });
              }
            }
  
            // Guardar la compra finalizada
            await db.collection('purchases').add({
              buyerId: pendingPurchaseData.buyerId,
              buyerEmail: pendingPurchaseData.buyerEmail,
              products: pendingPurchaseData.products,
              paymentId: paymentInfo.id,
              status: paymentInfo.status,
              totalAmount: pendingPurchaseData.totalAmount,
              paidToSellers: false,
              createdAt: new Date()
            });
  
            // Eliminar la compra pendiente
            await pendingPurchaseRef.delete();
  
            console.log('DEBUG: Compra procesada exitosamente:', external_reference);
          } else if (status === 'rejected' || status === 'cancelled') {
            // Eliminar la compra pendiente si fue rechazada o cancelada
            await pendingPurchaseRef.delete();
            console.log('DEBUG: Compra rechazada/cancelada eliminada:', external_reference);
          }
        } else if (external_reference.startsWith('subscription_')) {
          await MercadoPagoController.handleSubscriptionPayment(external_reference, status, paymentInfo);
        }
      }
  
      res.json({ received: true });
    } catch (error) {
      console.error('❌ ERROR webhook:', error);
      res.status(500).json({ error: 'Error procesando notificación' });
    }
  }
  

  static async handleSubscriptionPayment(externalReference, status, paymentInfo) {
    const [, userId, planType] = externalReference.split('_');
    console.log('Webhook recibido para suscripción:', { externalReference, status, paymentInfo });
    if (status === 'approved') {
      // Crear suscripción
      await Subscription.create({
        userId,
        planType,
        paymentId: paymentInfo.id,
        autoRenew: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      });

      // Actualizar rol de usuario a seller
      const userRef = db.collection('users').doc(userId);
      await userRef.set({
        role: 'seller',
        isSubscribed: true, 
        subscription: {
          status: 'active',
          plan: planType,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lastPaymentDate: new Date(),
          paymentId: paymentInfo.id
        },
        updatedAt: new Date()
      }, { merge: true });

      // Registrar transacción
      await db.collection('transactions').add({
        userId,
        amount: paymentInfo.transaction_amount,
        status: paymentInfo.status,
        paymentId: paymentInfo.id,
        planType,
        createdAt: new Date()
      });
    }
  }

  // static async handleProductPayment(externalReference, status, paymentInfo) {
  //   const [, vendedorId, productId, buyerId] = externalReference.split('_');
  
  //   try {
  //     // Obtener token del vendedor
  //     const accessToken = await Vendedor.verifyAndRefreshToken(vendedorId);
  //     const mpConfig = new mercadopago.MercadoPagoConfig({ accessToken });
  //     const paymentInstance = new mercadopago.Payment(mpConfig);
  
  //     // Obtener detalles del pago desde cuenta del vendedor
  //     const paymentDetails = await paymentInstance.get({ id: paymentInfo.id });
  
  //     // En entorno sandbox, a veces application_fee está solo en paymentInfo (webhook)
  //     const commission = paymentDetails.application_fee || paymentInfo.application_fee || null;
  
  //     await db.collection('purchases').add({
  //       vendedorId,
  //       productId,
  //       buyerId,
  //       amount: paymentDetails.transaction_amount,
  //       status: paymentDetails.status,
  //       paymentId: paymentDetails.id,
  //       ...(commission !== null && { commission }),
  //       createdAt: new Date()
  //     });
  
  //     console.log(`✔️ Transacción registrada. Pago ${paymentDetails.id}, buyerId: ${buyerId}, comisión: ${commission}`);
  //   } catch (error) {
  //     console.error('❌ Error en handleProductPayment:', error);
  //   }
  // }
  

}

module.exports = MercadoPagoController; 
module.exports = MercadoPagoController; 