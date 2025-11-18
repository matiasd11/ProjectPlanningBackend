const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  // username: {
  //   type: DataTypes.STRING(100),
  //   allowNull: false,
  //   unique: true,
  //   validate: {
  //     len: [3, 100],
  //     notEmpty: true
  //   },
  //   comment: 'Nombre de la ONG'
  // },
  // password: {
  //   type: DataTypes.STRING(255),
  //   allowNull: false,
  //   validate: {
  //     len: [6, 255]
  //   }
  // },
  // organizationName: {
  //   type: DataTypes.STRING(150),
  //   field: 'organization_name',
  //   allowNull: false,
  //   validate: {
  //     len: [2, 150],
  //     notEmpty: true
  //   },
  //   comment: 'Nombre oficial de la ONG'
  // },
  bonitaId: {
    type: DataTypes.STRING,
    primaryKey: true,
    comment: 'ID de Bonita'
  },
}, 

{
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['bonita_id'] },
  ],
  // hooks: {
  //   // Hash password antes de crear
  //   beforeCreate: async (user) => {
  //     if (user.password) {
  //       user.password = await bcrypt.hash(user.password, 12);
  //     }
  //   },
  //   // Hash password antes de actualizar
  //   beforeUpdate: async (user) => {
  //     if (user.changed('password')) {
  //       user.password = await bcrypt.hash(user.password, 12);
  //     }
  //   }
  // }
});

// // Método para validar password
// User.prototype.validatePassword = async function(password) {
//   return await bcrypt.compare(password, this.password);
// };

// // Método para JSON seguro (sin password)
// User.prototype.toSafeJSON = function() {
//   const values = { ...this.get() };
//   delete values.password;
//   return values;
// };

module.exports = User;