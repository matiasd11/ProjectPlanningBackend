const express = require('express');
const bonitaService = require('../services/bonitaService');

const router = express.Router();

// Login a Bonita
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    const session = await bonitaService.login(username, password);
    
    if (session.success) {
      // Guardar la sesión en el objeto request para uso posterior
      req.session = session.data;
      
      // Establecer cookies para mantener la sesión
      if (session.data.cookies) {
        session.data.cookies.forEach(cookie => {
          res.cookie(cookie.name, cookie.value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
          });
        });
      }
      
      res.json({
        success: true,
        message: 'Login successful',
        user: session.data.user
      });
    } else {
      res.status(401).json({
        error: 'Invalid credentials',
        message: session.message
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'Internal server error during login'
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    // Extraer cookies de la request
    const sessionCookies = extractSessionCookies(req);
    
    if (sessionCookies.length > 0) {
      await bonitaService.logout(sessionCookies);
    }
    
    // Limpiar cookies
    res.clearCookie('JSESSIONID');
    res.clearCookie('BOS_Locale');
    res.clearCookie('X-Bonita-API-Token');
    
    res.json({ 
      success: true, 
      message: 'Logout successful' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      message: 'Internal server error during logout'
    });
  }
});

// Verificar estado de sesión
router.get('/session', async (req, res) => {
  try {
    const sessionCookies = extractSessionCookies(req);
    
    if (sessionCookies.length === 0) {
      return res.status(401).json({ 
        authenticated: false, 
        message: 'No session found' 
      });
    }

    const session = { cookies: sessionCookies };
    const isValid = await bonitaService.validateSession(session);
    
    if (isValid) {
      const userInfo = await bonitaService.getCurrentUser(session);
      res.json({ 
        authenticated: true, 
        user: userInfo 
      });
    } else {
      res.status(401).json({ 
        authenticated: false, 
        message: 'Invalid session' 
      });
    }
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ 
      error: 'Session validation failed',
      message: 'Internal server error during session validation'
    });
  }
});

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

module.exports = router;