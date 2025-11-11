const express = require('express');
const roleController = require('../controllers/roleController');
const router = express.Router();


// GET - Obtener todos los roles
router.get('/all', roleController.getAllRoles);

// GET - Obtener roles de un usuario
router.get('/username', roleController.getRolesByUsername);

module.exports = router;

