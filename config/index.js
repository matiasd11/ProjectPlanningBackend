// Configuración del servidor
const config = {
  // Servidor Express
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost',
    environment: process.env.NODE_ENV || 'development'
  },
  
  // Configuración de Bonita
  bonita: {
    serverUrl: process.env.BONITA_SERVER_URL || 'http://localhost:8080',
    apiPath: '/bonita/API',
    loginPath: '/bonita/loginservice',
    logoutPath: '/bonita/logoutservice',
    defaultUsername: process.env.BONITA_USERNAME || 'install',
    defaultPassword: process.env.BONITA_PASSWORD || 'install',
    timeout: parseInt(process.env.BONITA_TIMEOUT) || 30000
  },
  
  // Configuración de CORS
  cors: {
    origins: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : 
      ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    credentials: true,
    optionsSuccessStatus: 200
  },
  
  // Configuración de seguridad
  security: {
    helmet: {
      enabled: process.env.HELMET_ENABLED !== 'false',
      contentSecurityPolicy: process.env.NODE_ENV === 'production'
    },
    rateLimiting: {
      enabled: process.env.RATE_LIMITING_ENABLED === 'true',
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100 // límite de requests por ventana de tiempo
    }
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    morgan: {
      enabled: process.env.NODE_ENV === 'development',
      format: process.env.MORGAN_FORMAT || 'dev'
    }
  },
  
  // Configuración de sesiones
  session: {
    cookieMaxAge: 24 * 60 * 60 * 1000, // 24 horas
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
};

module.exports = config;