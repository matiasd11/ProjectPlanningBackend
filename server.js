const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const jwt = require('jsonwebtoken');
const { secret } = require('./config/jwt');

// Importar modelos y base de datos
const { syncDatabase, seedData } = require('./models');

// Importar rutas
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const taskTypeRoutes = require('./routes/taskTypes');
const bonitaRoutes = require('./routes/bonita');

const app = express();
const PORT = process.env.NODE_DOCKER_PORT || process.env.PORT || 5000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Middlewares de seguridad
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Demasiadas requests, intenta en 15 minutos' }
});
app.use(limiter);

// CORS - Allow all origins for development
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Project Planning Backend está funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'MySQL + Sequelize',
    bonita: 'Integrado'
  });
});

app.use((req, res, next) => {
  console.log('Body recibido:', req.body);
  next();
});

// RUTAS API v1
const apiRouter = express.Router();

// Montar rutas en el router de API
apiRouter.use('/users', userRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/task-types', taskTypeRoutes);
apiRouter.use('/bonita', bonitaRoutes);

// Montar el router de API con versión
app.use(`/api/${API_VERSION}`, apiRouter);

// Error Handler Global
app.use((error, req, res, next) => {
  console.error('Global Error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// INICIAR SERVIDOR
const startServer = async () => {
  try {
    console.log('Iniciando servidor...');

    // Sincronizar base de datos con modificado a 'alter' para no modificar datos existentes
    const dbSynced = await syncDatabase({ alter: true });
    if (!dbSynced) {
      throw new Error('No se pudo sincronizar la base de datos');
    }

    // Crear datos de prueba (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('Creando datos de prueba...');
      await seedData();
    }

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`API disponible en: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log('Endpoints disponibles:');
      console.log('  Usuarios:');
      console.log(`    - GET  /api/${API_VERSION}/users`);
      console.log(`    - POST /api/${API_VERSION}/users`);
      console.log('  Proyectos:');
      console.log(`    - GET  /api/${API_VERSION}/projects`);
      console.log(`    - POST /api/${API_VERSION}/projects`);
      console.log(`    - POST /api/${API_VERSION}/projects/submit-to-bonita`);
      console.log(`    - GET  /api/${API_VERSION}/projects/:id`);
      console.log('  Tareas:');
      console.log(`    - PUT  /api/${API_VERSION}/tasks/:taskId/take`);
      console.log(`    - POST /api/${API_VERSION}/tasks/coverage-request`);
      console.log(`    - POST /api/${API_VERSION}/tasks/local`);
      console.log(`    - GET  /api/${API_VERSION}/tasks/coverage-request/:caseId/status`);
      console.log('  Bonita BPM:');
      console.log(`    - GET  /api/${API_VERSION}/bonita/tasks/:userId`);
      console.log(`    - POST /api/${API_VERSION}/bonita/tasks/:taskId/complete`);
    });
  } catch (error) {
    console.error('Error iniciando servidor:', error.message);
    process.exit(1);
  }
};

// Manejar cierre graceful
const gracefulShutdown = () => {
  console.log('Iniciando cierre graceful...');
  process.exit(0);
};

process.on('SIGTERM', () => {
  console.log('Cerrando servidor...');
  gracefulShutdown();
});

process.on('SIGINT', () => {
  console.log('Cerrando servidor...');
  gracefulShutdown();
});

// Iniciar
startServer();

module.exports = app;