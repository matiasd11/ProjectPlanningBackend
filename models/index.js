const { sequelize, testConnection } = require('../config/database');
const userController = require('../controllers/userController');
const bonitaService = require('../services/bonitaService');

// Importar todos los modelos
const User = require('./User');
const Project = require('./Project');
const Task = require('./Task');
const TaskType = require('./TaskType');
const Commitment = require('./Commitment');


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


// Función para poblar datos de prueba
const seedData = async () => {
  try {

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

    const tipoConstruccionViviendas = await TaskType.findOrCreate({
      where: { title: 'Construcción de viviendas de emergencia' },
      defaults: { title: 'Construcción de viviendas de emergencia' }
    });

    const tipoEnergia = await TaskType.findOrCreate({
      where: { title: 'Instalación de paneles solares o eólicos' },
      defaults: { title: 'Instalación de paneles solares o eólicos' }
    });

    const tipoDonacionMateriales = await TaskType.findOrCreate({
      where: { title: 'Donación de materiales de construcción' },
      defaults: { title: 'Donación de materiales de construcción' }
    });

    const tipoReforestacion = await TaskType.findOrCreate({
      where: { title: 'Reforestación o plantación de árboles' },
      defaults: { title: 'Reforestación o plantación de árboles' }
    });

    const tipoGestionResiduos = await TaskType.findOrCreate({
      where: { title: 'Gestión de residuos y reciclaje' },
      defaults: { title: 'Gestión de residuos y reciclaje' }
    });

    const tipoTecnologico = await TaskType.findOrCreate({
      where: { title: 'Equipamiento informático o tecnológico' },
      defaults: { title: 'Equipamiento informático o tecnológico' }
    });

    // Crear grupo ONGs en Bonita
    await bonitaService.createBonitaGroup();

    await bonitaService.createRoleIfNotExists(
      'ONG_PRINCIPAL',
      'ONG Principal',
      'Usuario encargado de crear proyectos'
    );

    await bonitaService.createRoleIfNotExists(
      'ONG_COLABORADORA',
      'ONG Colaboradora',
      'Usuario encargado de colaborar en proyectos'
    );

    await bonitaService.createRoleIfNotExists(
      'ONG_GERENCIAL',
      'ONG Gerencial',
      'Usuario encargado de monitorear proyectos'
    );
    

    // Crear usuarios de prueba en Bonita y guardar sus respuestas
    let bonitaUsers = [];

    let ongPrincipal = await bonitaService.createUser({
      username: 'ongPrincipal',
      password: 'ongPrincipal123!',
      organizationName: 'ongPrincipal',
      roles: ['ONG_PRINCIPAL']
    });
    bonitaUsers.push(ongPrincipal);

    let ongColaboradora = await bonitaService.createUser({
      username: 'ongColaboradora',
      password: 'ongColaboradora123!',
      organizationName: 'ongColaboradora',
      roles: ['ONG_COLABORADORA']
    });
    bonitaUsers.push(ongColaboradora);

    let ongColaboradora2 = await bonitaService.createUser({
      username: 'ongColaboradora2',
      password: 'ongColaboradora123!',
      organizationName: 'ongColaboradora2',
      roles: ['ONG_COLABORADORA']
    });
    bonitaUsers.push(ongColaboradora2);

    let ongGerencial = await bonitaService.createUser({
      username: 'ongGerencial',
      password: 'ongGerencial123!',
      organizationName: 'ongGerencial',
      roles: ['ONG_GERENCIAL']
    });
    bonitaUsers.push(ongGerencial);

    // Guardar cada usuario de Bonita en la base de datos
    if (bonitaUsers && bonitaUsers.length > 0) {

      for (const bonitaUser of bonitaUsers) {
        try {
          await User.findOrCreate({
            where: { bonitaId: bonitaUser.id },
            defaults: {
              bonitaId: bonitaUser.id
            }
          });
          console.log(`✅ Usuario guardado en base de datos: ${bonitaUser.userName || bonitaUser.username} (Bonita ID: ${bonitaUser.id})`);
        } catch (error) {
          console.error(`❌ Error guardando usuario ${bonitaUser.id}:`, error.message);
        }
      }
      
      console.log(`✅ ${bonitaUsers.length} usuarios procesados correctamente`);
    } else {
      console.log('ℹ️ No hay usuarios en el grupo de Bonita para guardar');
    }

    


    // Crear proyecto de ejemplo
    // const proyectoReforestacionUrbana2025 = await Project.findOrCreate({
    //   where: { name: 'Reforestación Urbana 2025' },
    //   defaults: {
    //     name: 'Reforestación Urbana 2025',
    //     description: 'Proyecto para plantar 1000 árboles en zonas urbanas de Buenos Aires',
    //     startDate: new Date('2025-01-01'),
    //     endDate: new Date('2025-12-31'),
    //     status: 'active',
    //     progress: 15,
    //     createdBy: ongPrincipal[0].id
    //   }
    // });

    // // Crear tareas de ejemplo
    // await Task.findOrCreate({
    //   where: { title: 'Selección de ubicaciones' },
    //   defaults: {
    //     title: 'Selección de ubicaciones',
    //     description: 'Mapear y seleccionar las 50 ubicaciones prioritarias para la plantación',
    //     status: 'done',
    //     dueDate: new Date('2025-02-15'),
    //     estimatedHours: 20,
    //     actualHours: 18,
    //     projectId: proyectoReforestacionUrbana2025[0].id,
    //     takenBy: ongColaboradora1[0].id,
    //     createdBy: ongPrincipal[0].id,
    //     taskTypeId: tipoEconomico[0].id
    //   }
    // });

    // await Task.findOrCreate({
    //   where: { title: 'Compra de plantines' },
    //   defaults: {
    //     title: 'Compra de plantines',
    //     description: 'Adquirir 1000 plantines de especies nativas apropiadas para el clima urbano',
    //     status: 'todo',
    //     dueDate: new Date('2025-03-01'),
    //     estimatedHours: 8,
    //     actualHours: 0,
    //     projectId: proyectoReforestacionUrbana2025[0].id,
    //     takenBy: null,
    //     createdBy: ongPrincipal[0].id,
    //     taskTypeId: tipoMateriales[0].id
    //   }
    // });

    console.log('Datos de prueba creados correctamente');
  } catch (error) {
    console.error('Error creando datos de prueba:', error.message);
  }
};

module.exports = {
  sequelize,
  models: {
    User,
    Project,
    Task,
    TaskType,
    Commitment,
  },
  syncDatabase,
  closeConnection,
  seedData,
  testConnection
};