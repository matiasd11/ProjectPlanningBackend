const { sequelize, testConnection } = require('../config/database');

// Importar todos los modelos
const User = require('./User');
const Project = require('./Project');
const Task = require('./Task');
const TaskType = require('./TaskType');
const Commitment = require('./Commitment');
const Role = require('./Role');


// User tiene muchos Projects (como creador)
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

// Project tiene muchas Tasks
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

// User puede tomar muchas Tasks (voluntariamente)
User.hasMany(Task, {
  foreignKey: 'takenBy',
  as: 'takenTasks',
  onDelete: 'SET NULL'
});

Task.belongsTo(User, {
  foreignKey: 'takenBy',
  as: 'volunteer',
  onDelete: 'SET NULL'
});

// User crea muchas Tasks
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

// TaskType tiene muchas Tasks
TaskType.hasMany(Task, {
  foreignKey: 'taskTypeId',
  as: 'tasks',
  onDelete: 'RESTRICT' // No permitir eliminar tipo de tarea si tiene tareas asociadas
});

Task.belongsTo(TaskType, {
  foreignKey: 'taskTypeId',
  as: 'taskType',
  onDelete: 'RESTRICT'
});

// Task tiene muchos Commitments
Task.hasMany(Commitment, { 
  foreignKey: 'taskId', 
  as: 'commitments' 
});

Commitment.belongsTo(Task, { 
  foreignKey: 'taskId', 
  as: 'task' 
});

// User (ONG) tiene muchos Commitments
User.hasMany(Commitment, { 
  foreignKey: 'ongId', 
  as: 'commitments' 
});

Commitment.belongsTo(User, { 
  foreignKey: 'ongId', 
  as: 'ong' 
});

// User tiene muchos Roles (many-to-many)
User.belongsToMany(Role, {
  through: 'user_roles',
  foreignKey: 'userId',
  otherKey: 'roleId',
  as: 'roles'
});

Role.belongsToMany(User, {
  through: 'user_roles',
  foreignKey: 'roleId',
  otherKey: 'userId',
  as: 'users'
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
    
    // Crear roles precargados si no existen
    await seedRoles();
    
    console.log('Base de datos sincronizada correctamente');
    console.log('Modelos disponibles:', Object.keys(sequelize.models));
    
    return true;
  } catch (error) {
    console.error('Error sincronizando BD:', error.message);
    return false;
  }
};

// Función para cerrar conexión
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('Conexión cerrada correctamente');
  } catch (error) {
    console.error('Error cerrando conexión:', error.message);
  }
};

// Función para crear roles precargados
const seedRoles = async () => {
  try {
    // Crear roles precargados
    const rolePrincipal = await Role.findOrCreate({
      where: { id: 'ONG_PRINCIPAL' },
      defaults: {
        id: 'ONG_PRINCIPAL',
        name: 'Ong Principal'
      }
    });

    const roleColaboradora = await Role.findOrCreate({
      where: { id: 'ONG_COLABORADORA' },
      defaults: {
        id: 'ONG_COLABORADORA',
        name: 'Ong Colaboradora'
      }
    });

    const roleGerencial = await Role.findOrCreate({
      where: { id: 'ONG_GERENCIAL' },
      defaults: {
        id: 'ONG_GERENCIAL',
        name: 'Ong Gerencial'
      }
    });

    console.log('✅ Roles precargados verificados/creados');
  } catch (error) {
    console.error('Error creando roles precargados:', error.message);
  }
};

// Función para poblar datos de prueba
const seedData = async () => {
  try {
    // Crear roles precargados (si no existen ya)
    await seedRoles();
    
    // Obtener roles para usar en seedData
    const rolePrincipal = await Role.findByPk('ONG_PRINCIPAL');
    const roleColaboradora = await Role.findByPk('ONG_COLABORADORA');
    const roleGerencial = await Role.findByPk('ONG_GERENCIAL');
    
    // Crear usuarios de prueba (ONGs)
    const adminUser = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        password: 'admin123',
        organizationName: 'Administración del Sistema',
      }
    });

    const ongAmbiental = await User.findOrCreate({
      where: { username: 'ong-verde' },
      defaults: {
        username: 'ong-verde',
        password: 'verde123',
        organizationName: 'ONG Verde Futuro',
      }
    });

    const ongSocial = await User.findOrCreate({
      where: { username: 'ayuda-social' },
      defaults: {
        username: 'ayuda-social',
        password: 'social123',
        organizationName: 'Fundación Ayuda Social',
      }
    });

    const colaborador = await User.findOrCreate({
      where: { username: 'colaborador-tech' },
      defaults: {
        username: 'colaborador-tech',
        password: 'tech123',
        organizationName: 'Tech Volunteers',
      }
    });

    // Crear tipos de tarea
    const tipoEconomico = await TaskType.findOrCreate({
      where: { title: 'Económico' },
      defaults: { title: 'Económico' }
    });

    const tipoMateriales = await TaskType.findOrCreate({
      where: { title: 'Materiales' },
      defaults: { title: 'Materiales' }
    });

    const tipoManoObra = await TaskType.findOrCreate({
      where: { title: 'Mano de obra' },
      defaults: { title: 'Mano de obra' }
    });

    const tipoLogistico = await TaskType.findOrCreate({
      where: { title: 'Logístico' },
      defaults: { title: 'Logístico' }
    });

    // Crear proyecto de ejemplo
    const sampleProject = await Project.findOrCreate({
      where: { name: 'Reforestación Urbana 2025' },
      defaults: {
        name: 'Reforestación Urbana 2025',
        description: 'Proyecto para plantar 1000 árboles en zonas urbanas de Buenos Aires',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        status: 'active',
        progress: 15,
        createdBy: ongAmbiental[0].id
      }
    });

    // Crear tareas de ejemplo
    await Task.findOrCreate({
      where: { title: 'Selección de ubicaciones' },
      defaults: {
        title: 'Selección de ubicaciones',
        description: 'Mapear y seleccionar las 50 ubicaciones prioritarias para la plantación',
        status: 'done',
        dueDate: new Date('2025-02-15'),
        estimatedHours: 20,
        actualHours: 18,
        projectId: sampleProject[0].id,
        takenBy: colaborador[0].id,
        createdBy: ongAmbiental[0].id,
        taskTypeId: tipoEconomico[0].id
      }
    });

    await Task.findOrCreate({
      where: { title: 'Compra de plantines' },
      defaults: {
        title: 'Compra de plantines',
        description: 'Adquirir 1000 plantines de especies nativas apropiadas para el clima urbano',
        status: 'todo',
        dueDate: new Date('2025-03-01'),
        estimatedHours: 8,
        actualHours: 0,
        projectId: sampleProject[0].id,
        takenBy: null,
        createdBy: ongAmbiental[0].id,
        taskTypeId: tipoMateriales[0].id
      }
    });

    console.log('Datos de prueba creados correctamente');
  } catch (error) {
    console.error('Error creando datos de prueba:', error.message);
  }
};

// Exportar todo
module.exports = {
  sequelize,
  models: {
    User,
    Project,
    Task,
    TaskType,
    Commitment,
    Role
  },
  syncDatabase,
  closeConnection,
  seedData,
  testConnection
};