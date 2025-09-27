const { sequelize, testConnection } = require('../config/database');

// Importar todos los modelos
const User = require('./User');
const Project = require('./Project');
const Task = require('./Task');

// Definir RELACIONES
// 👇 Aquí está la magia de las relaciones 1:N

// 🔹 1. User tiene muchos Projects (como creador)
User.hasMany(Project, {
  foreignKey: 'createdBy',
  as: 'createdProjects',
  onDelete: 'RESTRICT' // No permitir eliminar user con proyectos
});

Project.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator',
  onDelete: 'RESTRICT'
});

// 🔹 2. User puede manejar muchos Projects (como manager)
User.hasMany(Project, {
  foreignKey: 'managerId',
  as: 'managedProjects',
  onDelete: 'SET NULL' // Si elimino manager, proyecto queda sin manager
});

Project.belongsTo(User, {
  foreignKey: 'managerId',
  as: 'manager',
  onDelete: 'SET NULL'
});

// 🔹 3. Project tiene muchas Tasks
Project.hasMany(Task, {
  foreignKey: 'projectId',
  as: 'tasks',
  onDelete: 'CASCADE' // Si elimino proyecto, elimino sus tareas
});

Task.belongsTo(Project, {
  foreignKey: 'projectId',
  as: 'project',
  onDelete: 'CASCADE'
});

// 🔹 4. User tiene muchas Tasks asignadas
User.hasMany(Task, {
  foreignKey: 'assignedTo',
  as: 'assignedTasks',
  onDelete: 'SET NULL'
});

Task.belongsTo(User, {
  foreignKey: 'assignedTo',
  as: 'assignee',
  onDelete: 'SET NULL'
});

// 🔹 5. User crea muchas Tasks
User.hasMany(Task, {
  foreignKey: 'createdBy',
  as: 'createdTasks',
  onDelete: 'RESTRICT'
});

Task.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'taskCreator',
  onDelete: 'RESTRICT'
});

// Función para sincronizar BD
const syncDatabase = async (options = {}) => {
  try {
    // Test de conexión primero
    const connected = await testConnection();
    if (!connected) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    // Sincronizar modelos
    const { force = false, alter = false } = options;
    
    if (force) {
      console.log('⚠️  RECREANDO todas las tablas...');
    } else if (alter) {
      console.log('🔄 Alterando tablas existentes...');
    }

    await sequelize.sync({ force, alter });
    
    console.log('✅ Base de datos sincronizada correctamente');
    console.log('📊 Modelos disponibles:', Object.keys(sequelize.models));
    
    return true;
  } catch (error) {
    console.error('❌ Error sincronizando BD:', error.message);
    return false;
  }
};

// Función para cerrar conexión
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('✅ Conexión cerrada correctamente');
  } catch (error) {
    console.error('❌ Error cerrando conexión:', error.message);
  }
};

// Función para poblar datos de prueba
const seedData = async () => {
  try {
    // Crear usuarios de prueba
    const adminUser = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        email: 'admin@project.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
      }
    });

    const managerUser = await User.findOrCreate({
      where: { username: 'manager' },
      defaults: {
        username: 'manager',
        email: 'manager@project.com',
        password: 'manager123',
        firstName: 'Project',
        lastName: 'Manager',
        role: 'manager'
      }
    });

    const regularUser = await User.findOrCreate({
      where: { username: 'developer' },
      defaults: {
        username: 'developer',
        email: 'dev@project.com',
        password: 'dev123',
        firstName: 'John',
        lastName: 'Developer',
        role: 'user'
      }
    });

    // Crear proyecto de ejemplo
    const sampleProject = await Project.findOrCreate({
      where: { name: 'Sistema de Gestión' },
      defaults: {
        name: 'Sistema de Gestión',
        description: 'Sistema web para gestión de proyectos y tareas',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        budget: 100000,
        currency: 'USD',
        status: 'active',
        priority: 'high',
        progress: 25,
        createdBy: adminUser[0].id,
        managerId: managerUser[0].id,
        tags: ['web', 'sistema', 'gestión'],
        metadata: {
          client: 'Empresa ABC',
          technology: 'Node.js + React + MySQL'
        }
      }
    });

    // Crear tareas de ejemplo
    await Task.findOrCreate({
      where: { title: 'Diseño de base de datos' },
      defaults: {
        title: 'Diseño de base de datos',
        description: 'Crear esquema de BD y relaciones',
        status: 'done',
        priority: 'high',
        dueDate: new Date('2025-01-15'),
        estimatedHours: 16,
        actualHours: 12,
        projectId: sampleProject[0].id,
        assignedTo: regularUser[0].id,
        createdBy: managerUser[0].id,
        tags: ['backend', 'database']
      }
    });

    await Task.findOrCreate({
      where: { title: 'API REST development' },
      defaults: {
        title: 'API REST development',
        description: 'Desarrollar endpoints principales',
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date('2025-02-01'),
        estimatedHours: 40,
        actualHours: 15,
        projectId: sampleProject[0].id,
        assignedTo: regularUser[0].id,
        createdBy: managerUser[0].id,
        tags: ['backend', 'api']
      }
    });

    console.log('✅ Datos de prueba creados correctamente');
  } catch (error) {
    console.error('❌ Error creando datos de prueba:', error.message);
  }
};

// Exportar todo
module.exports = {
  sequelize,
  models: {
    User,
    Project,
    Task
  },
  syncDatabase,
  closeConnection,
  seedData,
  testConnection
};