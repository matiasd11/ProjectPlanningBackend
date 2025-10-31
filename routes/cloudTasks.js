const express = require('express');
const router = express.Router();
const bonitaService = require('../services/bonitaService');
const axios = require('axios');
/**
 * @route GET /api/v1/cloud-tasks/:projectId
 * @desc Obtiene tareas colaborativas del cloud via Bonita para un proyecto
 * @param {number} projectId - ID del proyecto
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de proyecto inválido'
      });
    }

    console.log(`🌐 Obteniendo tareas del cloud via Bonita para proyecto ${projectId}`);
    
    const result = await bonitaService.getCloudTasksByProjectViaBonita(parseInt(projectId));
    
    res.json({
      success: result.success,
      message: result.message,
      data: result.data,
      projectId: result.projectId,
      bonitaCaseId: result.bonitaCaseId,
      retrievedAt: result.retrievedAt,
      source: 'bonita_cloud_data',
      error: result.error
    });
  } catch (error) {
    console.error('Error obteniendo tareas del cloud via Bonita:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/cloud-tasks/extension/tasks
 * @desc Proxy a Bonita /API/extension/cloudTasks (envía username, password y projectId en body)
 */
router.post('/extension/tasks', async (req, res) => {
  try {
    const { username, password, projectId } = req.body;

    if (!username || !password || !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos en el body',
      });
    }

    // 🔐 Autenticación con Bonita
    const loggedIn = await bonitaService.authenticate(username, password);
    if (!loggedIn) {
      return res.status(500).json({
        success: false,
        message: 'No se pudo autenticar con Bonita',
      });
    }

    const url = `${bonitaService.baseURL}/API/extension/cloudTasks`;
    console.log(`📡 Llamando a Bonita Extension POST ${url}`);

    // 👇 Enviamos el body JSON igual que espera el Groovy
    const response = await axios.post(
      url,
      { username, password, projectId },
      {
        headers: {
          'Cookie': `${bonitaService.jsessionId}`,
          'X-Bonita-API-Token': bonitaService.apiToken,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error(
      '❌ Error llamando a extension/tasks:',
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: 'Error llamando a extension/tasks',
      error: error.response?.data || error.message,
    });
  }
});


/**
 * @route POST /api/v1/cloud-tasks/extension/commitment
 * @desc Proxy a Bonita /API/extension/commitment tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} taskId - ID de la tarea
 * @body {number} ongId - ID de la ONG
 * @body {string} description - Descripción del compromiso
 */
router.post('/extension/commitment', async (req, res) => {
  try {
    const { username, password, taskId, ongId, description } = req.body;

    if (!username || !password || !taskId || !ongId || !description) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos en el body' });
    }

    // 🔐 Autenticación Bonita
    const loggedIn = await bonitaService.authenticate(username, password);
    if (!loggedIn) {
      return res.status(500).json({ success: false, message: 'No se pudo autenticar con Bonita' });
    }

    const url = `${bonitaService.baseURL}/API/extension/commitment`;

    console.log(`Llamando a Bonita Extension POST ${url}`);

    // 👇 Enviamos el body en formato JSON (ahora el Groovy lo interpreta bien)
    const response = await axios.post(
      url,
      {
        username,
        password,
        taskId,
        ongId,
        description
      },
      {
        headers: {
          'Cookie': `${bonitaService.jsessionId}`,
          'X-Bonita-API-Token': bonitaService.apiToken,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Error llamando a extension/commitment:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Error llamando a extension/commitment',
      error: error.response?.data || error.message,
    });
  }
});

/**
 * @route POST /api/v1/cloud-tasks/extension/commitmentsByTask
 * @desc Proxy a Bonita /API/extension/commitmentsByTask tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} taskId - ID de la tarea
 */
router.post('/extension/commitmentsByTask', async (req, res) => {
  try {
    const { username, password, taskId } = req.body;

    if (!username || !password || !taskId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos en el body',
      });
    }

    // 🔐 Autenticación Bonita
    const loggedIn = await bonitaService.authenticate(username, password);
    if (!loggedIn) {
      return res.status(500).json({
        success: false,
        message: 'No se pudo autenticar con Bonita',
      });
    }

    const url = `${bonitaService.baseURL}/API/extension/commitmentsByTask`;
    console.log(`📡 Llamando a Bonita Extension POST ${url}`);

    // 👇 Enviamos body plano JSON (idéntico al endpoint anterior)
    const response = await axios.post(
      url,
      { username, password, taskId },
      {
        headers: {
          'Cookie': `${bonitaService.jsessionId}`,
          'X-Bonita-API-Token': bonitaService.apiToken,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error(
      '❌ Error llamando a extension/commitmentsByTask:',
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: 'Error llamando a extension/commitmentsByTask',
      error: error.response?.data || error.message,
    });
  }
});





module.exports = router;