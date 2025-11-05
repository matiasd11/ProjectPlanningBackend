const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();


// GET - Listar usuarios (ONGs)
router.get('/', userController.getUsers);

// POST - Crear usuario (ONG)
router.post('/', userController.createUser);


module.exports = router;