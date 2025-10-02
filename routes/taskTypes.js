const express = require('express');
const { models } = require('../models');
const { TaskType } = models;

const router = express.Router();

// GET - Obtener todos los tipos de tarea
router.get('/', async (req, res) => {
  try {
    const taskTypes = await TaskType.findAll({
      order: [['title', 'ASC']],
      attributes: ['id', 'title']
    });

    res.json(taskTypes);

  } catch (error) {
    console.error('Error fetching task types:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los tipos de tarea'
    });
  }
});

module.exports = router;
