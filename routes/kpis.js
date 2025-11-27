const express = require('express');
const router = express.Router();
const { models, sequelize } = require('../models');
const { Task } = models;
const { Op } = require('sequelize');
const taskController = require('../controllers/taskController');
const bonitaService = require('../services/bonitaService');
const axios = require('axios');

/**
 * @route GET /api/v1/kpis/total-tasks
 * @desc Obtiene el total de tareas combinando cloud (Bonita) y base de datos local con datos por día
 */
router.get('/total-tasks', async (req, res) => {
    try {
        // 1️⃣ Obtener tareas del cloud (Bonita extension)
        let cloudData = { total: 0, period: null, tasksPerDay: [] };
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

                if (response.data?.data) {
                    cloudData = response.data.data;
                }
                console.log(`☁️ Tareas del cloud - Total: ${cloudData.total}`);
            }
        } catch (cloudError) {
            console.warn('⚠️ Error obteniendo tareas del cloud:', cloudError.message);
        }

        // 2️⃣ Obtener tareas locales totales
        const localTasksCount = await Task.count();
        console.log(`💾 Tareas locales: ${localTasksCount}`);

        // 3️⃣ Obtener tareas locales por día (últimos 30 días)
        // Como no tenemos timestamps habilitados, usaremos dueDate o generaremos datos simples
        const localTasksPerDay = [];

        // Definir fecha de hace 30 días para el período
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Para simplificar, por ahora creamos una entrada con todas las tareas locales para hoy
        const today = new Date().toISOString().split('T')[0];
        if (localTasksCount > 0) {
            localTasksPerDay.push({
                get: (field) => field === 'date' ? today : localTasksCount
            });
        }

        // 4️⃣ Combinar datos por día
        const tasksPerDayMap = new Map();

        // Agregar datos del cloud
        cloudData.tasksPerDay?.forEach(day => {
            tasksPerDayMap.set(day.date, { date: day.date, total: day.total });
        });

        // Agregar datos locales
        localTasksPerDay.forEach(day => {
            const date = day.get('date');
            const localTotal = parseInt(day.get('total'));
            const existing = tasksPerDayMap.get(date);

            if (existing) {
                existing.total += localTotal;
            } else {
                tasksPerDayMap.set(date, { date, total: localTotal });
            }
        });

        // 5️⃣ Convertir a array y ordenar
        const combinedTasksPerDay = Array.from(tasksPerDayMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // 6️⃣ Calcular totales
        const totalTasks = cloudData.total + localTasksCount;

        res.json({
            success: true,
            data: {
                total: totalTasks,
                period: cloudData.period || {
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                    days: 30
                },
                tasksPerDay: combinedTasksPerDay,
                breakdown: {
                    cloud: cloudData.total,
                    local: localTasksCount
                }
            },
            message: `Total de tareas: ${totalTasks} (${cloudData.total} cloud + ${localTasksCount} local)`
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
 * @desc Obtiene el total de tareas con status TODO combinando cloud (Bonita) y base de datos local con datos por día
 */
router.get('/total-tasks-todo', async (req, res) => {
    try {
        // 1️⃣ Obtener tareas TODO del cloud (Bonita extension)
        let cloudData = { total: 0, period: null, tasksPerDay: [] };
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

                if (response.data?.data) {
                    cloudData = response.data.data;
                }
                console.log(`☁️ Tareas TODO del cloud - Total: ${cloudData.total}`);
            }
        } catch (cloudError) {
            console.warn('⚠️ Error obteniendo tareas TODO del cloud:', cloudError.message);
        }

        // 2️⃣ Obtener tareas TODO locales totales
        const localTasksTodoCount = await Task.count({
            where: { status: 'todo' }
        });
        console.log(`💾 Tareas TODO locales: ${localTasksTodoCount}`);

        // 3️⃣ Obtener tareas TODO locales por día
        const localTasksPerDay = [];

        // Definir fecha de hace 30 días para el período
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Para simplificar, por ahora creamos una entrada con todas las tareas TODO locales para hoy
        const today = new Date().toISOString().split('T')[0];
        if (localTasksTodoCount > 0) {
            localTasksPerDay.push({
                get: (field) => field === 'date' ? today : localTasksTodoCount
            });
        }

        // 4️⃣ Combinar datos por día
        const tasksPerDayMap = new Map();

        // Agregar datos del cloud
        cloudData.tasksPerDay?.forEach(day => {
            tasksPerDayMap.set(day.date, { date: day.date, total: day.total });
        });

        // Agregar datos locales
        localTasksPerDay.forEach(day => {
            const date = day.get('date');
            const localTotal = parseInt(day.get('total'));
            const existing = tasksPerDayMap.get(date);

            if (existing) {
                existing.total += localTotal;
            } else {
                tasksPerDayMap.set(date, { date, total: localTotal });
            }
        });

        // 5️⃣ Convertir a array y ordenar
        const combinedTasksPerDay = Array.from(tasksPerDayMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // 6️⃣ Calcular totales
        const totalTasksTodo = cloudData.total + localTasksTodoCount;

        res.json({
            success: true,
            data: {
                total: totalTasksTodo,
                period: cloudData.period || {
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                    days: 30
                },
                tasksPerDay: combinedTasksPerDay,
                breakdown: {
                    cloud: cloudData.total,
                    local: localTasksTodoCount
                }
            },
            message: `Total de tareas TODO: ${totalTasksTodo} (${cloudData.total} cloud + ${localTasksTodoCount} local)`
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
 * @desc Obtiene el total de tareas con status IN-PROGRESS combinando cloud (Bonita) y base de datos local con datos por día
 */
router.get('/total-tasks-in-progress', async (req, res) => {
    try {
        // 1️⃣ Obtener tareas IN-PROGRESS del cloud (Bonita extension)
        let cloudData = { total: 0, period: null, tasksPerDay: [] };
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

                if (response.data?.data) {
                    cloudData = response.data.data;
                }
                console.log(`☁️ Tareas IN-PROGRESS del cloud - Total: ${cloudData.total}`);
            }
        } catch (cloudError) {
            console.warn('⚠️ Error obteniendo tareas IN-PROGRESS del cloud:', cloudError.message);
        }

        // 2️⃣ Obtener tareas IN-PROGRESS locales totales
        const localTasksInProgressCount = await Task.count({
            where: { status: 'in-progress' }
        });
        console.log(`💾 Tareas IN-PROGRESS locales: ${localTasksInProgressCount}`);

        // 3️⃣ Obtener tareas IN-PROGRESS locales por día
        const localTasksPerDay = [];

        // Definir fecha de hace 30 días para el período
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Para simplificar, por ahora creamos una entrada con todas las tareas IN-PROGRESS locales para hoy
        const today = new Date().toISOString().split('T')[0];
        if (localTasksInProgressCount > 0) {
            localTasksPerDay.push({
                get: (field) => field === 'date' ? today : localTasksInProgressCount
            });
        }

        // 4️⃣ Combinar datos por día
        const tasksPerDayMap = new Map();

        // Agregar datos del cloud
        cloudData.tasksPerDay?.forEach(day => {
            tasksPerDayMap.set(day.date, { date: day.date, total: day.total });
        });

        // Agregar datos locales
        localTasksPerDay.forEach(day => {
            const date = day.get('date');
            const localTotal = parseInt(day.get('total'));
            const existing = tasksPerDayMap.get(date);

            if (existing) {
                existing.total += localTotal;
            } else {
                tasksPerDayMap.set(date, { date, total: localTotal });
            }
        });

        // 5️⃣ Convertir a array y ordenar
        const combinedTasksPerDay = Array.from(tasksPerDayMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // 6️⃣ Calcular totales
        const totalTasksInProgress = cloudData.total + localTasksInProgressCount;

        res.json({
            success: true,
            data: {
                total: totalTasksInProgress,
                period: cloudData.period || {
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                    days: 30
                },
                tasksPerDay: combinedTasksPerDay,
                breakdown: {
                    cloud: cloudData.total,
                    local: localTasksInProgressCount
                }
            },
            message: `Total de tareas IN-PROGRESS: ${totalTasksInProgress} (${cloudData.total} cloud + ${localTasksInProgressCount} local)`
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
 * @desc Obtiene el total de tareas con status DONE combinando cloud (Bonita) y base de datos local con datos por día
 */
router.get('/total-tasks-done', async (req, res) => {
    try {
        // 1️⃣ Obtener tareas DONE del cloud (Bonita extension)
        let cloudData = { total: 0, period: null, tasksPerDay: [] };
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

                if (response.data?.data) {
                    cloudData = response.data.data;
                }
                console.log(`☁️ Tareas DONE del cloud - Total: ${cloudData.total}`);
            }
        } catch (cloudError) {
            console.warn('⚠️ Error obteniendo tareas DONE del cloud:', cloudError.message);
        }

        // 2️⃣ Obtener tareas DONE locales totales
        const localTasksDoneCount = await Task.count({
            where: { status: 'done' }
        });
        console.log(`💾 Tareas DONE locales: ${localTasksDoneCount}`);

        // 3️⃣ Obtener tareas DONE locales por día
        const localTasksPerDay = [];

        // Definir fecha de hace 30 días para el período
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Para simplificar, por ahora creamos una entrada con todas las tareas DONE locales para hoy
        const today = new Date().toISOString().split('T')[0];
        if (localTasksDoneCount > 0) {
            localTasksPerDay.push({
                get: (field) => field === 'date' ? today : localTasksDoneCount
            });
        }

        // 4️⃣ Combinar datos por día
        const tasksPerDayMap = new Map();

        // Agregar datos del cloud
        cloudData.tasksPerDay?.forEach(day => {
            tasksPerDayMap.set(day.date, { date: day.date, total: day.total });
        });

        // Agregar datos locales
        localTasksPerDay.forEach(day => {
            const date = day.get('date');
            const localTotal = parseInt(day.get('total'));
            const existing = tasksPerDayMap.get(date);

            if (existing) {
                existing.total += localTotal;
            } else {
                tasksPerDayMap.set(date, { date, total: localTotal });
            }
        });

        // 5️⃣ Convertir a array y ordenar
        const combinedTasksPerDay = Array.from(tasksPerDayMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // 6️⃣ Calcular totales
        const totalTasksDone = cloudData.total + localTasksDoneCount;

        res.json({
            success: true,
            data: {
                total: totalTasksDone,
                period: cloudData.period || {
                    startDate: thirtyDaysAgo.toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                    days: 30
                },
                tasksPerDay: combinedTasksPerDay,
                breakdown: {
                    cloud: cloudData.total,
                    local: localTasksDoneCount
                }
            },
            message: `Total de tareas DONE: ${totalTasksDone} (${cloudData.total} cloud + ${localTasksDoneCount} local)`
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