const express = require('express');
const taskTypeController = require('../controllers/taskTypeController');
const router = express.Router();

// GET - Obtener todos los tipos de tarea
router.get('/', taskTypeController.getAllTaskTypes);

module.exports = router;
