const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar modelos y base de datos
const { syncDatabase, seedData } = require('./models');

// Importar rutas
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const bonitaRoutes = require('./routes/bonita');

const app = express();
const PORT = process.env.NODE_DOCKER_PORT || process.env.PORT || 5000;

// 🔒 Middlewares de seguridad
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Demasiadas requests, intenta en 15 minutos' }
});
app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 🏥 Health check
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

// 📍 RUTAS
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/bonita', bonitaRoutes);

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
    console.log('🔄 Iniciando servidor...');
    
    // Sincronizar base de datos con force para aplicar cambios del modelo
    const dbSynced = await syncDatabase({ force: true });
    if (!dbSynced) {
      throw new Error('No se pudo sincronizar la base de datos');
    }
    
    // Crear datos de prueba (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('🌱 Creando datos de prueba...');
      await seedData();
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 API disponible en: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log('📊 Endpoints disponibles:');
      console.log('  👥 Usuarios:');
      console.log('    - GET  /api/users');
      console.log('    - POST /api/users');
      console.log('  📋 Proyectos:');
      console.log('    - GET  /api/projects');
      console.log('    - POST /api/projects');
      console.log('    - POST /api/projects/submit-to-bonita');
      console.log('    - GET  /api/projects/:id');
      console.log('  📝 Tareas:');
      console.log('    - PUT  /api/tasks/:taskId/take');
      console.log('  🚀 Bonita BPM:');
      console.log('    - GET  /api/bonita/tasks/:userId');
      console.log('    - POST /api/bonita/tasks/:taskId/complete');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
};

// Manejar cierre graceful
process.on('SIGTERM', async () => {
  console.log('🔄 Cerrando servidor...');
  const { closeConnection } = require('./models');
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Cerrando servidor...');
  const { closeConnection } = require('./models');
  await closeConnection();
  process.exit(0);
});

// Iniciar
startServer();

module.exports = app;