const express = require('express');
const { models } = require('../models');
const { User } = models;
const bonitaService = require('../services/bonitaService');

const router = express.Router();

// GET - Tareas pendientes de Bonita para una ONG
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

// POST - Completar tarea en Bonita
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

// POST - Probar conexión con Bonita
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

// GET - Ver casos/procesos activos en Bonita
router.get('/cases', async (req, res) => {
  try {
    const cases = await bonitaService.getAllCases();
    
    res.json({
      success: true,
      data: cases,
      total: cases.length,
      message: 'Casos obtenidos de Bonita'
    });
  } catch (error) {
    console.error('Error obteniendo casos de Bonita:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET - Ver caso específico por ID
router.get('/cases/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const caseData = await bonitaService.getCaseById(caseId);
    
    res.json({
      success: true,
      data: caseData,
      message: `Caso ${caseId} obtenido de Bonita`
    });
  } catch (error) {
    console.error('Error obteniendo caso de Bonita:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET - Monitoreo completo del estado de Bonita
router.get('/status', async (req, res) => {
  try {
    // Obtener casos
    const cases = await bonitaService.getAllCases();
    
    // Obtener todas las tareas pendientes (sin filtrar por usuario)
    const allTasks = await bonitaService.getAllPendingTasks();
    
    // Obtener información del proceso
    const process = await bonitaService.getProcessDefinition();
    
    res.json({
      success: true,
      data: {
        process: {
          id: process?.id,
          name: process?.name,
          version: process?.version
        },
        cases: {
          total: cases.length,
          active: cases.filter(c => c.state === 'started').length,
          completed: cases.filter(c => c.state === 'completed').length,
          details: cases.slice(0, 3) // Últimos 3 casos
        },
        tasks: {
          total: allTasks.length,
          byState: allTasks.reduce((acc, task) => {
            acc[task.state] = (acc[task.state] || 0) + 1;
            return acc;
          }, {}),
          pending: allTasks.filter(t => t.state === 'ready').slice(0, 5) // Primeras 5 pendientes
        }
      },
      timestamp: new Date().toISOString(),
      message: 'Estado completo de Bonita BPM'
    });
  } catch (error) {
    console.error('Error obteniendo status completo:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET - Ver variables de un caso específico para debugging
router.get('/cases/:caseId/variables', async (req, res) => {
  try {
    const { caseId } = req.params;
    const variables = await bonitaService.getCaseVariables(caseId);
    
    res.json({
      success: true,
      data: variables,
      caseId: caseId,
      message: `Variables del caso ${caseId}`
    });
  } catch (error) {
    console.error('Error obteniendo variables del caso:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET - Ver contexto completo de un caso para debugging del formulario
router.get('/cases/:caseId/context', async (req, res) => {
  try {
    const { caseId } = req.params;
    const context = await bonitaService.getCaseContext(caseId);
    
    res.json({
      success: true,
      data: context,
      caseId: caseId,
      message: `Contexto completo del caso ${caseId}`
    });
  } catch (error) {
    console.error('Error obteniendo contexto del caso:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;