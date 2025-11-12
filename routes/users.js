const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();


// POST - Crear usuario (ONG)
router.post('/', userController.createUser);


module.exports = router;