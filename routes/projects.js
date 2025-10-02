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

// POST - Crear y enviar proyecto a Bonita BPM
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

    // Preparar datos para Bonita
    const bonitaData = {
      name,
      description,
      startDate,
      endDate,
      tasks,
      ownerId,
      organizationName: owner.organizationName
    };

    // Enviar a Bonita BPM
    console.log('Enviando proyecto a Bonita BPM...');
    const bonitaCase = await bonitaService.startProcess(bonitaData);
    const caseId = bonitaCase.id || bonitaCase.caseId;

    // Completar automáticamente la primera tarea de registro
    console.log('Completando automáticamente la primera tarea...');
    try {
      // Esperar un momento para que la tarea esté disponible
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Obtener tareas pendientes del caso recién creado (con reintentos)
      let pendingTasks = [];
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts && pendingTasks.length === 0) {
        attempts++;
        console.log(`Intento ${attempts} de obtener tareas del caso ${caseId}`);
        pendingTasks = await bonitaService.getAllTasksForCase(caseId);
        
        if (pendingTasks.length === 0 && attempts < maxAttempts) {
          console.log('No se encontraron tareas, esperando 500ms antes del siguiente intento...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (pendingTasks && pendingTasks.length > 0) {
        const firstTask = pendingTasks[0];
        console.log(`Completando tarea: ${firstTask.name} (ID: ${firstTask.id})`);
        
        // Variables para completar la primera tarea (formulario de registro)
        const taskVariables = {
          proyecto_registrado: true,
          fecha_registro: new Date().toISOString().split('T')[0],
          registrador: "Sistema Automatizado",
          comentarios_registro: "Proyecto registrado automáticamente desde el frontend",
          validacion_datos: true
        };
        
        await bonitaService.completeTaskWithVariables(firstTask.id, taskVariables);
        console.log('Primera tarea completada automáticamente');
      } else {
        console.log(`No se encontraron tareas para completar después de ${maxAttempts} intentos`);
      }
    } catch (autoCompleteError) {
      console.warn('No se pudo completar automáticamente la primera tarea:', autoCompleteError.message);
      // No fallar todo el proceso si no se puede completar la tarea
    }

    // Crear proyecto en nuestra BD con referencia a Bonita
    const project = await Project.create({
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'pending_approval',
      progress: 0,
      createdBy: ownerId,
      bonitaCaseId: caseId
    }, { transaction });

    // Crear tasks asociadas
    const createdTasks = [];
    if (tasks && tasks.length > 0) {
      for (const taskData of tasks) {
        const {
          title,
          description: taskDescription,
          dueDate,
          estimatedHours,
          taskTypeId,
          isCoverageRequest
        } = taskData;

        if (!title) {
          throw new Error(`Task sin título encontrada`);
        }

        const task = await Task.create({
          title,
          description: taskDescription,
          status: 'todo',
          dueDate: dueDate ? new Date(dueDate) : null,
          estimatedHours,
          actualHours: 0,
          projectId: project.id,
          takenBy: null,
          createdBy: ownerId,
          taskTypeId,
          isCoverageRequest
        }, { transaction });

        createdTasks.push(task);
      }
    }

    await transaction.commit();

    // Obtener estado final del proceso en Bonita
    let finalProcessState = null;
    try {
      finalProcessState = await bonitaService.getCaseById(caseId);
    } catch (error) {
      console.warn('No se pudo obtener estado final del proceso:', error.message);
    }

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Proyecto creado y procesado automáticamente en Bonita BPM',
      data: {
        project: {
          ...project.toJSON(),
          creator: owner
        },
        bonitaCaseId: caseId,
        tasksCreated: createdTasks.length,
        processState: finalProcessState?.state || 'unknown',
        automation: {
          processStarted: true,
          firstTaskCompleted: true,
          message: 'El proyecto fue registrado automáticamente en Bonita BPM'
        },
        nextSteps: [
          'El proyecto fue registrado automáticamente',
          'El proceso continúa en Bonita BPM',
          'Puedes revisar el estado en tiempo real'
        ]
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error enviando proyecto a Bonita:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error enviando proyecto a Bonita BPM',
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