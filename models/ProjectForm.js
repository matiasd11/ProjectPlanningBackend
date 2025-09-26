const { sequelize, Sequelize } = require('../database/config');
const Project = require('./Project');

const ProjectForm = sequelize.define('ProjectForm', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  projectId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    field: 'project_id',
    references: {
      model: Project,
      key: 'id'
    }
  },
  fieldName: {
    type: Sequelize.STRING(100),
    allowNull: false,
    field: 'field_name'
  },
  fieldValue: {
    type: Sequelize.TEXT,
    field: 'field_value'
  },
  fieldType: {
    type: Sequelize.ENUM('text', 'number', 'date', 'boolean', 'json'),
    defaultValue: 'text',
    field: 'field_type'
  }
}, {
  tableName: 'project_forms',
  indexes: [
    { 
      fields: ['project_id', 'field_name'],
      unique: true,
      name: 'unique_project_field'
    }
  ]
});

// Definir asociaciones
ProjectForm.belongsTo(Project, { 
  foreignKey: 'projectId',
  onDelete: 'CASCADE'
});
Project.hasMany(ProjectForm, { 
  foreignKey: 'projectId',
  as: 'formFields'
});

module.exports = ProjectForm;