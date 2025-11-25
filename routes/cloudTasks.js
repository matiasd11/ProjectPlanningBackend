const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

/**
 * @route POST /api/v1/cloud-tasks/extension/getCloudTasksByProject
 * @desc Proxy a Bonita /API/extension/getTasksByProject (envía username, password y projectId en body)
 */
router.post('/extension/getCloudTasksByProject', taskController.getCloudTasksByProject);

/**
 * @route POST /api/v1/cloud-tasks/extension/getUnassignedTasksByProject
 * @desc Proxy a Bonita /API/extension/getUnassignedTasksByProject (envía username, password y projectId en body)
 */
router.post('/extension/getUnassignedTasksByProject', taskController.getUnassignedTasksByProject);

/**
 * @route POST /api/v1/cloud-tasks/extension/tasks
 * @desc Proxy a Bonita /API/extension/cloudTasks (envía username, password y projectId en body)
 */
router.post('/extension/tasks', taskController.getTasksExtension);

/**
 * @route POST /api/v1/cloud-tasks/extension/commitment
 * @desc Proxy a Bonita /API/extension/commitment tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} taskId - ID de la tarea
 * @body {number} ongId - ID de la ONG
 * @body {string} description - Descripción del compromiso
 */
router.post('/extension/commitment', taskController.createCommitment);

/**
 * @route POST /api/v1/cloud-tasks/extension/commitmentsByTask
 * @desc Proxy a Bonita /API/extension/commitmentsByTask tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} taskId - ID de la tarea
 */
router.post('/extension/commitmentsByTask', taskController.getCommitmentsByTask);

/**
 * @route POST /api/v1/cloud-tasks/extension/assignCommitment
 * @desc Proxy a Bonita /API/extension/assignCommitment tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} taskId - ID de la tarea
 * @body {number} commitmentId - ID del compromiso
 */
router.post('/extension/assignCommitment', taskController.assignCommitment);

/**
 * @route POST /api/v1/cloud-tasks/extension/commitmentDone
 * @desc Proxy a Bonita /API/extension/commitmentDone tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} commitmentId - ID del compromiso
 */
router.post('/extension/commitmentDone', taskController.markCommitmentDone);

/**
 * @route POST /api/v1/cloud-tasks/extension/getTaskObservations
 * @desc Proxy a Bonita /API/extension/getTaskObservations tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} taskId - ID de la tarea
 */
router.post('/extension/getTaskObservations', taskController.getTaskObservations);

/**
 * @route POST /api/v1/cloud-tasks/extension/taskObservation
 * @desc Proxy a Bonita /API/extension/taskObservation tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} userId - ID del usuario que crea la observación
 * @body {number} taskId - ID de la tarea
 * @body {string} observations - Descripción de la observación
 */
router.post('/extension/taskObservation', taskController.createTaskObservation);

/**
 * @route POST /api/v1/cloud-tasks/extension/resolveTaskObservation
 * @desc Proxy a Bonita /API/extension/resolveTaskObservation tras autenticación
 * @body {string} username - Usuario Bonita
 * @body {string} password - Password Bonita
 * @body {number} userId - ID del usuario que resuelve la observación
 * @body {number} observationId - ID de la observación
 * @body {string} resolution - Resolución de la observación
 */
router.post('/extension/resolveTaskObservation', taskController.markTaskObservationResolved);

module.exports = router;