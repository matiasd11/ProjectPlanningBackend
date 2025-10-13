const express = require('express');
const router = express.Router();
const bonitaService = require('../services/bonitaService');

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

module.exports = router;