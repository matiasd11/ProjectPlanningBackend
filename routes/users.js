const express = require('express');
const { models } = require('../models');
const { User, Project } = models;

const router = express.Router();

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

module.exports = router;