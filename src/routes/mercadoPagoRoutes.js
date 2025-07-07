const express = require('express');
const MercadoPagoController = require('../controllers/mercadoPagoController');
const { authenticateToken, isVendedor } = require('../middleware/auth');

const router = express.Router();

// Rutas públicas
router.post('/webhooks', MercadoPagoController.handleWebhook);
router.get('/oauth-callback', MercadoPagoController.handleOAuthCallback);

// Rutas protegidas - requieren autenticación
router.use(authenticateToken);

router.post('/payments/create-preference', MercadoPagoController.createProductPreference);
// Rutas de OAuth y conexión de cuenta
router.get('/oauth-url', MercadoPagoController.getOAuthUrl);
router.get('/connection-status/:userId', MercadoPagoController.getConnectionStatus);
router.post('/disconnect/:userId', isVendedor, MercadoPagoController.disconnect);

// Rutas de suscripción
router.use('/subscription', isVendedor);
router.post('/subscription/create', MercadoPagoController.createSubscriptionPreference);


module.exports = router; 