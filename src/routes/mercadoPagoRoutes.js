const express = require('express');
const MercadoPagoController = require('../controllers/mercadoPagoController');
const { authenticateToken, isVendedor } = require('../middleware/auth');

const router = express.Router();

// Rutas públicas
router.post('/webhooks', MercadoPagoController.handleWebhook); 
router.post('/payments/create-preference', MercadoPagoController.createProductPreference);

// Rutas protegidas - requieren autenticación
router.use(authenticateToken);

// Rutas de OAuth y conexión de cuenta
// router.get('/connection-status/:userId', MercadoPagoController.getConnectionStatus);

// Rutas de suscripción
router.use('/subscription', isVendedor);
router.post('/subscription/create', MercadoPagoController.createSubscriptionPreference);


module.exports = router; 