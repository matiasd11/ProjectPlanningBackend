const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [3, 100],
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    validate: {
      len: [0, 2000]
    }
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_date',
    validate: {
      isDate: true,
      notEmpty: true
    }
  },
  endDate: {
    type: DataTypes.DATE,
    field: 'end_date',
    validate: {
      isDate: true,
      isAfterStart(value) {
        if (value && this.startDate && value <= this.startDate) {
          throw new Error('End date must be after start date');
        }
      }
    }
  },
  status: {
    type: DataTypes.ENUM(
      'GENERADO',
      'PLANIFICADO', 
      'EN_EJECUCION',
      'COMPLETADO',
    ),
    defaultValue: 'GENERADO',
    allowNull: false
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  // Foreign Key para el creador
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'bonita_id'
    }
  },
  // Referencia al caso en Bonita BPM
  bonitaCaseId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'bonita_case_id',
    comment: 'ID del caso en Bonita BPM'
  }
}, {
  tableName: 'projects',
  indexes: [
    { fields: ['created_by'] },
    { fields: ['status'] },
    { fields: ['start_date'] },
    { fields: ['end_date'] },
    { fields: ['bonita_case_id'] }
  ],
  hooks: {
    beforeValidate: (project) => {
      // Validaciones personalizadas
      if (project.endDate && project.startDate && project.endDate <= project.startDate) {
        throw new Error('End date must be after start date');
      }
    }
  }
});

// Métodos de instancia
Project.prototype.isOverdue = function() {
  return this.endDate && new Date() > this.endDate && this.status !== 'completed';
};

Project.prototype.getDuration = function() {
  if (!this.startDate || !this.endDate) return null;
  const diff = new Date(this.endDate) - new Date(this.startDate);
  return Math.ceil(diff / (1000 * 60 * 60 * 24)); // días
};

Project.prototype.getStatusColor = function() {
  const colors = {
    draft: '#gray',
    planning: '#blue', 
    active: '#green',
    on_hold: '#yellow',
    completed: '#success',
    cancelled: '#red'
  };
  return colors[this.status] || '#gray';
};

module.exports = Project;