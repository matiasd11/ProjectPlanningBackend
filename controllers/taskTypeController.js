const { models } = require('../models');

const taskTypeController = {

  getAllTaskTypes: async (req, res) => {
    try {
      // Obtener todos los tipos de tarea de la base de datos
      const taskTypes = await models.TaskType.findAll({
        order: [['title', 'ASC']]
      });

      res.json(taskTypes);
      
    } catch (error) {
      console.error('Error obteniendo tipos de tarea:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo tipos de tarea',
        error: error.message
      });
    }
  },

};

module.exports = taskTypeController;

