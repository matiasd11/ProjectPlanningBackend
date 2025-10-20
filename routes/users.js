const express = require('express');
const { models } = require('../models');
const { User, Project } = models;
const { secret, expiresIn } = require('../config/jwt');
const bonitaService = require('../services/bonitaService');

const router = express.Router();

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// GET - Listar usuarios (ONGs)
router.get('/', async (req, res) => {
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
});

// POST - Crear usuario (ONG)
router.post('/', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      organizationName,
      description,
      website,
      phone,
      role = 'ong'
    } = req.body;

    const user = await User.create({
      username,
      email,
      password,
      organizationName,
      description,
      website,
      phone,
      role
    });

    res.status(201).json({
      success: true,
      message: 'ONG registrada exitosamente',
      data: user.toSafeJSON()
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({
      success: false,
      message: 'Error creando usuario',
      error: error.message
    });
  }
});


// POST /users/login
// router.post('/login', async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     if (!username || !password)
//       return res.status(400).json({ message: 'Usuario y contraseña requeridos' });

//     const user = await User.findOne({ where: { username } });

//     if (!user)
//       return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

//     const isMatch = await user.validatePassword(password);
//     if (!isMatch)
//       return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

//     // Generar token JWT
//     const token = jwt.sign(
//       { id: user.id, username: user.username, role: user.role },
//       secret,
//       { expiresIn }
//     );

//     res.json({ token, user: user.toSafeJSON() });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error interno del servidor' });
//   }
// });

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const sessionData = await bonitaService.login(username, password);

    if (!sessionData || !sessionData.session_id) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    console.log(" Autenticación con Bonita exitosa. Session ID:", sessionData.session_id);

    //const roles = await bonitaService.getUserRoles(username);

    const token = jwt.sign(
      { username, /*roles*/ },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      token,
      user: {
        username,
        /*roles,*/
        bonitaSession: sessionData.session_id
      },
      message: 'Login exitoso',
      bonitaApiToken: bonitaService.apiToken
    });
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }
    return res.status(500).json({ message: "Error al iniciar sesión" });
  }
});


module.exports = router;