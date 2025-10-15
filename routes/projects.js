const express = require('express');
const { models, sequelize } = require('../models');
const { User, Project, Task, TaskType } = models;
const bonitaService = require('../services/bonitaService');

const router = express.Router();

// GET - Listar proyectos
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const where = {};
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const { count, rows } = await Project.findAndCountAll({
      where,
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
          include: [
            {
              model: User,
              as: 'volunteer',
              attributes: ['id', 'username', 'organizationName'],
              required: false
            },
            {
              model: TaskType,
              as: 'taskType',
              attributes: ['id', 'title'],
              required: false
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo proyectos'
    });
  }
});

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
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      name,
      description,
      startDate,
      endDate,
      tasks = [],
      ownerId
    } = req.body;

    // Validaciones
    if (!name || !startDate || !endDate || !ownerId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: name, startDate, endDate, ownerId'
      });
    }

    // Verificar que la ONG existe
    const owner = await User.findByPk(ownerId, {
      attributes: ['id', 'username', 'organizationName', 'email']
    });

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'ONG no encontrada'
      });
    }

    console.log('🚀 Procesando proyecto con tareas:', {
      projectName: name,
      totalTasks: tasks.length,
      coverageRequests: tasks.filter(t => t.isCoverageRequest === true).length,
      localTasks: tasks.filter(t => t.isCoverageRequest !== true).length
    });

    // 1. CREAR PROYECTO EN BD LOCAL (siempre se guarda)
    const project = await Project.create({
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'pending_approval',
      progress: 0,
      createdBy: ownerId,
      bonitaCaseId: null
    }, { transaction });

    console.log('💾 Proyecto guardado en BD local:', project.id);

    // 2. SEPARAR TAREAS SEGÚN isCoverageRequest
    const localTasks = tasks.filter(task => task.isCoverageRequest !== true);
    const coverageRequestTasks = tasks.filter(task => task.isCoverageRequest === true);

    console.log('📋 Tareas separadas:', {
      localTasks: localTasks.length,
      coverageRequests: coverageRequestTasks.length
    });

    // 3. GUARDAR TAREAS LOCALES EN BD
    const createdLocalTasks = [];
    if (localTasks.length > 0) {
      for (const taskData of localTasks) {
        const {
          title,
          description: taskDescription,
          dueDate,
          estimatedHours,
          taskTypeId,
          priority = 'medium'
        } = taskData;

        if (!title) {
          throw new Error(`Tarea local sin título encontrada`);
        }

        const task = await Task.create({
          title,
          description: taskDescription,
          status: 'todo',
          dueDate: dueDate ? new Date(dueDate) : null,
          estimatedHours: estimatedHours || 0,
          actualHours: 0,
          priority,
          projectId: project.id,
          takenBy: null,
          createdBy: ownerId,
          taskTypeId: taskTypeId || 1,
          isCoverageRequest: false
        }, { transaction });

        createdLocalTasks.push(task);
      }
      console.log('💾 Tareas locales guardadas en BD:', createdLocalTasks.length);
    }

    // 4. ENVIAR TODAS LAS COVERAGE REQUESTS EN UN SOLO CASO ÚNICO
    const bonitaCoverageRequests = [];
    if (coverageRequestTasks.length > 0) {
      console.log('🚀 Enviando TODAS las Coverage Requests en UN SOLO CASO de Bonita...');
      try {
        // No enviar variables al crear el caso en Bonita
        const bonitaCase = await bonitaService.startProcess();
        const caseId = bonitaCase.id || bonitaCase.caseId;

        console.log('✅ Caso creado en Bonita:', caseId);

        const coverageRequestsData = coverageRequestTasks.length
          ? coverageRequestTasks.map(task => ({
            title: task.title || '',
            description: task.description || '',
            estimatedHours: task.estimatedHours ?? 0,
            dueDate: task.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            urgencyLevel: task.urgencyLevel || 'medium',
            requiredSkills: task.requiredSkills || [],
            taskTypeId: task.taskTypeId || 1,
            projectId: project.id,
            isCoverageRequest: true,
            source: "bonita_batch_process"
          }))
          : [];

        const batchVars = {
          projectId: project.id,
          createdBy: ownerId,
          totalCoverageRequests: coverageRequestTasks.length,
          timestamp: new Date().toISOString(),
          requestType: 'batch_coverage_requests',
          isBatchCoverageRequest: true,
          coverageRequestsData: JSON.stringify(coverageRequestsData)
        };


        // Buscar la primera tarea humana del caso
        const tasks = await bonitaService.getAllTasksForCase(caseId);
        console.log('🧩 Tareas encontradas para el caso:', tasks);
        if (!tasks.length) throw new Error('No se encontraron tareas humanas para el caso');
        const firstTask = tasks[0];

        console.log('⚡ Completando la primera tarea del caso y enviando batchVars:', batchVars);
        const result = await bonitaService.completeTaskWithVariables(firstTask.id, caseId, batchVars);
        console.log('✅ Tarea completada:', result);
        // Actualizar proyecto con referencia al caso
        await project.update({
          bonitaCaseId: caseId
        }, { transaction });

        bonitaCoverageRequests.push({
          batchCaseId: caseId,
          totalRequests: coverageRequestTasks.length,
          requestTitles: coverageRequestTasks.map(t => t.title),
          processType: 'coverage_requests',
          firstTaskCompleted: true
        });

        console.log('✅ Caso procesado completamente:', {
          caseId: caseId,
          totalRequests: coverageRequestTasks.length,
          firstTaskCompleted: true
        });
      } catch (bonitaError) {
        console.error('❌ Error enviando caso a Bonita:', bonitaError.message);
        bonitaCoverageRequests.push({
          error: bonitaError.message,
          processType: 'coverage_requests_failed',
          firstTaskCompleted: false
        });
      }
    }

    await transaction.commit();

    // 5. RESPUESTA COMPLETA
    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente con caso único',
      data: {
        project: {
          ...project.toJSON(),
          creator: owner,
          bonitaCaseId: project.bonitaCaseId // Referencia al caso único
        },
        localTasks: {
          count: createdLocalTasks.length,
          tasks: createdLocalTasks.map(t => ({
            id: t.id,
            title: t.title,
            isCoverageRequest: false,
            storageLocation: 'local_database'
          }))
        },
        coverageRequests: {
          count: bonitaCoverageRequests.length,
          successful: bonitaCoverageRequests.filter(cr => !cr.error).length,
          failed: bonitaCoverageRequests.filter(cr => cr.error).length,
          requests: bonitaCoverageRequests.map(cr => ({
            batchCaseId: cr.batchCaseId,
            totalRequests: cr.totalRequests,
            requestTitles: cr.requestTitles,
            status: cr.error ? 'failed' : 'sent_to_bonita_batch',
            error: cr.error,
            firstTaskCompleted: cr.firstTaskCompleted || false,
            storageLocation: 'bonita_bmp_single_case'
          }))
        },
        summary: {
          totalTasksProcessed: tasks.length,
          savedToDatabase: createdLocalTasks.length,
          sentToBonita: bonitaCoverageRequests.filter(cr => !cr.error).length,
          processingErrors: bonitaCoverageRequests.filter(cr => cr.error).length,
          coverageRequestsAutoCompleted: bonitaCoverageRequests.filter(cr => cr.firstTaskCompleted).length,
          projectHasSingleBonitaCase: true, // Un solo caso para todas las coverage requests
          batchCoverageRequests: true // Coverage requests en batch
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error creando proyecto:', error);

    res.status(500).json({
      success: false,
      message: 'Error creando proyecto y procesando tareas',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
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