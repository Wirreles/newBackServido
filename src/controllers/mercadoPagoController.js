const mercadopago = require('mercadopago');
const axios = require('axios');
const Vendedor = require('../models/vendedor');
const Subscription = require('../models/subscription');
const { db } = require('../firebase');

// Configuración del SDK de MercadoPago
let client;
let mpSub;

try {
  // Configuración para pagos normales (productos)
  client = new mercadopago.MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
  });
  
  // Configuración para suscripciones (proyecto diferente)
  mpSub = new mercadopago.MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN_SUB 
  });
  
  console.log('DEBUG: Configuración de MercadoPago inicializada correctamente');
  console.log('DEBUG: Token principal configurado:', !!process.env.MP_ACCESS_TOKEN);
  console.log('DEBUG: Token suscripciones configurado:', !!process.env.MP_ACCESS_TOKEN_SUB);
  console.log('DEBUG: Primeros 10 caracteres token principal:', process.env.MP_ACCESS_TOKEN.substring(0, 10) + '...');
  console.log('DEBUG: Primeros 10 caracteres token suscripciones:', process.env.MP_ACCESS_TOKEN_SUB.substring(0, 10) + '...');
} catch (error) {
  console.error('ERROR: Error inicializando configuración de MercadoPago:', error);
}

class MercadoPagoController {
  // Función para probar conexión directa con MercadoPago (sin SDK)
  static async testDirectConnection(req, res) {
    try {
      console.log('=== PRUEBA DE CONEXIÓN DIRECTA CON MERCADOPAGO ===');
      
      if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
      }

      console.log('DEBUG: Token configurado:', !!process.env.MP_ACCESS_TOKEN);
      console.log('DEBUG: Primeros 10 caracteres:', process.env.MP_ACCESS_TOKEN.substring(0, 10) + '...');
      console.log('DEBUG: Longitud del token:', process.env.MP_ACCESS_TOKEN.length);

      // Verificar formato del token
      const tokenPattern = /^APP_USR-[a-zA-Z0-9-]+$/;
      const isValidFormat = tokenPattern.test(process.env.MP_ACCESS_TOKEN);
      console.log('DEBUG: Formato de token válido:', isValidFormat);

      // Probar diferentes endpoints de MercadoPago
      const tests = [];

      // Test 1: Endpoint básico de MercadoPago
      try {
        console.log('DEBUG: Test 1 - Endpoint básico...');
        const response1 = await fetch('https://api.mercadopago.com', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Servido-Direct-Test/1.0'
          }
        });

        tests.push({
          name: 'Endpoint básico',
          url: 'https://api.mercadopago.com',
          status: response1.status,
          statusText: response1.statusText,
          success: response1.ok,
          headers: Object.fromEntries(response1.headers.entries())
        });

