const express = require('express');
const bonitaService = require('../services/bonitaService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Middleware para requerir autenticación en todas las rutas de bonita
router.use(requireAuth);

// Obtener información del usuario actual
router.get('/user/info', async (req, res) => {
  try {
    const userInfo = await bonitaService.getCurrentUser(req.session);
    res.json(userInfo);
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

// Obtener procesos disponibles
router.get('/processes', async (req, res) => {
  try {
    const { p = 0, c = 10, f = '' } = req.query;
    const processes = await bonitaService.getProcesses(req.session, { p, c, f });
    res.json(processes);
  } catch (error) {
    console.error('Error getting processes:', error);
    res.status(500).json({ error: 'Failed to get processes' });
  }
});

// Obtener un proceso específico
router.get('/processes/:id', async (req, res) => {
  try {
    const process = await bonitaService.getProcess(req.session, req.params.id);
    res.json(process);
  } catch (error) {
    console.error('Error getting process:', error);
    res.status(500).json({ error: 'Failed to get process' });
  }
});

// Iniciar una nueva instancia de proceso
router.post('/processes/:id/instantiation', async (req, res) => {
  try {
    const { variables = {} } = req.body;
    const processInstance = await bonitaService.instantiateProcess(
      req.session, 
      req.params.id, 
      variables
    );
    res.json(processInstance);
  } catch (error) {
    console.error('Error instantiating process:', error);
    res.status(500).json({ error: 'Failed to instantiate process' });
  }
});

// Obtener casos (process instances)
router.get('/cases', async (req, res) => {
  try {
    const { p = 0, c = 10, f = '' } = req.query;
    const cases = await bonitaService.getCases(req.session, { p, c, f });
    res.json(cases);
  } catch (error) {
    console.error('Error getting cases:', error);
    res.status(500).json({ error: 'Failed to get cases' });
  }
});

// Obtener un caso específico
router.get('/cases/:id', async (req, res) => {
  try {
    const case_ = await bonitaService.getCase(req.session, req.params.id);
    res.json(case_);
  } catch (error) {
    console.error('Error getting case:', error);
    res.status(500).json({ error: 'Failed to get case' });
  }
});

// Obtener tareas pendientes del usuario
router.get('/tasks/pending', async (req, res) => {
  try {
    const { p = 0, c = 10, f = '' } = req.query;
    const tasks = await bonitaService.getPendingTasks(req.session, { p, c, f });
    res.json(tasks);
  } catch (error) {
    console.error('Error getting pending tasks:', error);
    res.status(500).json({ error: 'Failed to get pending tasks' });
  }
});

// Obtener tareas asignadas al usuario
router.get('/tasks/assigned', async (req, res) => {
  try {
    const { p = 0, c = 10, f = '' } = req.query;
    const tasks = await bonitaService.getAssignedTasks(req.session, { p, c, f });
    res.json(tasks);
  } catch (error) {
    console.error('Error getting assigned tasks:', error);
    res.status(500).json({ error: 'Failed to get assigned tasks' });
  }
});

// Obtener una tarea específica
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await bonitaService.getTask(req.session, req.params.id);
    res.json(task);
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// Asignar una tarea
router.put('/tasks/:id/assign', async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await bonitaService.assignTask(req.session, req.params.id, userId);
    res.json(result);
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

// Ejecutar una tarea
router.post('/tasks/:id/execution', async (req, res) => {
  try {
    const { variables = {} } = req.body;
    const result = await bonitaService.executeTask(req.session, req.params.id, variables);
    res.json(result);
  } catch (error) {
    console.error('Error executing task:', error);
    res.status(500).json({ error: 'Failed to execute task' });
  }
});

// Obtener formularios
router.get('/forms/:id', async (req, res) => {
  try {
    const form = await bonitaService.getForm(req.session, req.params.id);
    res.json(form);
  } catch (error) {
    console.error('Error getting form:', error);
    res.status(500).json({ error: 'Failed to get form' });
  }
});

// Obtener contexto de formulario
router.get('/forms/:id/context', async (req, res) => {
  try {
    const context = await bonitaService.getFormContext(req.session, req.params.id);
    res.json(context);
  } catch (error) {
    console.error('Error getting form context:', error);
    res.status(500).json({ error: 'Failed to get form context' });
  }
});

module.exports = router;