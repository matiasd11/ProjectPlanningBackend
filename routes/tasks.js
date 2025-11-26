const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

/** 
 * @route POST /api/v1/tasks/notifyCollaborativeTasks
 * @desc Notificación enviada desde Bonita indicando que existen nuevas tareas colaborativas en el cloud.
 * @param {number} projectId - ID del proyecto
*/
router.post("/notifyCollaborativeTasks", taskController.notifyCollaborativeTasks);

/**
 * @route GET /api/v1/tasks/coverage-request/:caseId/status
 * @desc Obtener estado de coverage request en Bonita
 * @param {string} caseId - ID del caso en Bonita
 */
router.get('/coverage-request/:caseId/status', taskController.getCoverageRequestStatus);

/**
 * @route GET /api/v1/tasks/local/:projectId
 * @desc Listar tareas locales (de la BD)
 * @param {number} projectId - ID del proyecto (opcional)
 */
router.get('/local/:projectId', taskController.getLocalTasks);

/**
 * @route PUT /api/v1/tasks/:taskId/take
 * @desc Voluntario toma una tarea local
 * @param {number} taskId - ID de la tarea
 * @body {number} ongId - ID de la ONG que toma la tarea
 */
router.put('/:taskId/take', taskController.takeTask);

module.exports = router;