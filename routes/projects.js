const express = require('express');
const { models, sequelize } = require('../models');
const { User, Project, Task } = models;
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
          include: [{
            model: User,
            as: 'volunteer',
            attributes: ['id', 'username', 'organizationName'],
            required: false
          }]
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

// GET - Obtener proyecto por ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'organizationName', 'email', 'role', 'website']
        },
        {
          model: Task,
          as: 'tasks',
          include: [
            {
              model: User,
              as: 'volunteer',
              attributes: ['id', 'username', 'organizationName', 'email', 'role'],
              required: false
            }
          ]
        }
      ]
    });
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo proyecto'
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

    // Crear proyecto en nuestra BD con referencia a Bonita
    const project = await Project.create({
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'pending_approval',
      progress: 0,
      createdBy: ownerId,
      bonitaCaseId: bonitaCase.id || bonitaCase.caseId || null
    }, { transaction });

    // Crear tasks asociadas
    const createdTasks = [];
    if (tasks && tasks.length > 0) {
      for (const taskData of tasks) {
        const {
          title,
          description: taskDescription,
          dueDate,
          estimatedHours
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
          createdBy: ownerId
        }, { transaction });

        createdTasks.push(task);
      }
    }

    await transaction.commit();

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Proyecto enviado a Bonita BPM para aprobación',
      data: {
        project: {
          ...project.toJSON(),
          creator: owner
        },
        bonitaCaseId: bonitaCase.id || bonitaCase.caseId || null,
        tasksCreated: createdTasks.length,
        nextSteps: [
          'El proyecto está en proceso de aprobación',
          'Recibirás una notificación cuando sea aprobado',
          'Podrás ver el estado en Bonita BPM'
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

module.exports = router;