const express = require("express");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors"); // Importar el paquete CORS
const mercadoPagoRouter = require('../src/routes/mercadoPagoRoutes');
const app = express();

// Settings
app.set("port", process.env.PORT || 3000);
app.set("views", path.join(__dirname, "views"));

// middlewares
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configuración de CORS más segura
const allowedOrigins = [
  'https://www.servido.com.ar',
  'https://servido.com.ar',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://new-front-servido.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como aplicaciones móviles o Postman)
    if (!origin) return callback(null, true);
    
    // Verificar si el origin está en la lista de permitidos
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS bloqueado para origin:', origin);
      console.log('Orígenes permitidos:', allowedOrigins);
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200 // Para compatibilidad con algunos navegadores
}));

// Middleware de seguridad básica
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Routes
app.use('/api/mercadopago', mercadoPagoRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  console.error('ERROR: Stack:', err.stack);
  
  // Manejo específico de errores CORS
  if (err.message === 'No permitido por CORS') {
    console.error('ERROR CORS: Origin bloqueado:', req.headers.origin);
    console.error('ERROR CORS: Headers completos:', req.headers);
    return res.status(403).json({
      error: 'Error de CORS',
      message: 'El origen de la petición no está permitido',
      origin: req.headers.origin,
      allowedOrigins: allowedOrigins
    });
  }
  
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
