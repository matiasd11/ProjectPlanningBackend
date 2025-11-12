const express = require('express');
const { models, sequelize } = require('../models');
const { User, Project, Task, TaskType } = models;
const bonitaService = require('../services/bonitaService');
const router = express.Router();
const projectController = require('../controllers/projectController');


// GET - Listar proyectos por ONG y/o status
router.get('/', async (req, res) => {
  try {
    const { status, ownerId } = req.body;
    const { Op } = require('sequelize');

    const where = {};
    
    // Filtrar por array de status
    if (status && status.length > 0) {
      where.status = {
        [Op.in]: status
      };
    }
    
    if (ownerId) where.ownerId = ownerId;

    const projects = await Project.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo proyectos'
    });
  }
});

// GET - Listar proyectos
// router.get('/', async (req, res) => {
//   try {
//     const { status, page = 1, limit = 10 } = req.query;

//     const where = {};
//     if (status) where.status = status;

//     const offset = (page - 1) * limit;

//     const { count, rows } = await Project.findAndCountAll({
//       where,
//       include: [
//         {
//           model: User,
//           as: 'creator',
//           attributes: ['id', 'username', 'organizationName']
//         },
//         {
//           model: Task,
//           as: 'tasks',
//           attributes: ['id', 'title', 'status'],
//           include: [
//             {
//               model: User,
//               as: 'volunteer',
//               attributes: ['id', 'username', 'organizationName'],
//               required: false
//             },
//             {
//               model: TaskType,
//               as: 'taskType',
//               attributes: ['id', 'title'],
//               required: false
//             }
//           ]
//         }
//       ],
//       limit: parseInt(limit),
//       offset: parseInt(offset),
//       order: [['created_at', 'DESC']]
//     });

//     res.json({
//       success: true,
//       data: rows,
//       pagination: {
//         total: count,
//         page: parseInt(page),
//         pages: Math.ceil(count / limit),
//         limit: parseInt(limit)
//       }
//     });
//   } catch (error) {
//     console.error('Error getting projects:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error obteniendo proyectos'
//     });
//   }
// });

// GET - Obtener proyecto por ID con detalles de Bonita
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'organizationName', 'email', 'role', 'website']
        },
        {
          model: Task,
          as: 'tasks',
          attributes: ['id', 'title', 'status'],
          include: [{
            model: User,
            as: 'assignedUser',
            attributes: ['id', 'username', 'organizationName']
          }]
        }
      ]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Si el proyecto tiene un caso en Bonita, obtener información adicional
    let bonitaInfo = null;
    if (project.bonita_case_id) {
      try {
        const tasks = await bonitaService.getAllTasksForCase(project.bonita_case_id);
        const variables = await bonitaService.getCaseVariables(project.bonita_case_id);

        bonitaInfo = {
          caseId: project.bonita_case_id,
          currentTasks: tasks.map(task => ({
            id: task.id,
            name: task.name,
            state: task.state,
            assigned_id: task.assigned_id,
            type: task.type
          })),
          variables: variables.reduce((acc, variable) => {
            acc[variable.name] = variable.value;
            return acc;
          }, {}),
          tasksCount: tasks.length
        };
      } catch (bonitaError) {
        console.error('Error obteniendo info de Bonita:', bonitaError.message);
        bonitaInfo = {
          error: 'No se pudo obtener información de Bonita',
          caseId: project.bonita_case_id
        };
      }
    }

    res.json({
      success: true,
      data: project,
      bonita: bonitaInfo
    });
  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// POST - Crear proyecto y manejar tareas según isCoverageRequest
router.post('/', projectController.createProject);

// POST - Add a commitment to a project (find caseId from project)
router.post('/:projectId/commitments', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskId, ongId, description } = req.body;

    // Buscar el proyecto y obtener el caseId
    const project = await models.Project.findByPk(projectId);
    if (!project || !project.bonitaCaseId) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado o sin caseId asociado.'
      });
    }
    const caseId = project.bonitaCaseId;

    // Crear el compromiso en la base local
    const newCommitment = await models.Commitment.create({
      taskId,
      ongId,
      description,
      status: 'pending'
    });

    // Obtener los compromisos actuales del caso en Bonita
    const bonitaVariables = await bonitaService.getCaseVariables(caseId);
    const commitmentsVar = bonitaVariables.find(v => v.name === 'commitments');

    let commitments = [];
    if (commitmentsVar && commitmentsVar.value) {
      try {
        const parsed = JSON.parse(commitmentsVar.value);
        commitments = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error("Could not parse existing commitments from Bonita, starting fresh.", e);
        commitments = [];
      }
    }

    commitments.push({
      id: newCommitment.id,
      taskId: newCommitment.taskId,
      ongId: newCommitment.ongId,
      description: newCommitment.description,
      status: newCommitment.status,
      createdAt: newCommitment.createdAt
    });

    // Actualizar la variable en Bonita
    await bonitaService.updateCaseVariable(caseId, 'commitments', JSON.stringify(commitments), 'java.lang.String');

    res.status(201).json({
      success: true,
      message: 'Commitment added successfully and Bonita case variable updated.',
      data: newCommitment
    });

  } catch (error) {
    console.error('Error adding commitment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add commitment.',
      error: error.message
    });
  }
});

// GET - Estado del proceso en Bonita para un proyecto
router.get('/:id/bonita-status', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id, {
      attributes: ['id', 'name', 'bonita_case_id', 'status']
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    if (!project.bonita_case_id) {
      return res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          status: project.status
        },
        bonita: {
          status: 'not_initiated',
          message: 'Proyecto no tiene proceso en Bonita'
        }
      });
    }

    try {
      // Obtener información completa del proceso
      const tasks = await bonitaService.getAllTasksForCase(project.bonita_case_id);
      const variables = await bonitaService.getCaseVariables(project.bonita_case_id);

      // Determinar el estado del proceso
      const activeTasks = tasks.filter(task => task.state === 'ready');
      const completedTasks = tasks.filter(task => task.state === 'completed');

      let processStatus = 'active';
      if (activeTasks.length === 0 && tasks.length > 0) {
        processStatus = 'completed';
      } else if (tasks.length === 0) {
        processStatus = 'no_tasks';
      }

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          status: project.status
        },
        bonita: {
          caseId: project.bonita_case_id,
          status: processStatus,
          activeTasks: activeTasks.map(task => ({
            id: task.id,
            name: task.name,
            state: task.state,
            assigned_id: task.assigned_id,
            dueDate: task.dueDate
          })),
          completedTasksCount: completedTasks.length,
          totalTasksCount: tasks.length,
          variables: variables.reduce((acc, variable) => {
            acc[variable.name] = variable.value;
            return acc;
          }, {}),
          lastUpdate: new Date().toISOString()
        }
      });
    } catch (bonitaError) {
      console.error('Error consultando Bonita:', bonitaError.message);
      res.status(500).json({
        success: false,
        message: 'Error consultando estado en Bonita',
        project: {
          id: project.id,
          name: project.name,
          status: project.status
        },
        error: bonitaError.message
      });
    }
  } catch (error) {
    console.error('Error obteniendo estado de Bonita:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;