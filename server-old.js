const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar modelos y base de datos
const { syncDatabase, seedData, models, sequelize } = require('./models');
const { User, Project, Task } = models;

const app = express();
const PORT = process.env.NODE_DOCKER_PORT || process.env.PORT || 5000;

// 🔒 Middlewares de seguridad
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Demasiadas requests, intenta en 15 minutos' }
});
app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 🏥 Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Project Planning Backend está funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'MySQL + Sequelize'
  });
});

// 👥 USUARIOS (ONGs)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Project,
          as: 'createdProjects',
          attributes: ['id', 'name', 'status']
        }
      ]
    });

    res.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo usuarios'
    });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      organizationName,
      description,
      website,
      contactPerson,
      phone,
      role = 'ong'
    } = req.body;
    
    const user = await User.create({
      username,
      email,
      password,
      organizationName,
      description,
      website,
      contactPerson,
      phone,
      role
    });
    
    res.status(201).json({
      success: true,
      message: 'ONG registrada exitosamente',
      data: user.toSafeJSON()
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({
      success: false,
      message: 'Error creando usuario',
      error: error.message
    });
  }
});

// 📋 PROYECTOS
app.get('/api/projects', async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    
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
          attributes: ['id', 'title', 'status', 'priority'],
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

app.post('/api/projects', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      name,
      description,
      startDate,
      endDate,
      tasks = [],
      ownerId,
      priority = 'medium',
      budget,
      currency = 'USD'
    } = req.body;

    // Validaciones
    if (!name || !startDate || !endDate || !ownerId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: name, startDate, endDate, ownerId'
      });
    }

    // Verificar que la ONG existe
    const owner = await User.findByPk(ownerId);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'ONG no encontrada'
      });
    }

    // Crear el proyecto
    const project = await Project.create({
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      priority,
      budget,
      currency,
      status: 'planning',
      progress: 0,
      createdBy: ownerId
    }, { transaction });

    // Crear tasks asociadas
    const createdTasks = [];
    if (tasks && tasks.length > 0) {
      for (const taskData of tasks) {
        const {
          title,
          description: taskDescription,
          dueDate,
          priority: taskPriority = 'medium',
          estimatedHours
        } = taskData;

        if (!title) {
          throw new Error(`Task sin título encontrada`);
        }

        const task = await Task.create({
          title,
          description: taskDescription,
          status: 'todo',
          priority: taskPriority,
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

    // Obtener proyecto completo
    const completeProject = await Project.findByPk(project.id, {
      include: [
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'username', 'organizationName', 'email', 'role'] 
        },
        {
          model: Task,
          as: 'tasks',
          include: [{
            model: User,
            as: 'volunteer',
            attributes: ['id', 'username', 'organizationName', 'email'],
            required: false
          }]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      data: {
        project: completeProject,
        tasksCreated: createdTasks.length
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error creating project:', error);
    res.status(400).json({
      success: false,
      message: 'Error creando proyecto',
      error: error.message
    });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'organizationName', 'email', 'role', 'contactPerson', 'website']
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

// ENDPOINT para que una ONG se haga cargo de una tarea
app.put('/api/tasks/:taskId/take', async (req, res) => {
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

// Error Handler Global
app.use((error, req, res, next) => {
  console.error('Global Error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// INICIAR SERVIDOR
const startServer = async () => {
  try {
    console.log('🔄 Iniciando servidor...');
    
    // Sincronizar base de datos con force para aplicar cambios del modelo
    const dbSynced = await syncDatabase({ force: true });
    if (!dbSynced) {
      throw new Error('No se pudo sincronizar la base de datos');
    }
    
    // Crear datos de prueba (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('🌱 Creando datos de prueba...');
      await seedData();
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 API disponible en: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log('📊 Endpoints disponibles:');
      console.log('  - GET  /api/users');
      console.log('  - POST /api/users');
      console.log('  - GET  /api/projects');
      console.log('  - POST /api/projects');
      console.log('  - GET  /api/projects/:id');
      console.log('  - PUT  /api/tasks/:taskId/take');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
};

// Manejar cierre graceful
process.on('SIGTERM', async () => {
  console.log('🔄 Cerrando servidor...');
  const { closeConnection } = require('./models');
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Cerrando servidor...');
  const { closeConnection } = require('./models');
  await closeConnection();
  process.exit(0);
});

// Iniciar
startServer();

module.exports = app;