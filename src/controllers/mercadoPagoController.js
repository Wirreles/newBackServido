const mercadopago = require('mercadopago');
const axios = require('axios');
const Vendedor = require('../models/vendedor');
const Subscription = require('../models/subscription');
const { db } = require('../firebase');

// Configuración simplificada del SDK de MercadoPago
const client = new mercadopago.MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN 
});

// Instancia global de configuración para suscripciones
const mpSub = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN_SUB });

class MercadoPagoController {
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
      console.log('DEBUG: Body recibido:', req.body);
      const { products, buyerId, buyerEmail } = req.body;

      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'El array de productos es inválido o está vacío' });
      }

      if (!buyerId || !buyerEmail) {
        return res.status(400).json({ error: 'Faltan buyerId o buyerEmail' });
      }

      const validatedProducts = [];
      let totalAmount = 0;

      // Validar cada producto
      for (const [i, product] of products.entries()) {
        const { productId, quantity } = product;

        if (!productId || typeof productId !== 'string' || !quantity || typeof quantity !== 'number' || quantity <= 0) {
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

      console.log('DEBUG: Productos validados:', validatedProducts);

      // Generar ID único para la compra
      const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Crear preferencia usando la configuración simplificada
      const preference = new mercadopago.Preference(client);

      const result = await preference.create({
        body: {
          items: validatedProducts.map(product => ({
            id: product.productId,
            title: product.name,
            quantity: product.quantity,
            unit_price: parseFloat(product.price),
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
      });

      // Guardar la compra pendiente en Firestore
      await db.collection('pending_purchases').doc(purchaseId).set({
        buyerId,
        buyerEmail,
        products: validatedProducts,
        totalAmount,
        status: 'pending',
        createdAt: new Date(),
        preferenceId: result.id
      });

      console.log('DEBUG: Preferencia creada exitosamente:', result.id);
      res.json(result);

    } catch (error) {
      console.error('ERROR: Error creando preferencia centralizada:', error);
      res.status(500).json({ error: 'Error creando preferencia', details: error.message });
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