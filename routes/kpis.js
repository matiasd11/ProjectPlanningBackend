const express = require('express');
const router = express.Router();
const { models } = require('../models');
const { Task } = models;
const taskController = require('../controllers/taskController');
const bonitaService = require('../services/bonitaService');
const axios = require('axios');

/**
 * @route GET /api/v1/kpis/total-tasks
 * @desc Obtiene el total de tareas combinando cloud (Bonita) y base de datos local
 */
router.get('/total-tasks', async (req, res) => {
    try {
        // 1️⃣ Obtener tareas del cloud (Bonita extension)
        let cloudTasks = 0;
        try {
            // 🔐 Autenticación con Bonita
            const loggedIn = await bonitaService.authenticate();
            if (loggedIn) {
                const url = `${bonitaService.baseURL}/API/extension/getTotalTasks`;
                console.log(`📡 Llamando a Bonita Extension POST ${url}`);

                const response = await axios.post(
                    url,
                    {},
                    {
                        headers: {
                            'Cookie': `${bonitaService.jsessionId}`,
                            'X-Bonita-API-Token': bonitaService.apiToken,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                cloudTasks = response.data?.data?.totalTasks || 0;
                console.log(`☁️ Tareas del cloud: ${cloudTasks}`);
            }
        } catch (cloudError) {
            console.warn('⚠️ Error obteniendo tareas del cloud:', cloudError.message);
            cloudTasks = 0;
        }

        // 2️⃣ Obtener tareas de la base de datos local
        const localTasksCount = await Task.count();
        console.log(`💾 Tareas locales: ${localTasksCount}`);

        // 3️⃣ Calcular el total
        const totalTasks = cloudTasks + localTasksCount;

        res.json({
            success: true,
            data: {
                cloudTasks,
                localTasks: localTasksCount,
                totalTasks,
                breakdown: {
                    cloud: cloudTasks,
                    local: localTasksCount
                }
            },
            message: `Total de tareas: ${totalTasks} (${cloudTasks} cloud + ${localTasksCount} local)`
        });

    } catch (error) {
        console.error('❌ Error en KPI total-tasks:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error calculando total de tareas',
            error: error.message
        });
    }
});

/**
 * @route GET /api/v1/kpis/total-tasks-todo
 * @desc Obtiene el total de tareas con status TODO combinando cloud (Bonita) y base de datos local
 */
router.get('/total-tasks-todo', async (req, res) => {
    try {
        // 1️⃣ Obtener tareas TODO del cloud (Bonita extension)
        let cloudTasksTodo = 0;
        try {
            // 🔐 Autenticación con Bonita
            const loggedIn = await bonitaService.authenticate();
            if (loggedIn) {
                const url = `${bonitaService.baseURL}/API/extension/getTotalTasksTodo`;
                console.log(`📡 Llamando a Bonita Extension POST ${url}`);

                const response = await axios.post(
                    url,
                    {},
                    {
                        headers: {
                            'Cookie': `${bonitaService.jsessionId}`,
                            'X-Bonita-API-Token': bonitaService.apiToken,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                cloudTasksTodo = response.data?.data?.totalTasksTodo || 0;
                console.log(`☁️ Tareas TODO del cloud: ${cloudTasksTodo}`);
            }
        } catch (cloudError) {
            console.warn('⚠️ Error obteniendo tareas TODO del cloud:', cloudError.message);
            cloudTasksTodo = 0;
        }

        // 2️⃣ Obtener tareas TODO de la base de datos local
        const localTasksTodoCount = await Task.count({
            where: {
                status: 'todo'
            }
        });
        console.log(`💾 Tareas TODO locales: ${localTasksTodoCount}`);

        // 3️⃣ Calcular el total
        const totalTasksTodo = cloudTasksTodo + localTasksTodoCount;

        res.json({
            success: true,
            data: {
                cloudTasksTodo,
                localTasksTodo: localTasksTodoCount,
                totalTasksTodo,
                breakdown: {
                    cloud: cloudTasksTodo,
                    local: localTasksTodoCount
                }
            },
            message: `Total de tareas TODO: ${totalTasksTodo} (${cloudTasksTodo} cloud + ${localTasksTodoCount} local)`
        });

    } catch (error) {
        console.error('❌ Error en KPI total-tasks-todo:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error calculando total de tareas TODO',
            error: error.message
        });
    }
});

/**
 * @route GET /api/v1/kpis/total-tasks-in-progress
 * @desc Obtiene el total de tareas con status IN-PROGRESS combinando cloud (Bonita) y base de datos local
 */
router.get('/total-tasks-in-progress', async (req, res) => {
    try {
        // 1️⃣ Obtener tareas IN-PROGRESS del cloud (Bonita extension)
        let cloudTasksInProgress = 0;
        try {
            // 🔐 Autenticación con Bonita
            const loggedIn = await bonitaService.authenticate();
            if (loggedIn) {
                const url = `${bonitaService.baseURL}/API/extension/getTotalTasksInProgress`;
                console.log(`📡 Llamando a Bonita Extension POST ${url}`);

                const response = await axios.post(
                    url,
                    {},
                    {
                        headers: {
                            'Cookie': `${bonitaService.jsessionId}`,
                            'X-Bonita-API-Token': bonitaService.apiToken,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                cloudTasksInProgress = response.data?.data?.totalTasksInProgress || 0;
                console.log(`☁️ Tareas IN-PROGRESS del cloud: ${cloudTasksInProgress}`);
            }
        } catch (cloudError) {
            console.warn('⚠️ Error obteniendo tareas IN-PROGRESS del cloud:', cloudError.message);
            cloudTasksInProgress = 0;
        }

        // 2️⃣ Obtener tareas IN-PROGRESS de la base de datos local
        const localTasksInProgressCount = await Task.count({
            where: {
                status: 'in-progress'
            }
        });
        console.log(`💾 Tareas IN-PROGRESS locales: ${localTasksInProgressCount}`);

        // 3️⃣ Calcular el total
        const totalTasksInProgress = cloudTasksInProgress + localTasksInProgressCount;

        res.json({
            success: true,
            data: {
                cloudTasksInProgress,
                localTasksInProgress: localTasksInProgressCount,
                totalTasksInProgress,
                breakdown: {
                    cloud: cloudTasksInProgress,
                    local: localTasksInProgressCount
                }
            },
            message: `Total de tareas IN-PROGRESS: ${totalTasksInProgress} (${cloudTasksInProgress} cloud + ${localTasksInProgressCount} local)`
        });

    } catch (error) {
        console.error('❌ Error en KPI total-tasks-in-progress:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error calculando total de tareas IN-PROGRESS',
            error: error.message
        });
    }
});

/**
 * @route GET /api/v1/kpis/total-tasks-done
 * @desc Obtiene el total de tareas con status DONE combinando cloud (Bonita) y base de datos local
 */
router.get('/total-tasks-done', async (req, res) => {
    try {
        // 1️⃣ Obtener tareas DONE del cloud (Bonita extension)
        let cloudTasksDone = 0;
        try {
            // 🔐 Autenticación con Bonita
            const loggedIn = await bonitaService.authenticate();
            if (loggedIn) {
                const url = `${bonitaService.baseURL}/API/extension/getTotalTasksDone`;
                console.log(`📡 Llamando a Bonita Extension POST ${url}`);

                const response = await axios.post(
                    url,
                    {},
                    {
                        headers: {
                            'Cookie': `${bonitaService.jsessionId}`,
                            'X-Bonita-API-Token': bonitaService.apiToken,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                cloudTasksDone = response.data?.data?.totalTasksDone || 0;
                console.log(`☁️ Tareas DONE del cloud: ${cloudTasksDone}`);
            }
        } catch (cloudError) {
            console.warn('⚠️ Error obteniendo tareas DONE del cloud:', cloudError.message);
            cloudTasksDone = 0;
        }

        // 2️⃣ Obtener tareas DONE de la base de datos local
        const localTasksDoneCount = await Task.count({
            where: {
                status: 'done'
            }
        });
        console.log(`💾 Tareas DONE locales: ${localTasksDoneCount}`);

        // 3️⃣ Calcular el total
        const totalTasksDone = cloudTasksDone + localTasksDoneCount;

        res.json({
            success: true,
            data: {
                cloudTasksDone,
                localTasksDone: localTasksDoneCount,
                totalTasksDone,
                breakdown: {
                    cloud: cloudTasksDone,
                    local: localTasksDoneCount
                }
            },
            message: `Total de tareas DONE: ${totalTasksDone} (${cloudTasksDone} cloud + ${localTasksDoneCount} local)`
        });

    } catch (error) {
        console.error('❌ Error en KPI total-tasks-done:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error calculando total de tareas DONE',
            error: error.message
        });
    }
});

module.exports = router;