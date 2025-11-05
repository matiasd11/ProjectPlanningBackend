const express = require('express');
const roleController = require('../controllers/roleController');
const router = express.Router();


// GET - Obtener todos los roles
router.get('/', roleController.getRoles);


module.exports = router;

