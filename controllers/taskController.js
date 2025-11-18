const { models } = require('../models');
const { User, Task } = models;
const bonitaService = require('../services/bonitaService');
const axios = require('axios');

const taskController = {

    //===============================================================================================//
    //========================================= LOCAL TASKS =========================================//
    //===============================================================================================//

    /**
     * @desc Listar tareas locales (de la BD)
     * @param {number} projectId - ID del proyecto (opcional)
     */
    getLocalTasks: async (req, res) => {
        try {
            const { projectId } = req.params;

            const where = { isCoverageRequest: false };
            if (projectId) where.projectId = projectId;

            const tasks = await Task.findAll({
                where,
            });

            res.json({
                success: true,
                data: tasks,
            });
        } catch (error) {
            console.error('Error getting local tasks:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo tareas locales'
            });
        }
    },

    /**
     * @desc Obtener estado de coverage request en Bonita
     * @param {string} caseId - ID del caso en Bonita
     */
    getCoverageRequestStatus: async (req, res) => {
    try {
        const { caseId } = req.params;

        // Obtener información del caso en Bonita
        const caseInfo = await bonitaService.getCaseById(caseId);
        const tasks = await bonitaService.getAllTasksForCase(caseId);

        res.json({
        success: true,
        data: {
            caseId,
            state: caseInfo.state,
            currentTasks: tasks.filter(t => t.state === 'ready').map(t => ({
            id: t.id,
            name: t.name,
            state: t.state
            })),
            completedTasks: tasks.filter(t => t.state === 'completed').length,
            totalTasks: tasks.length,
            processType: 'coverage_request'
        }
        });

    } catch (error) {
        console.error('❌ Error obteniendo estado de coverage request:', error);
        res.status(500).json({
        success: false,
        message: 'Error obteniendo estado de coverage request',
        error: error.message
        });
    }
    },

    /**
     * @desc Voluntario toma una tarea local
     * @param {number} taskId - ID de la tarea
     * @body {number} ongId - ID de la ONG que toma la tarea
     */
    takeTask: async (req, res) => {
    try {
        const { taskId } = req.params;
        const { ongId } = req.body;

        if (!ongId) {
        return res.status(400).json({
            success: false,
            message: 'ongId es requerido'
        });
        }

        const task = await Task.findByPk(taskId);
        if (!task) {
        return res.status(404).json({
            success: false,
            message: 'Tarea no encontrada'
        });
        }

        // Solo permitir tomar tareas locales
        if (task.isCoverageRequest) {
        return res.status(400).json({
            success: false,
            message: 'Esta tarea es un Coverage Request, se gestiona a través de Bonita'
        });
        }

        if (task.takenBy) {
        return res.status(400).json({
            success: false,
            message: 'Esta tarea ya está tomada por otra ONG'
        });
        }

        const ong = await User.findByPk(ongId);
        if (!ong) {
        return res.status(404).json({
            success: false,
            message: 'ONG no encontrada'
        });
        }

        await task.update({ 
        takenBy: ongId,
        status: 'in_progress'
        });

        const updatedTask = await Task.findByPk(taskId, {
        include: [
            {
            model: User,
            as: 'volunteer',
            attributes: ['id', 'username', 'organizationName', 'email']
            }
        ]
        });

        res.json({
        success: true,
        message: `${ong.organizationName} se hará cargo de la tarea`,
        data: updatedTask
        });

    } catch (error) {
        console.error('Error taking task:', error);
        res.status(500).json({
        success: false,
        message: 'Error asignándose a la tarea'
        });
    }
    },


    //===============================================================================================//
    //========================================= CLOUD TASKS =========================================//
    //===============================================================================================//

    /**
     * @desc Proxy a Bonita /API/extension/getTasksByProject (envía username, password y projectId en body)
     */
    getCloudTasksByProject: async (req, res) => {
        try {
            const { username, password, projectId } = req.body;

            if (!username || !password || !projectId) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan datos requeridos en el body',
                });
            }

            // 🔐 Autenticación con Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo autenticar con Bonita',
                });
            }

            const url = `${bonitaService.baseURL}/API/extension/getTasksByProject`;
            console.log(`📡 Llamando a Bonita Extension POST ${url}`);

            // 👇 Enviamos el body JSON igual que espera el Groovy
            const response = await axios.post(
                url,
                { projectId },
                {
                    headers: {
                        'Cookie': `${bonitaService.jsessionId}`,
                        'X-Bonita-API-Token': bonitaService.apiToken,
                        'Content-Type': 'application/json',
                    },
                }
            );


            res.json({
                success: true,
                data: response.data.data || [],
            });
        } catch (error) {
            console.error(
                '❌ Error llamando a extension/getTasksByProject:',
                error.response?.data || error.message
            );
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/getTasksByProject',
                error: error.response?.data || error.message,
            });
        }
    },

    /**
     * @desc Proxy a Bonita /API/extension/cloudTasks (envía username, password y projectId en body)
     */
    getTasksExtension: async (req, res) => {
        try {
            const { username, password, projectId } = req.body;

            if (!username || !password || !projectId) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan datos requeridos en el body',
                });
            }

            // 🔐 Autenticación con Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo autenticar con Bonita',
                });
            }

            const url = `${bonitaService.baseURL}/API/extension/cloudTasks`;
            console.log(`📡 Llamando a Bonita Extension POST ${url}`);

            // 👇 Enviamos el body JSON igual que espera el Groovy
            const response = await axios.post(
                url,
                { projectId },
                {
                    headers: {
                        'Cookie': `${bonitaService.jsessionId}`,
                        'X-Bonita-API-Token': bonitaService.apiToken,
                        'Content-Type': 'application/json',
                    },
                }
            );

            res.json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            console.error(
                '❌ Error llamando a extension/tasks:',
                error.response?.data || error.message
            );
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/tasks',
                error: error.response?.data || error.message,
            });
        }
    },

    /**
     * @desc Proxy a Bonita /API/extension/commitment tras autenticación
     * @body {string} username - Usuario Bonita
     * @body {string} password - Password Bonita
     * @body {number} taskId - ID de la tarea
     * @body {number} ongId - ID de la ONG
     * @body {string} description - Descripción del compromiso
     */
    createCommitment: async (req, res) => {
        try {
            const { username, password, taskId, ongId, description } = req.body;

            if (!username || !password || !taskId || !ongId || !description) {
                return res.status(400).json({ success: false, message: 'Faltan datos requeridos en el body' });
            }

            // 🔐 Autenticación Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                return res.status(500).json({ success: false, message: 'No se pudo autenticar con Bonita' });
            }

            const url = `${bonitaService.baseURL}/API/extension/commitment`;

            console.log(`Llamando a Bonita Extension POST ${url}`);

            // 👇 Enviamos el body en formato JSON (ahora el Groovy lo interpreta bien)
            const response = await axios.post(
                url,
                {
                    taskId,
                    ongId,
                    description
                },
                {
                    headers: {
                        'Cookie': `${bonitaService.jsessionId}`,
                        'X-Bonita-API-Token': bonitaService.apiToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            res.json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            console.error('Error llamando a extension/commitment:', error.response?.data || error.message);
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/commitment',
                error: error.response?.data || error.message,
            });
        }
    },

    /**
     * @desc Proxy a Bonita /API/extension/commitmentsByTask tras autenticación
     * @body {string} username - Usuario Bonita
     * @body {string} password - Password Bonita
     * @body {number} taskId - ID de la tarea
     */
    getCommitmentsByTask: async (req, res) => {
        try {
            const { username, password, taskId } = req.body;

            if (!username || !password || !taskId) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan datos requeridos en el body',
                });
            }

            // 🔐 Autenticación Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo autenticar con Bonita',
                });
            }

            const url = `${bonitaService.baseURL}/API/extension/commitmentsByTask`;
            console.log(`📡 Llamando a Bonita Extension POST ${url}`);

            // 👇 Enviamos body plano JSON (idéntico al endpoint anterior)
            const response = await axios.post(
                url,
                { taskId },
                {
                    headers: {
                        'Cookie': `${bonitaService.jsessionId}`,
                        'X-Bonita-API-Token': bonitaService.apiToken,
                        'Content-Type': 'application/json',
                    },
                }
            );

            res.json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            console.error(
                '❌ Error llamando a extension/commitmentsByTask:',
                error.response?.data || error.message
            );
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/commitmentsByTask',
                error: error.response?.data || error.message,
            });
        }
    },

    /**
     * @desc Proxy a Bonita /API/extension/assignCommitment tras autenticación
     * @body {string} username - Usuario Bonita
     * @body {string} password - Password Bonita
     * @body {number} taskId - ID de la tarea
     * @body {number} commitmentId - ID del compromiso
     */
    assignCommitment: async (req, res) => {
        try {
            const { username, password, taskId, commitmentId } = req.body;

            if (!username || !password || !taskId || !commitmentId) {
                return res.status(400).json({ success: false, message: 'Faltan datos requeridos en el body' });
            }

            // 🔐 Autenticación Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                return res.status(500).json({ success: false, message: 'No se pudo autenticar con Bonita' });
            }

            const url = `${bonitaService.baseURL}/API/extension/assignCommitment`;

            console.log(`Llamando a Bonita Extension POST ${url}`);

            // 👇 Enviamos el body en formato JSON (ahora el Groovy lo interpreta bien)
            const response = await axios.post(
                url,
                {
                    taskId,
                    commitmentId
                },
                {
                    headers: {
                        'Cookie': `${bonitaService.jsessionId}`,
                        'X-Bonita-API-Token': bonitaService.apiToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            res.json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            console.error('Error llamando a extension/assignCommitment:', error.response?.data || error.message);
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/assignCommitment',
                error: error.response?.data || error.message,
            });
        }
    },

    /**
     * @desc Proxy a Bonita /API/extension/commitmentDone tras autenticación
     * @body {string} username - Usuario Bonita
     * @body {string} password - Password Bonita
     * @body {number} commitmentId - ID del compromiso
     */
    markCommitmentDone: async (req, res) => {
        try {
            const { username, password, commitmentId } = req.body;

            if (!username || !password || !commitmentId) {
                return res.status(400).json({ success: false, message: 'Faltan datos requeridos en el body' });
            }

            // 🔐 Autenticación Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                return res.status(500).json({ success: false, message: 'No se pudo autenticar con Bonita' });
            }

            const url = `${bonitaService.baseURL}/API/extension/commitmentDone`;

            console.log(`Llamando a Bonita Extension POST ${url}`);

            // 👇 Enviamos el body en formato JSON (ahora el Groovy lo interpreta bien)
            const response = await axios.post(
                url,
                {
                    commitmentId
                },
                {
                    headers: {
                        'Cookie': `${bonitaService.jsessionId}`,
                        'X-Bonita-API-Token': bonitaService.apiToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            res.json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            console.error('Error llamando a extension/commitmentDone:', error.response?.data || error.message);
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/commitmentDone',
                error: error.response?.data || error.message,
            });
        }
    }

};

module.exports = taskController;

