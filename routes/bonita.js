const express = require('express');
const { models } = require('../models');
const { User } = models;
const bonitaService = require('../services/bonitaService');

const router = express.Router();

// 📋 GET - Tareas pendientes de Bonita para una ONG
router.get('/tasks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const tasks = await bonitaService.getPendingTasks(userId);
    
    res.json({
      success: true,
      data: tasks,
      message: `Tareas pendientes para ${user.organizationName}`
    });
    
  } catch (error) {
    console.error('Error obteniendo tareas de Bonita:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tareas de Bonita'
    });
  }
});

// 📝 POST - Completar tarea en Bonita
router.post('/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { variables = {} } = req.body;
    
    const result = await bonitaService.completeTask(taskId, variables);
    
    res.json({
      success: true,
      message: 'Tarea completada en Bonita',
      data: result
    });
    
  } catch (error) {
    console.error('Error completando tarea en Bonita:', error);
    res.status(500).json({
      success: false,
      message: 'Error completando tarea en Bonita',
      error: error.message
    });
  }
});

// 🧪 POST - Probar conexión con Bonita
router.post('/test-connection', async (req, res) => {
  try {
    // Probar autenticación
    const authenticated = await bonitaService.authenticate();
    if (!authenticated) {
      return res.status(500).json({ 
        success: false,
        error: 'No se pudo autenticar con Bonita'
      });
    }

    // Probar obtener proceso
    const process = await bonitaService.getProcessDefinition();
    if (!process) {
      return res.status(500).json({ 
        success: false,
        error: 'Proceso no encontrado en Bonita'
      });
    }

    res.json({
      success: true,
      message: 'Conexión exitosa con Bonita',
      data: {
        processId: process.id,
        processName: process.name,
        version: process.version,
        bonitaConnected: true
      }
    });
  } catch (error) {
    console.error('Error testing Bonita connection:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;