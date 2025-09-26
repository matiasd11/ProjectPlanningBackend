const { sequelize, Sequelize } = require('../database/config');
const User = require('./User');

const Project = sequelize.define('Project', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: Sequelize.STRING(255),
    allowNull: false
  },
  description: {
    type: Sequelize.TEXT
  },
  startDate: {
    type: Sequelize.DATEONLY,
    field: 'start_date'
  },
  endDate: {
    type: Sequelize.DATEONLY,
    field: 'end_date'
  },
  budget: {
    type: Sequelize.DECIMAL(15, 2)
  },
  currency: {
    type: Sequelize.STRING(3),
    defaultValue: 'USD'
  },
  priority: {
    type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium'
  },
  status: {
    type: Sequelize.ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'draft'
  },
  category: {
    type: Sequelize.STRING(100)
  },
  managerId: {
    type: Sequelize.INTEGER,
    field: 'manager_id',
    references: {
      model: User,
      key: 'id'
    }
  },
  createdBy: {
    type: Sequelize.INTEGER,
    allowNull: false,
    field: 'created_by',
    references: {
      model: User,
      key: 'id'
    }
  },
  bonitaCaseId: {
    type: Sequelize.STRING(50),
    field: 'bonita_case_id'
  },
  bonitaProcessId: {
    type: Sequelize.STRING(50),
    field: 'bonita_process_id'
  }
}, {
  tableName: 'projects',
  indexes: [
    { fields: ['status'] },
    { fields: ['created_by'] },
    { fields: ['manager_id'] },
    { fields: ['bonita_case_id'] },
    { fields: ['start_date'] }
  ]
});

// Definir asociaciones
Project.belongsTo(User, { 
  foreignKey: 'createdBy', 
  as: 'creator' 
});
Project.belongsTo(User, { 
  foreignKey: 'managerId', 
  as: 'manager' 
});

User.hasMany(Project, { 
  foreignKey: 'createdBy', 
  as: 'createdProjects' 
});
User.hasMany(Project, { 
  foreignKey: 'managerId', 
  as: 'managedProjects' 
});

module.exports = Project;