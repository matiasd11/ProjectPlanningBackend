const bonitaService = require('../services/bonitaService');
const { validatePasswordStrength } = require('../validators/passwordValidator');

const userController = {

  // POST - Crear usuario (ONG)
  createUser: async (req, res) => {
    
    try {
      const {
        username,
        password,
        roles,
        organizationName,
      } = req.body;

      // Validar que se proporcionen roles
      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar al menos un rol para el usuario',
          errors: ['El campo roles es requerido y debe ser un array no vacío']
        });
      }

      // Validar fortaleza de contraseña
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña no cumple con los requisitos de seguridad',
          errors: passwordValidation.errors
        });
      }

      // Crear usuario en Bonita
      const bonitaUser = await bonitaService.createUser({ username, password, organizationName, roles });

      res.status(201).json({
        success: true,
        message: 'ONG registrada exitosamente',
        data: bonitaUser
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(400).json({
        success: false,
        message: 'Error creando usuario',
        error: error.message
      });
    }
  },

};

module.exports = userController;

