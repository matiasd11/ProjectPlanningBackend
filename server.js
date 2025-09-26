const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar modelos y servicios
const { syncDatabase } = require('./models');
const bonitaRoutes = require('./routes/bonita');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de seguridad
app.use(helmet());

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // límite de requests por ventana de tiempo
  message: {
    error: 'Demasiadas requests desde esta IP, prueba de nuevo más tarde.'
  }
});
app.use(globalLimiter);

// Configuración de CORS
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Middleware para parsear JSON y cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/bonita', bonitaRoutes);
app.use('/api/projects', projectRoutes);

// Ruta de healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Bonita Express Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Ruta por defecto
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bonita Express Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      bonita: '/api/bonita',
      health: '/health'
    }
  });
});

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist`
  });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Bonita Server: ${process.env.BONITA_SERVER_URL}`);
  
  // Inicializar base de datos
  console.log('🔄 Connecting to database...');
  const dbConnected = await syncDatabase();
  if (dbConnected) {
    console.log('✅ Database ready!');
  } else {
    console.log('❌ Database connection failed!');
  }
});

module.exports = app;