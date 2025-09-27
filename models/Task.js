const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      len: [3, 150],
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    validate: {
      len: [0, 1000]
    }
  },
  status: {
    type: DataTypes.ENUM('todo', 'in_progress', 'review', 'done', 'cancelled'),
    defaultValue: 'todo',
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
    allowNull: false
  },
  dueDate: {
    type: DataTypes.DATE,
    field: 'due_date',
    validate: {
      isDate: true
    }
  },
  estimatedHours: {
    type: DataTypes.DECIMAL(5, 2),
    field: 'estimated_hours',
    validate: {
      min: 0
    }
  },
  actualHours: {
    type: DataTypes.DECIMAL(5, 2),
    field: 'actual_hours',
    validate: {
      min: 0
    }
  },
  // Foreign Keys
  projectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'project_id',
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  assignedTo: {
    type: DataTypes.INTEGER,
    field: 'assigned_to',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Metadata
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  tableName: 'tasks',
  indexes: [
    { fields: ['project_id'] },
    { fields: ['assigned_to'] },
    { fields: ['created_by'] },
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['due_date'] }
  ]
});

// Métodos de instancia
Task.prototype.isOverdue = function() {
  return this.dueDate && new Date() > this.dueDate && this.status !== 'done';
};

Task.prototype.getProgress = function() {
  const statusProgress = {
    todo: 0,
    in_progress: 25,
    review: 75,
    done: 100,
    cancelled: 0
  };
  return statusProgress[this.status] || 0;
};

module.exports = Task;