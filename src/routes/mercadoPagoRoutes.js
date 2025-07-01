const express = require('express');
const MercadoPagoController = require('../controllers/mercadoPagoController');
const { authenticateToken, isVendedor } = require('../middleware/auth');

const router = express.Router();

// Rutas públicas
router.post('/webhooks', MercadoPagoController.handleWebhook);

// Rutas protegidas - requieren autenticación
router.use(authenticateToken);

// Rutas de OAuth y conexión de cuenta
router.get('/oauth-url', MercadoPagoController.getOAuthUrl);
router.post('/oauth-callback', MercadoPagoController.handleOAuthCallback);
router.get('/connection-status/:userId', MercadoPagoController.getConnectionStatus);
router.post('/disconnect/:userId', isVendedor, MercadoPagoController.disconnect);

// Rutas de suscripción
router.post('/subscription/create', MercadoPagoController.createSubscriptionPreference);

// Rutas de pagos - requieren ser vendedor
router.use('/payments', isVendedor);
router.post('/payments/create-preference', MercadoPagoController.createProductPreference);

module.exports = router; 