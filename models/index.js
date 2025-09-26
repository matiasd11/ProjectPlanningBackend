const { sequelize } = require('../database/config');
const User = require('./User');
const Project = require('./Project');
const ProjectForm = require('./ProjectForm');

// Inicializar todas las asociaciones
const models = {
  User,
  Project,
  ProjectForm,
  sequelize
};

// Función para sincronizar la base de datos
async function syncDatabase(force = false) {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    if (force) {
      console.log('⚠️  Dropping and recreating all tables...');
    }
    
    await sequelize.sync({ force });
    console.log('✅ Database synchronized successfully.');
    
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
}

// Función para cerrar la conexión a la base de datos
async function closeDatabase() {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
}

module.exports = {
  ...models,
  syncDatabase,
  closeDatabase
};