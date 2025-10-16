const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Commitment = sequelize.define('Commitment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  taskId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'task_id',
    references: {
      model: 'tasks',
      key: 'id'
    }
  },
  ongId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'ong_id',
    comment: 'ONG que propone el compromiso para una tarea colaborativa'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detalles opcionales sobre el compromiso o propuesta'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'commitments',
  indexes: [
    { fields: ['task_id'] },
    { fields: ['ong_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Commitment;
