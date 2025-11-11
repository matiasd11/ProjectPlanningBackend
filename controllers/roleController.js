const { models } = require('../models');
const bonitaService = require('../services/bonitaService');


const roleController = {

  getAllRoles: async (req, res) => {
    try {
      // Obtener roles de Bonita
      const roles = await bonitaService.getAllRoles();

      res.json({
        success: true,
        message: 'Roles obtenidos exitosamente',
        data: roles
      });
    } catch (error) {
      console.error('Error obteniendo roles:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo roles',
        error: error.message
      });
    }
  },

  getRolesByUsername: async (req, res) => {
    try {
      // Obtener roles de Bonita
      const roles = await bonitaService.getRolesByUsername(req.body.username);

      res.json({
        success: true,
        message: 'Roles obtenidos exitosamente',
        data: roles
      });
    } catch (error) {
      console.error('Error obteniendo roles:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo roles',
        error: error.message
      });
    }
  },

};

module.exports = roleController;

