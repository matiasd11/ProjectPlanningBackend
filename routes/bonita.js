const express = require('express');
const { models } = require('../models');
const { User, Commitment } = models;
const bonitaService = require('../services/bonitaService');

const router = express.Router();

// POST - Completar una tarea específica con variables
router.post('/task/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { variables = {} } = req.body;
    
    console.log(`Completando tarea ${taskId} con variables específicas`);
    
    const result = await bonitaService.completeTask(taskId, variables);
    
    res.json({
      success: true,
      message: 'Tarea completada exitosamente con variables específicas',
      data: {
        taskId,
        result
      }
    });
  } catch (error) {
    console.error('Error completando tarea con variables:', error);
    res.status(500).json({
      success: false,
      message: 'Error completando tarea con variables',
      error: error.message
    });
  }
});

// GET - Obtener información de un caso específico
router.get('/case/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    console.log(`Obteniendo información del caso: ${caseId}`);

    // Obtener información del caso
    const caseInfo = await bonitaService.getCaseById(caseId);

    // Obtener tareas del caso
    const tasks = await bonitaService.getAllTasksForCase(caseId);

    // Obtener variables del caso
    const variables = await bonitaService.getCaseVariables(caseId);

    // Formatear variables para mejor legibilidad
    const formattedVariables = {};
    variables.forEach(variable => {
      formattedVariables[variable.name] = {
        value: variable.value,
        type: variable.type,
        description: variable.description || ''
      };
    });

    // Preparar resumen
    const summary = {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.state === 'ready').length,
      completedTasks: tasks.filter(t => t.state === 'completed').length,
      variablesCount: variables.length,
      lastUpdate: caseInfo.last_update_date
    };

    res.json({
      success: true,
      data: {
        caseId: caseId,
        tasks: tasks,
        variables: formattedVariables,
        summary: summary
      }
    });

  } catch (error) {
    console.error('Error obteniendo información del caso:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información del caso de Bonita',
      error: error.message
    });
  }
});

// GET - Obtener todas las tareas pendientes
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await bonitaService.getAllPendingTasks();
    
    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tareas',
      error: error.message
    });
  }
});

// GET - Obtener tareas de un caso específico
router.get('/case/:caseId/tasks', async (req, res) => {
  try {
    const { caseId } = req.params;
    console.log(`Obteniendo tareas del caso: ${caseId}`);
    
    const tasks = await bonitaService.getAllTasksForCase(caseId);
    
    res.json({
      success: true,
      data: tasks,
      count: tasks.length,
      caseId: caseId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tareas del caso',
      error: error.message
    });
  }
});

// GET - Obtener variables de un caso específico  
router.get('/case/:caseId/variables', async (req, res) => {
  try {
    const { caseId } = req.params;
    console.log(`Obteniendo variables del caso: ${caseId}`);    res.json({
      success: true,
      data: caseInfo
    });
  } catch (error) {
    console.error('Error obteniendo información del caso:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información del caso',
      error: error.message
    });
  }
});

// GET - Obtener solo las tareas de un caso
router.get('/case/:caseId/tasks', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    console.log(`Obteniendo tareas del caso: ${caseId}`);
    
    const tasks = await bonitaService.getAllTasksForCase(caseId);
    
    res.json({
      success: true,
      caseId,
      tasks: tasks.map(task => ({
        id: task.id,
        name: task.name,
        state: task.state,
        type: task.type,
        assigned_id: task.assigned_id,
        priority: task.priority,
        dueDate: task.dueDate
      })),
      count: tasks.length
    });
  } catch (error) {
    console.error('Error obteniendo tareas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tareas',
      error: error.message
    });
  }
});

// GET - Obtener solo las variables de un caso
router.get('/case/:caseId/variables', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    console.log(`Obteniendo variables del caso: ${caseId}`);
    
    const variables = await bonitaService.getCaseVariables(caseId);
    
    res.json({
      success: true,
      caseId,
      variables: variables.reduce((acc, variable) => {
        acc[variable.name] = {
          value: variable.value,
          type: variable.type,
          description: variable.description
        };
        return acc;
      }, {}),
      variablesList: variables,
      count: variables.length
    });
  } catch (error) {
    console.error('Error obteniendo variables:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo variables',
      error: error.message
    });
  }
});

// POST - Test auto-completion for a specific case
router.post('/auto-complete/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    console.log('🔨 Testing auto-completion for case:', caseId);
    
    // Get tasks for this case
    const tasks = await bonitaService.getAllTasksForCase(caseId);
    console.log('📋 Tasks found:', tasks.map(t => ({ name: t.name, id: t.id, state: t.state })));
    
    if (tasks.length > 0) {
      const taskToComplete = tasks.find(t => t.state === 'ready') || tasks[0];
      console.log(`⚡ Attempting to complete: ${taskToComplete.name} (ID: ${taskToComplete.id})`);
      
      const result = await bonitaService.completeTaskById(taskToComplete.id);
      
      // Check final state
      await new Promise(resolve => setTimeout(resolve, 1000));
      const finalTasks = await bonitaService.getAllTasksForCase(caseId);
      
      res.json({
        success: true,
        message: 'Auto-completion test completed',
        data: {
          caseId,
          completedTask: { id: taskToComplete.id, name: taskToComplete.name },
          initialTasks: tasks.map(t => ({ name: t.name, state: t.state })),
          finalTasks: finalTasks.map(t => ({ name: t.name, state: t.state }))
        }
      });
    } else {
      res.json({
        success: false,
        message: 'No tasks found for auto-completion',
        data: { caseId, tasks: [] }
      });
    }
    
  } catch (error) {
    console.error('Error in auto-completion test:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing auto-completion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

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