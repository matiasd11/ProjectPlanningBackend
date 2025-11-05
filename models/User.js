const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 100],
      notEmpty: true
    },
    comment: 'Nombre de la ONG'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [6, 255]
    }
  },
  // roles: {
  //   type: DataTypes.ARRAY(DataTypes.ENUM('ONG_PRINCIPAL', 'ONG_COLABORADORA', 'ONG_GERENCIAL')),
  //   allowNull: false,
  //   defaultValue: [],
  //   comment: 'Roles del usuario'
  // },
  organizationName: {
    type: DataTypes.STRING(150),
    field: 'organization_name',
    allowNull: false,
    validate: {
      len: [2, 150],
      notEmpty: true
    },
    comment: 'Nombre oficial de la ONG'
  },
  // email: {
  //   type: DataTypes.STRING(100),
  //   allowNull: false,
  //   unique: true,
  //   validate: {
  //     isEmail: true,
  //     notEmpty: true
  //   },
  //   comment: 'Email de contacto de la ONG'
  // },
  // description: {
  //   type: DataTypes.TEXT,
  //   comment: 'Descripción de la ONG y su misión'
  // },
  // website: {
  //   type: DataTypes.STRING(255),
  //   validate: {
  //     isUrl: true
  //   },
  //   comment: 'Sitio web de la ONG'
  // },
  // phone: {
  //   type: DataTypes.STRING(20),
  //   validate: {
  //     len: [7, 20]
  //   },
  //   comment: 'Teléfono de contacto'
  // },
  // isActive: {
  //   type: DataTypes.BOOLEAN,
  //   defaultValue: true,
  //   field: 'is_active'
  // },
  // lastLogin: {
  //   type: DataTypes.DATE,
  //   field: 'last_login'
  // }
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['username'] },
    // { unique: true, fields: ['email'] },
    // { fields: ['is_active'] },
  ],
  hooks: {
    // Hash password antes de crear
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    // Hash password antes de actualizar
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    }
  }
});

// Método para validar password
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// // Método para obtener nombre de la organización
// User.prototype.getOrganizationName = function() {
//   return this.organizationName || this.username;
// };

// Método para JSON seguro (sin password)
User.prototype.toSafeJSON = function() {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

// Método para validar que el usuario tenga al menos un rol
User.prototype.validateHasRoles = async function() {
  const roles = await this.getRoles();
  if (!roles || roles.length === 0) {
    throw new Error('El usuario debe tener al menos un rol asignado');
  }
  return true;
};

module.exports = User;