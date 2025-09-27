const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar modelos y base de datos
const { syncDatabase, seedData, models } = require('./models');
const { User, Project, Task } = models;

const app = express();
const PORT = process.env.NODE_DOCKER_PORT || process.env.PORT || 5000;

// 🔒 Middlewares de seguridad
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // límite de requests por IP
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

// 📊 RUTAS PRINCIPALES

// 👥 USUARIOS
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Project,
          as: 'createdProjects',
          attributes: ['id', 'name', 'status']
        },
        {
          model: Project,
          as: 'managedProjects',
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
      message: 'Error obteniendo usuarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;
    
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: role || 'user'
    });
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
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
          attributes: ['id', 'username', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'manager',
          attributes: ['id', 'username', 'firstName', 'lastName']
        },
        {
          model: Task,
          as: 'tasks',
          attributes: ['id', 'title', 'status', 'priority']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
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
      message: 'Error obteniendo proyectos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const {
      name,
      description,
      startDate,
      endDate,
      budget,
      currency = 'USD',
      priority = 'medium',
      createdBy,
      managerId,
      tags = [],
      metadata = {}
    } = req.body;
    
    const project = await Project.create({
      name,
      description,
      startDate,
      endDate,
      budget,
      currency,
      priority,
      createdBy,
      managerId,
      tags,
      metadata
    });
    
    // Obtener proyecto completo con relaciones
    const completeProject = await Project.findByPk(project.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: User, as: 'manager', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ]
    });
    
    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      data: completeProject
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({
      success: false,
      message: 'Error creando proyecto',
      error: error.message
    });
  }
});

// Proyecto específico
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'manager',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email']
        },
        {
          model: Task,
          as: 'tasks',
          include: [
            {
              model: User,
              as: 'assignee',
              attributes: ['id', 'username', 'firstName', 'lastName']
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
      message: 'Error obteniendo proyecto',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ TAREAS
app.get('/api/projects/:projectId/tasks', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, assignedTo } = req.query;
    
    const where = { projectId };
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    
    const tasks = await Task.findAll({
      where,
      include: [
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'username', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'taskCreator',
          attributes: ['id', 'username', 'firstName', 'lastName']
        },
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      data: tasks,
      total: tasks.length
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo tareas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/projects/:projectId/tasks', async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      title,
      description,
      priority = 'medium',
      dueDate,
      estimatedHours,
      assignedTo,
      createdBy,
      tags = []
    } = req.body;
    
    const task = await Task.create({
      title,
      description,
      priority,
      dueDate,
      estimatedHours,
      assignedTo,
      createdBy,
      projectId,
      tags
    });
    
    // Obtener tarea completa con relaciones
    const completeTask = await Task.findByPk(task.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: User, as: 'taskCreator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: Project, as: 'project', attributes: ['id', 'name'] }
      ]
    });
    
    res.status(201).json({
      success: true,
      message: 'Tarea creada exitosamente',
      data: completeTask
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(400).json({
      success: false,
      message: 'Error creando tarea',
      error: error.message
    });
  }
});

// 📊 ESTADÍSTICAS
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await Promise.all([
      User.count(),
      Project.count(),
      Task.count(),
      Project.count({ where: { status: 'active' } }),
      Task.count({ where: { status: 'todo' } }),
      Task.count({ where: { status: 'done' } })
    ]);
    
    res.json({
      success: true,
      data: {
        totalUsers: stats[0],
        totalProjects: stats[1],
        totalTasks: stats[2],
        activeProjects: stats[3],
        pendingTasks: stats[4],
        completedTasks: stats[5]
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas'
    });
  }
});

// 🚫 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    availableEndpoints: [
      'GET /health',
      'GET /api/users',
      'POST /api/users',
      'GET /api/projects',
      'POST /api/projects',
      'GET /api/projects/:id',
      'GET /api/projects/:projectId/tasks',
      'POST /api/projects/:projectId/tasks',
      'GET /api/stats'
    ]
  });
});

// ❌ Error Handler Global
app.use((error, req, res, next) => {
  console.error('Global Error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 🚀 INICIAR SERVIDOR
const startServer = async () => {
  try {
    console.log('🔄 Iniciando servidor...');
    
    // Sincronizar base de datos
    const dbSynced = await syncDatabase();
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
      console.log('  - GET  /api/projects/:projectId/tasks');
      console.log('  - POST /api/projects/:projectId/tasks');
      console.log('  - GET  /api/stats');
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