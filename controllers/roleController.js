const { models } = require('../models');
const { Role } = models;

const roleController = {
  
  // GET - Obtener todos los roles
  getRoles: async (req, res) => {
    try {
      const roles = await Role.findAll({
        order: [['id', 'ASC']]
      });

      res.json({
        success: true,
        message: 'Roles obtenidos exitosamente',
        data: roles,
        total: roles.length
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

