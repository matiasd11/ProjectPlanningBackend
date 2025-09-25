const bonitaService = require('../services/bonitaService');

// Middleware para requerir autenticación
const requireAuth = async (req, res, next) => {
  try {
    // Extraer cookies de la request
    const sessionCookies = extractSessionCookies(req);
    
    if (sessionCookies.length === 0) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No session cookies found' 
      });
    }

    const session = { cookies: sessionCookies };
    
    // Validar la sesión con Bonita
    const isValid = await bonitaService.validateSession(session);
    
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid or expired session' 
      });
    }

    // Agregar la sesión al objeto request para uso en las rutas
    req.session = session;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

// Middleware opcional de autenticación (no bloquea si no está autenticado)
const optionalAuth = async (req, res, next) => {
  try {
    const sessionCookies = extractSessionCookies(req);
    
    if (sessionCookies.length > 0) {
      const session = { cookies: sessionCookies };
      const isValid = await bonitaService.validateSession(session);
      
      if (isValid) {
        req.session = session;
        req.isAuthenticated = true;
      } else {
        req.isAuthenticated = false;
      }
    } else {
      req.isAuthenticated = false;
    }
    
    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    req.isAuthenticated = false;
    next();
  }
};

// Función helper para extraer cookies de sesión
function extractSessionCookies(req) {
  const cookies = [];
  
  if (req.cookies) {
    Object.keys(req.cookies).forEach(name => {
      cookies.push({
        name,
        value: req.cookies[name]
      });
    });
  }
  
  return cookies;
}

module.exports = {
  requireAuth,
  optionalAuth,
  extractSessionCookies
};