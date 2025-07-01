const express = require("express");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors"); // Importar el paquete CORS
const productRouter = require('../src/routes/productRoutes');
const servicesRouter = require('../src/routes/serviceRoutes');
const userRouter = require('../src/routes/userRoutes');
const paymentRouter = require('../src/routes/paymetRoutes');
const subscriptionRouter = require('../src/routes/subscriptionRoutes');
const mercadoPagoRouter = require('../src/routes/mercadoPagoRoutes');
const app = express();

// Settings
app.set("port", process.env.PORT || 3000);
app.set("views", path.join(__dirname, "views"));

// middlewares
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configuración de CORS mejorada
app.use(cors({
  origin: '*',
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Middleware de seguridad básica
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Routes
app.use('/products', productRouter);
app.use('/services', servicesRouter);
app.use('/usuarios', userRouter);
app.use('/payments', paymentRouter);
app.use('/subscription', subscriptionRouter);
app.use('/api/mercadopago', mercadoPagoRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
