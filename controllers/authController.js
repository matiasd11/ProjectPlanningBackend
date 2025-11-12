const { generateToken } = require('../middleware/auth');
const bonitaService = require('../services/bonitaService');

const authController = {
  
  // Autenticación de usuario
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      // Validación básica
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username y password son requeridos'
        });
      }

      // Verificar si el usuario existe en Bonita
      const sessionData = await bonitaService.login(username, password);

      if (!sessionData || !sessionData.session_id) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Generar token con información del usuario
      const tokenPayload = {
        username: sessionData.user.userName,
        userId: sessionData.user.id,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = generateToken(tokenPayload, '24h');

      res.json({
        success: true,
        message: 'Autenticación exitosa',
        data: {
          token,
          user: sessionData.user,
        }
      });

    } catch (error) {
      console.error('Error en autenticación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

}

module.exports = authController;
