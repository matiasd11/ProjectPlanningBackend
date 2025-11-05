const { models } = require('../models');
const { User, Project, Role } = models;
const bonitaService = require('../services/bonitaService');
const { validatePasswordStrength } = require('../validators/passwordValidator');

const userController = {
  
  // GET - Listar usuarios (ONGs)
  getUsers: async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Project,
            as: 'createdProjects',
            attributes: ['id', 'name', 'status']
          }
        ]
      });

      res.json({
        success: true,
        data: users,
        total: users.length
      });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo usuarios'
      });
    }
  },

  // POST - Crear usuario (ONG)
  createUser: async (req, res) => {
    try {
      const {
        username,
        password,
        roles,
        organizationName,
        // email,
        // description,
        // website,
        // phone,
      } = req.body;


      // Crear usuario en Bonita
      await bonitaService.createUser({username, password, organizationName});


      // Crear usuario en la base de datos
      // Validar que se proporcionen roles
      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar al menos un rol para el usuario',
          errors: ['El campo roles es requerido y debe ser un array no vacío']
        });
      }

      // Validar fortaleza de contraseña
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña no cumple con los requisitos de seguridad',
          errors: passwordValidation.errors
        });
      }

      // Validar que los roles existan en la base de datos
      const validRoles = await Role.findAll({
        where: {
          id: roles
        }
      });

      if (validRoles.length !== roles.length) {
        return res.status(400).json({
          success: false,
          message: 'Los roles proporcionados no son válidos',
          errors: 'Los roles proporcionados no son válidos'
        });
      }

      // Crear usuario
      const user = await User.create({
        username,
        password,
        organizationName,
        // email,
        // description,
        // website,
        // phone,
      });

      // Asignar roles al usuario
      await user.setRoles(validRoles);

      // Obtener usuario con roles para la respuesta
      const userWithRoles = await User.findByPk(user.id, {
        attributes: { exclude: ['password'] },
        include: [{
          model: Role,
          as: 'roles',
          attributes: ['id', 'name']
        }]
      });

      res.status(201).json({
        success: true,
        message: 'ONG registrada exitosamente',
        data: userWithRoles
        // data: user.toSafeJSON()
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(400).json({
        success: false,
        message: 'Error creando usuario',
        error: error.message
      });
    }
  },

};

module.exports = userController;

