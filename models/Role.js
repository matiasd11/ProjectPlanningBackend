const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.ENUM('ONG_PRINCIPAL', 'ONG_COLABORADORA', 'ONG_GERENCIAL'),
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: [1, 100],
      notEmpty: true
    },
    comment: 'Nombre del rol'
  }
}, {
  tableName: 'roles',
  indexes: [
    { unique: true, fields: ['name'] }
  ]
});

module.exports = Role;

