const mercadopago = require('mercadopago');
const axios = require('axios');
const Vendedor = require('../models/vendedor');
const Subscription = require('../models/subscription');
const { db } = require('../firebase');

// Instancia global de configuración para operaciones generales (como suscripciones)
const mpSub = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN_SUB });

// Instancia global de configuración para operaciones generales (como suscripciones)
const mp = new mercadopago.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
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

  // PAGOS DE PRODUCTOS CENTRALIZADO
// PAGOS DE PRODUCTOS CENTRALIZADO
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
        vendedorId: productData.sellerId, // Aseguramos que siempre se incluya el id del vendedor
        name: productData.name,
        price: productData.price,
        stock: productData.stock ?? null,
        paidToSeller: false // NUEVO CAMPO
      });

      totalAmount += productData.price * quantity;
    }

    console.log('DEBUG: Productos validados:', validatedProducts);

    const items = validatedProducts.map(product => ({
      id: product.productId,
      title: product.name,
      quantity: product.quantity,
      unit_price: product.price,
      currency_id: "ARS"
    }));

    const external_reference = `cart_${Buffer.from(JSON.stringify({
      buyerId,
      products: validatedProducts
    })).toString('base64')}`;

    const preference = new mercadopago.Preference(mp);

    const result = await preference.create({
      body: {
        items,
        notification_url: `${process.env.BASE_URL}/api/mercadopago/webhooks`,
        external_reference,
        payer: { email: buyerEmail },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/purchase/success`,
          failure: `${process.env.FRONTEND_URL}/purchase/failure`,
          pending: `${process.env.FRONTEND_URL}/purchase/pending`
        },
        auto_return: "approved"
      }
    });

    res.json(result);
  } catch (error) {
    console.error('ERROR: Error creando preferencia centralizada:', error);
    res.status(500).json({ error: 'Error creando preferencia', details: error.message });
  }
}


  // WEBHOOK CENTRALIZADO
  static async handleWebhook(req, res) {
    try {
      const { type, data } = req.body;
  
      if (type === 'payment') {
        const paymentInstance = new mercadopago.Payment(mp);
        const paymentInfo = await paymentInstance.get({ id: data.id });
        const { external_reference, status } = paymentInfo;
  
        if (external_reference.startsWith('cart_')) {
          const base64 = external_reference.replace('cart_', '');
          let referenceData;
          try {
            referenceData = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
          } catch (e) {
            return res.status(400).json({ error: 'Referencia inválida' });
          }
  
          if (status === 'approved') {
            // Calcular total
            const totalAmount = referenceData.products.reduce((total, product) => {
              return total + (product.price * product.quantity);
            }, 0);
  
            // Actualizar stock
            for (const prod of referenceData.products) {
              const productRef = db.collection('products').doc(prod.productId);
              const productDoc = await productRef.get();
  
              if (!productDoc.exists) continue;
  
              const productData = productDoc.data();
              if (typeof productData.stock === 'number') {
                if (productData.stock < prod.quantity) {
                  await db.collection('failed_purchases').add({
                    reason: 'Stock insuficiente en webhook',
                    ...prod,
                    buyerId: referenceData.buyerId,
                    paymentId: paymentInfo.id,
                    createdAt: new Date()
                  });
                  continue;
                }
  
                await productRef.update({ stock: productData.stock - prod.quantity });
              }
            }
  
            // Guardar la compra con el formato especificado
            await db.collection('purchases').add({
              buyerId: referenceData.buyerId,
              products: referenceData.products,
              paymentId: paymentInfo.id,
              status: paymentInfo.status,
              totalAmount: totalAmount,
              paidToSellers: false, // NUEVO CAMPO
              createdAt: new Date()
            });
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