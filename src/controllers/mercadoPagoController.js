const mercadopago = require('mercadopago');
const axios = require('axios');
const Vendedor = require('../models/vendedor');
const Subscription = require('../models/subscription');
const { db } = require('../firebase');

// Instancia global de configuración para operaciones generales (como suscripciones)
const mpSub = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

class MercadoPagoController {
  // Maneja el callback de OAuth
  static async handleOAuthCallback(req, res) {
    // Log de depuración para ver si la petición llega y con qué datos
    console.log('--- OAuth Callback ---');
    console.log('Método:', req.method);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    try {
      const { code, userId } = req.body;
      
      if (!code || !userId) {
        return res.status(400).json({ error: 'Código de autorización y userId son requeridos' });
      }

      const response = await axios.post('https://api.mercadopago.com/oauth/token', {
        client_secret: process.env.MP_CLIENT_SECRET,
        client_id: process.env.MP_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.MP_REDIRECT_URI
      });

      await Vendedor.updateMercadoPagoCredentials(userId, response.data);

      res.json({ success: true });
    } catch (error) {
      console.error('Error en OAuth callback:', error);
      res.status(500).json({ error: 'Error procesando autorización' });
    }
  }

  // Obtiene el estado de conexión
  static async getConnectionStatus(req, res) {
    try {
      const { userId } = req.params;
      const vendedor = await Vendedor.getByUserId(userId);

      if (!vendedor || !vendedor.mercadoPagoAccessToken) {
        return res.json({ connected: false });
      }

      const tokenExpiration = new Date(vendedor.tokenExpirationDate);
      const isExpired = tokenExpiration < new Date();

      res.json({
        connected: true,
        tokenExpired: isExpired,
        userId: vendedor.mercadoPagoUserId
      });
    } catch (error) {
      console.error('Error obteniendo estado de conexión:', error);
      res.status(500).json({ error: 'Error obteniendo estado de conexión' });
    }
  }

  // Desconecta la cuenta de Mercado Pago
  static async disconnect(req, res) {
    try {
      const { userId } = req.params;
      await Vendedor.disconnectMercadoPago(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error desconectando cuenta:', error);
      res.status(500).json({ error: 'Error desconectando cuenta' });
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

  // Pagos de productos
  static async createProductPreference(req, res) {
    try {
      const { productId, quantity, vendedorId } = req.body;

      // Validar producto
      const productDoc = await db.collection('products').doc(productId).get();
      if (!productDoc.exists) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      const productData = productDoc.data();
      if (productData.sellerId !== vendedorId) {
        return res.status(403).json({ error: 'El producto no pertenece a este vendedor' });
      }
      if (productData.isService !== false && productData.isService !== true) {
        return res.status(400).json({ error: 'El producto no tiene el campo isService definido correctamente' });
      }
      if (productData.disponible === false) {
        return res.status(400).json({ error: 'El producto no está disponible' });
      }

      // Obtener vendedor y verificar conexión MP
      const vendedor = await Vendedor.getByUserId(vendedorId);
      if (!vendedor || !vendedor.mercadopagoConnected) {
        return res.status(400).json({ error: 'Vendedor no conectado a MercadoPago' });
      }

      // Verificar suscripción activa
      const hasActiveSubscription = await Subscription.verifyActive(vendedorId);
      if (!hasActiveSubscription) {
        return res.status(403).json({ error: 'Suscripción inactiva' });
      }

      // Obtener y verificar token
      const accessToken = await Vendedor.verifyAndRefreshToken(vendedorId);
      
      // Crear preferencia con el token del vendedor
      const mpConfig = new mercadopago.MercadoPagoConfig({ accessToken });
      const preference = new mercadopago.Preference(mpConfig);

      const result = await preference.create({
        body: {
          items: [{
            id: productId,
            title: productData.name,
            quantity: quantity,
            unit_price: productData.price,
            currency_id: "ARS"
          }],
          notification_url: `${process.env.BASE_URL}/api/mercadopago/webhooks`,
          external_reference: `product_${vendedorId}_${productId}`,
          application_fee: productData.price * 0.12 // 12% de comisión
        }
      });

      res.json(result);
    } catch (error) {
      console.error('Error creando preferencia de producto:', error);
      res.status(500).json({ error: 'Error creando preferencia' });
    }
  }

  // Webhooks
  static async handleWebhook(req, res) {
    try {
      const { type, data } = req.body;
      if (type === 'payment') {
        // Instanciar Payment correctamente con la instancia global
        const paymentInstance = new mercadopago.Payment(mpSub);
        const paymentInfo = await paymentInstance.get({ id: data.id });
        const { external_reference, status, transaction_amount } = paymentInfo;

        // Determinar tipo de pago
        if (external_reference.startsWith('subscription_')) {
          await MercadoPagoController.handleSubscriptionPayment(external_reference, status, paymentInfo);
        } else if (external_reference.startsWith('product_')) {
          await MercadoPagoController.handleProductPayment(external_reference, status, paymentInfo);
        }
      }
      res.json({ received: true });
    } catch (error) {
      console.error('Error procesando webhook:', error);
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
        type: 'subscription',
        userId,
        amount: paymentInfo.transaction_amount,
        status: paymentInfo.status,
        paymentId: paymentInfo.id,
        planType,
        createdAt: new Date()
      });
    }
  }

  static async handleProductPayment(externalReference, status, paymentInfo) {
    const [, vendedorId, productId] = externalReference.split('_');

    await db.collection('transactions').add({
      type: 'sale',
      vendedorId,
      productId,
      amount: paymentInfo.transaction_amount,
      status: paymentInfo.status,
      paymentId: paymentInfo.id,
      commission: paymentInfo.marketplace_fee,
      createdAt: new Date()
    });
  }

  // Renueva tokens expirados
  static async refreshToken(userId) {
    const vendedor = await Vendedor.getByUserId(userId);
    if (!vendedor || !vendedor.mercadopago?.refresh_token) {
      throw new Error('No hay refresh token disponible');
    }

    const response = await axios.post('https://api.mercadopago.com/oauth/token', {
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: vendedor.mercadopago.refresh_token
    });

    await Vendedor.updateMercadoPagoCredentials(userId, response.data);
    return response.data.access_token;
  }


    // Devuelve la URL de autorización de MercadoPago
    static async getOAuthUrl(req, res) {
      try {
        // Puedes obtener el userId del token si lo necesitas: req.user.uid
        const clientId = process.env.MP_CLIENT_ID;
        const redirectUri = process.env.MP_REDIRECT_URI;
        const baseUrl = "https://auth.mercadopago.com/authorization";
        const responseType = "code";
        const state = req.user.uid; // Opcional: para identificar al usuario
  
        const authUrl = `${baseUrl}?client_id=${clientId}&response_type=${responseType}&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  
        res.json({ authUrl });
      } catch (error) {
        console.error('Error generando URL de autorización:', error);
        res.status(500).json({ error: 'Error generando URL de autorización' });
      }
    }
  
}

module.exports = MercadoPagoController; 