        console.log('DEBUG: Test 1 resultado:', tests[tests.length - 1]);
      } catch (error) {
        tests.push({
          name: 'Endpoint básico',
          error: error.message
        });
      }

      // Test 2: Endpoint de preferencias (el que falla)
      try {
        console.log('DEBUG: Test 2 - Endpoint de preferencias...');
        
        const testData = {
          items: [{
            id: 'direct_test_item',
            title: 'Prueba Directa',
            quantity: 1,
            unit_price: 1.00,
            currency_id: "ARS"
          }],
          external_reference: 'direct_test_' + Date.now()
        };

        const response2 = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Servido-Direct-Test/1.0'
          },
          body: JSON.stringify(testData)
        });

        const responseData = {
          name: 'Endpoint de preferencias',
          url: 'https://api.mercadopago.com/checkout/preferences',
          status: response2.status,
          statusText: response2.statusText,
          success: response2.ok,
          headers: Object.fromEntries(response2.headers.entries())
        };

        if (response2.ok) {
          const result = await response2.json();
          responseData.result = result;
          console.log('DEBUG: Preferencia creada exitosamente:', result.id);
        } else {
          try {
            const errorText = await response2.text();
            responseData.errorBody = errorText;
            console.log('DEBUG: Error response:', errorText);
          } catch (e) {
            responseData.errorBody = 'No se pudo leer error response';
          }
        }

        tests.push(responseData);
        console.log('DEBUG: Test 2 resultado:', tests[tests.length - 1]);

      } catch (error) {
        tests.push({
          name: 'Endpoint de preferencias',
          error: error.message,
          type: error.type || 'unknown'
        });
        console.log('DEBUG: Test 2 error:', error.message);
      }

      // Test 3: Verificar si es problema de red
      try {
        console.log('DEBUG: Test 3 - Conectividad básica...');
        const response3 = await fetch('https://api.mercadopago.com', {
          method: 'GET',
          headers: {
            'User-Agent': 'Servido-Connectivity-Test/1.0'
          }
        });

        tests.push({
          name: 'Conectividad básica',
          url: 'https://api.mercadopago.com',
          status: response3.status,
          statusText: response3.statusText,
          success: response3.ok
        });

      } catch (error) {
        tests.push({
          name: 'Conectividad básica',
          error: error.message
        });
      }

      // Análisis de resultados
      const analysis = {
        tokenValid: isValidFormat,
        hasConnectivity: tests.some(t => t.name === 'Conectividad básica' && t.success),
        basicEndpointWorks: tests.some(t => t.name === 'Endpoint básico' && t.success),
        preferencesEndpointWorks: tests.some(t => t.name === 'Endpoint de preferencias' && t.success)
      };

      console.log('DEBUG: Análisis final:', analysis);

      res.json({
        success: analysis.preferencesEndpointWorks,
        tokenInfo: {
          configured: !!process.env.MP_ACCESS_TOKEN,
          length: process.env.MP_ACCESS_TOKEN.length,
          format: isValidFormat,
          isSandbox: process.env.MP_ACCESS_TOKEN.includes('TEST')
        },
        tests: tests,
        analysis: analysis,
        recommendations: []
      });

    } catch (error) {
      console.error('ERROR: Error en prueba directa:', error);
      res.status(500).json({ 
        error: 'Error en prueba directa', 
        details: error.message 
      });
    }
  }

  // Función para diagnosticar configuración completa del sistema
  static async diagnoseConfiguration(req, res) {
    try {
      console.log('=== DIAGNÓSTICO COMPLETO DEL SISTEMA ===');
      console.log('DEBUG: Timestamp:', new Date().toISOString());
      
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

      // Prueba básica de MercadoPago
      let mercadopagoTest = {
        status: 'no configurado',
        message: 'Token no configurado'
      };

      if (process.env.MP_ACCESS_TOKEN && client) {
        try {
          console.log('DEBUG: Probando conexión con MercadoPago...');
          
          // Usar el cliente principal para pagos normales
          const preference = new mercadopago.Preference(client);
          const testData = {
            body: {
              items: [{
                id: 'diagnostic_test',
                title: 'Prueba de Diagnóstico',
                quantity: 1,
                unit_price: 1.00,
                currency_id: "ARS"
              }],
              external_reference: 'diagnostic_' + Date.now()
            }
          };

          const startTime = Date.now();
          const result = await preference.create(testData);
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          mercadopagoTest = {
            status: 'success',
            message: 'Conexión exitosa con MercadoPago',
            preferenceId: result.id,
            responseTime: responseTime + 'ms'
          };

          console.log('DEBUG: Prueba de MercadoPago exitosa:', result.id);

        } catch (error) {
          console.error('ERROR: Prueba de MercadoPago falló:', error.message);
          
          mercadopagoTest = {
            status: 'error',
            message: 'Error de conexión con MercadoPago',
            error: error.message,
            type: error.type || 'unknown',
            details: 'Token expirado o sin permisos - Renovar token en MercadoPago Developers'
          };

          if (error.type === 'invalid-json') {
            issues.push('Token de MercadoPago expirado o sin permisos');
          }
        }
      } else {
        issues.push('Token de MercadoPago no configurado o cliente no inicializado');
      }

      const result = {
        success: issues.length === 0,
        config: config,
        issues: issues,
        isOriginAllowed: isOriginAllowed,
        allowedOrigins: allowedOrigins,
        mercadopagoTest: mercadopagoTest,
        recommendations: []
      };

      // Agregar recomendaciones basadas en los problemas encontrados
      if (issues.length > 0) {
        result.recommendations = issues.map(issue => {
          if (issue.includes('BASE_URL')) {
            return 'Configurar BASE_URL en Render con la URL del backend';
          } else if (issue.includes('FRONTEND_URL')) {
            return 'Configurar FRONTEND_URL en Render con https://www.servido.com.ar';
          } else if (issue.includes('Token de MercadoPago expirado')) {
            return 'Renovar token en https://www.mercadopago.com.ar/developers/panel/credentials';
          } else if (issue.includes('Origin')) {
            return 'Verificar que el dominio esté en la lista de orígenes permitidos';
          }
          return 'Revisar configuración del sistema';
        });
      }

      console.log('DEBUG: Diagnóstico completado:', JSON.stringify(result, null, 2));

      res.json(result);

    } catch (error) {
      console.error('ERROR: Error en diagnóstico:', error);
      res.status(500).json({ 
        error: 'Error en diagnóstico', 
        details: error.message 
      });
    }
  }

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

      // Crear preferencia para suscripción con el token de suscripciones
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

    const { products, buyerId, buyerEmail, shippingCost } = req.body;

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

    // Calcular envío total
    let totalShipping = 0;
    if (shippingCost !== undefined && shippingCost > 0) {
      totalShipping = shippingCost;
    }

    // Incluir envío en el total final
    const finalTotal = totalAmount + totalShipping;

    console.log('DEBUG: Cálculo de totales:', {
      subtotal: totalAmount,
      envío: totalShipping,
      totalFinal: finalTotal
    });

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
        // Agregar información de envío si hay costo
        ...(totalShipping > 0 && {
          shipments: {
            cost: totalShipping,
            mode: "not_specified"
          }
        }),
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

    // Guardar en Firestore con información de envío
    await db.collection('pending_purchases').doc(purchaseId).set({
      buyerId,
      buyerEmail,
      products: validatedProducts,
      totalAmount,
      shippingCost: totalShipping,
      finalTotal,
      status: 'pending',
      createdAt: new Date(),
      preferenceId: result.id
    });

    // Retornar respuesta con información de totales
    return res.json({
      ...result,
      totals: {
        subtotal: totalAmount,
        shipping: totalShipping,
        final: finalTotal
      }
    });

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
  
            // Guardar la compra finalizada con información de envío
            await db.collection('purchases').add({
              buyerId: pendingPurchaseData.buyerId,
              buyerEmail: pendingPurchaseData.buyerEmail,
              products: pendingPurchaseData.products,
              paymentId: paymentInfo.id,
              status: paymentInfo.status,
              totalAmount: pendingPurchaseData.totalAmount,
              shippingCost: pendingPurchaseData.shippingCost || 0,
              finalTotal: pendingPurchaseData.finalTotal || pendingPurchaseData.totalAmount,
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