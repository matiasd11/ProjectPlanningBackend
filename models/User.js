const { sequelize, Sequelize } = require('../database/config');

const User = sequelize.define('User', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: Sequelize.STRING(100),
    allowNull: false,
    unique: true
  },
  email: {
    type: Sequelize.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: Sequelize.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  firstName: {
    type: Sequelize.STRING(100),
    field: 'first_name'
  },
  lastName: {
    type: Sequelize.STRING(100),
    field: 'last_name'
  },
  role: {
    type: Sequelize.ENUM('admin', 'manager', 'user'),
    defaultValue: 'user'
  },
  bonitaUserId: {
    type: Sequelize.STRING(50),
    field: 'bonita_user_id'
  },
  active: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  indexes: [
    { fields: ['username'] },
    { fields: ['email'] },
    { fields: ['bonita_user_id'] }
  ]
});

module.exports = User;