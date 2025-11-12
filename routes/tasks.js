const express = require('express');
const { models } = require('../models');
const { User, Task } = models;
const bonitaService = require('../services/bonitaService');

const router = express.Router();

// GET - Obtener estado de coverage request en Bonita
router.get('/coverage-request/:caseId/status', async (req, res) => {
  try {
    const { caseId } = req.params;

    // Obtener información del caso en Bonita
    const caseInfo = await bonitaService.getCaseById(caseId);
    const tasks = await bonitaService.getAllTasksForCase(caseId);

    res.json({
      success: true,
      data: {
        caseId,
        state: caseInfo.state,
        currentTasks: tasks.filter(t => t.state === 'ready').map(t => ({
          id: t.id,
          name: t.name,
          state: t.state
        })),
        completedTasks: tasks.filter(t => t.state === 'completed').length,
        totalTasks: tasks.length,
        processType: 'coverage_request'
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estado de coverage request:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estado de coverage request',
      error: error.message
    });
  }
});

// GET - Listar tareas locales (de la BD)
router.get('/local/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const where = { isCoverageRequest: false };
    if (projectId) where.projectId = projectId;
    
    const tasks = await Task.findAll({
      where,
    });
    
    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('Error getting local tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tareas locales'
    });
  }
});

// PUT - Voluntario toma una tarea local
router.put('/:taskId/take', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { ongId } = req.body;

    if (!ongId) {
      return res.status(400).json({
        success: false,
        message: 'ongId es requerido'
      });
    }

    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    // Solo permitir tomar tareas locales
    if (task.isCoverageRequest) {
      return res.status(400).json({
        success: false,
        message: 'Esta tarea es un Coverage Request, se gestiona a través de Bonita'
      });
    }

    if (task.takenBy) {
      return res.status(400).json({
        success: false,
        message: 'Esta tarea ya está tomada por otra ONG'
      });
    }

    const ong = await User.findByPk(ongId);
    if (!ong) {
      return res.status(404).json({
        success: false,
        message: 'ONG no encontrada'
      });
    }

    await task.update({ 
      takenBy: ongId,
      status: 'in_progress'
    });

    const updatedTask = await Task.findByPk(taskId, {
      include: [
        {
          model: User,
          as: 'volunteer',
          attributes: ['id', 'username', 'organizationName', 'email']
        }
      ]
    });

    res.json({
      success: true,
      message: `${ong.organizationName} se hará cargo de la tarea`,
      data: updatedTask
    });

  } catch (error) {
    console.error('Error taking task:', error);
    res.status(500).json({
      success: false,
      message: 'Error asignándose a la tarea'
    });
  }
});

module.exports = router;