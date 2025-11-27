const { models } = require('../models');
const { User, Task, Project } = models;
const { sequelize } = require('../config/database');
const bonitaService = require('../services/bonitaService');
const axios = require('axios');
// const { sendEmail } = require('../services/emailService');


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
     * @desc Marcar una tarea local como cumplida
     * @param {number} taskId - ID de la tarea
     */
    markLocalTaskAsDone: async (req, res) => {
        transaction = await sequelize.transaction();
        try {
            const { taskId } = req.params;
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'username y password son requeridos'
                });
            }

            const task = await Task.findByPk(taskId);
            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Tarea no encontrada'
                });
            }

            if (task.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    message: 'Tarea no está en estado in_progress'
                });
            }

            await task.update({ status: 'done' });

            // Se chequea si todas las tareas del proyecto están completadas para pasar el proyecto a estado COMPLETADO
            const projectId = task.projectId;
            const localTasks = [];
            const cloudTasks = [];
            let localTasksError = null;
            let cloudTasksError = null;

            // Obtener tareas locales
            try {
                const where = { isCoverageRequest: false, projectId: parseInt(projectId) };
                const tasks = await Task.findAll({ where });
                localTasks.push(...tasks);
            } catch (error) {
                console.error('Error obteniendo tareas locales:', error);
                localTasksError = error.message;
            }

            // Obtener tareas del cloud
            if (username && password) {
                try {
                    // 🔐 Autenticación con Bonita
                    const loggedIn = await bonitaService.authenticate(username, password);
                    if (loggedIn) {
                        const url = `${bonitaService.baseURL}/API/extension/getTasksByProject`;
                        console.log(`📡 Llamando a Bonita Extension POST ${url}`);

                        const response = await axios.post(
                            url,
                            { projectId: parseInt(projectId) },
                            {
                                headers: {
                                    'Cookie': `${bonitaService.jsessionId}`,
                                    'X-Bonita-API-Token': bonitaService.apiToken,
                                    'Content-Type': 'application/json',
                                },
                            }
                        );

                        // Si response.data es un array, lo agregamos directamente
                        // Si es un objeto con una propiedad data, la usamos
                        const tasks = Array.isArray(response.data)
                            ? response.data
                            : (response.data?.data || response.data?.tasks || []);

                        if (Array.isArray(tasks)) {
                            cloudTasks.push(...tasks);
                        }
                    } else {
                        cloudTasksError = 'No se pudo autenticar con Bonita';
                    }
                } catch (error) {
                    console.error('Error obteniendo tareas del cloud:', error);
                    cloudTasksError = error.response?.data || error.message;
                }
            }

            // Combinar ambas listas
            const allTasks = [...localTasks, ...cloudTasks];

            // Verificar si todas las tareas están completadas
            const allTasksCompleted = allTasks.every(task => task.status === 'done');

            // Si están todas las tareas completadas, actualizar el estado del proyecto a COMPLETADO
            if (allTasksCompleted) {
                const project = await Project.findByPk(projectId, { transaction });

                if (project && project.status !== 'COMPLETADO') {
                    project.status = 'COMPLETADO';
                    await project.save({ transaction });
                    console.log(`✅ Proyecto ${projectId} actualizado a estado COMPLETADO - Todas las tareas están completadas`);
                }
            }

            await transaction.commit();

            res.json({
                success: true,
                message: 'Tarea marcada como cumplida',
                data: task
            });
        } catch (error) {
            console.error('Error marking local task as done:', error);
            res.status(500).json({
                success: false,
                message: 'Error marcando tarea local como cumplida',
                error: error.message
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

    // /**
    //  * @desc Notificación desde Bonita de que existen nuevas tareas colaborativas en el cloud
    //  * @route POST /api/notifyCollaborativeTasks
    //  * @body {number} projectId - ID del proyecto
    //  * @body {string} message - Mensaje enviado por Bonita
    //  */
    // notifyCollaborativeTasks: async (req, res) => {
    //     try {
    //         const { projectId } = req.body;

    //         console.log("📩 Notificación colaborativa recibida desde Bonita:");
    //         console.log("Proyecto:", projectId);

    //         // --------------------------------------------
    //         // 1. Buscar ONG asociada al proyecto
    //         // --------------------------------------------
    //         const project = await Project.findByPk(projectId);

    //         if (!project) {
    //             return res.status(404).json({
    //                 error: "No existe una ONG colaborativa asociada al proyecto."
    //             });
    //         }

    //         const message = `Hola,\n\nSe han creado nuevas tareas colaborativas para el proyecto "${project.name}". Por favor, ingresa al sistema para revisarlas y asignarte a las que puedas ayudar.\n\n¡Gracias por tu colaboración!\n\nSaludos,\nEquipo de Project Planning`;

    //         // --------------------------------------------
    //         // 2. Enviar notificación (email)
    //         // --------------------------------------------

    //         // Ejemplo: enviar email
    //         await sendEmail({
    //             to: "fdmalbran@gmail.com", // mail prueba 
    //             subject: `Nuevas tareas colaborativas en "${project.name}"`,
    //             text: message,
    //             auth: {
    //                 user: process.env.GMAIL_USER,
    //                 pass: process.env.GMAIL_PASS
    //             }
    //         });

    //         return res.json({
    //             status: "OK",
    //             notified: true
    //         });

    //     } catch (err) {
    //         console.error("❌ Error en notifyCollaborativeTasks:", err);
    //         return res.status(500).json({
    //             error: "Error al procesar la notificación desde Bonita"
    //         });
    //     }
    // },

    // notifyObservation: async (req, res) => {
    //     try {


    //         console.log("📩 Notificación de observación recibida desde Bonita:");


    //         const message = `Hola,\n\nSe ha registrado una nueva observación"."\n\nPor favor ingresa al sistema para revisarla.\n\nSaludos,\nEquipo de Project Planning`;

    //         // 2. Enviar notificación a dos correos
    //         await sendEmail({
    //             to: [
    //                 "fdmalbran@gmail.com",
    //                 "fdmalbran@gmail.com" // modificar mails 
    //             ],
    //             subject: `Nueva observación"`,
    //             text: message,
    //             auth: {
    //                 user: process.env.GMAIL_USER,
    //                 pass: process.env.GMAIL_PASS
    //             }
    //         });

    //         return res.json({
    //             status: "OK",
    //             notified: true
    //         });

    //     } catch (err) {
    //         console.error("❌ Error en notifyObservation:", err);
    //         return res.status(500).json({
    //             error: "Error al procesar la notificación de observación desde Bonita"
    //         });
    //     }
    // },


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

            const tasks = response.data.data || [];

            // Obtener usuarios de Bonita para enriquecer las tareas
            let bonitaUsers = [];
            try {
                bonitaUsers = await bonitaService.getBonitaUsers();
                console.log(`✅ Obtenidos ${bonitaUsers.length} usuarios de Bonita`);
            } catch (error) {
                console.error('⚠️ Error obteniendo usuarios de Bonita:', error.message);
            }

            // Crear un mapa de usuarios por ID para búsqueda rápida
            const usersById = {};
            bonitaUsers.forEach(user => {
                usersById[user.id] = user;
            });

            // Enriquecer cada tarea con los datos del usuario asignado
            const enrichedTasks = tasks.map(task => {
                if (task.takenBy && usersById[task.takenBy]) {
                    task.takenByUser = usersById[task.takenBy];
                } else {
                    task.takenByUser = null;
                }
                return task;
            });

            res.json({
                success: true,
                data: enrichedTasks,
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
     * @desc Proxy a Bonita /API/extension/getUnassignedTasksByProject (envía username, password y projectId en body)
     */
    getUnassignedTasksByProject: async (req, res) => {
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

            const url = `${bonitaService.baseURL}/API/extension/getUnassignedTasksByProject`;
            console.log(`📡 Llamando a Bonita Extension POST ${url}`);

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

            const tasks = response.data.data || [];

            // Obtener usuarios de Bonita para enriquecer las tareas
            let bonitaUsers = [];
            try {
                bonitaUsers = await bonitaService.getBonitaUsers();
                console.log(`✅ Obtenidos ${bonitaUsers.length} usuarios de Bonita`);
            } catch (error) {
                console.error('⚠️ Error obteniendo usuarios de Bonita:', error.message);
            }

            // Crear un mapa de usuarios por ID para búsqueda rápida
            const usersById = {};
            bonitaUsers.forEach(user => {
                usersById[user.id] = user;
            });

            // Enriquecer cada tarea con los datos del usuario asignado
            const enrichedTasks = tasks.map(task => {
                if (task.takenBy && usersById[task.takenBy]) {
                    task.takenByUser = usersById[task.takenBy];
                } else {
                    task.takenByUser = null;
                }
                return task;
            });

            res.json({
                success: true,
                data: enrichedTasks,
            });
        } catch (error) {
            console.error(
                '❌ Error llamando a extension/getUnassignedTasksByProject:',
                error.response?.data || error.message
            );
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/getUnassignedTasksByProject',
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
                data: response.data.data || [],
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

            const commitments = response.data.data || [];

            // Obtener usuarios de Bonita para enriquecer los commitments
            let bonitaUsers = [];
            try {
                bonitaUsers = await bonitaService.getBonitaUsers();
                console.log(`✅ Obtenidos ${bonitaUsers.length} usuarios de Bonita para enriquecer commitments`);
            } catch (error) {
                console.error('⚠️ Error obteniendo usuarios de Bonita:', error.message);
            }

            // Crear un mapa de usuarios por ID para búsqueda rápida
            const usersById = {};
            bonitaUsers.forEach(user => {
                usersById[user.id] = user;
            });

            // Enriquecer cada commitment con los datos del usuario correspondiente al ongId
            const enrichedCommitments = commitments.map(commitment => {
                if (commitment.ongId && usersById[commitment.ongId]) {
                    commitment.ongUser = usersById[commitment.ongId];
                } else {
                    commitment.ongUser = null;
                }
                return commitment;
            });

            res.json({
                success: true,
                data: enrichedCommitments,
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
     * @body {number} projectId - ID del proyecto
     * @body {number} taskId - ID de la tarea
     * @body {number} commitmentId - ID del compromiso
     */
    assignCommitment: async (req, res) => {
        // Crear la transacción al inicio
        const transaction = await sequelize.transaction();

        try {
            const { username, password, projectId, taskId, commitmentId } = req.body;

            if (!username || !password || !projectId || !taskId || !commitmentId) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Faltan datos requeridos en el body' });
            }

            // 🔐 Autenticación Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                await transaction.rollback();
                return res.status(500).json({ success: false, message: 'No se pudo autenticar con Bonita' });
            }

            const url = `${bonitaService.baseURL}/API/extension/assignCommitment`;

            console.log(`Llamando a Bonita Extension POST ${url}`);

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

            // Consultar si existen tareas no asignadas para el proyecto
            const urlUnassignedTasks = `${bonitaService.baseURL}/API/extension/getUnassignedTasksByProject`;
            console.log(`📡 Llamando a Bonita Extension POST ${urlUnassignedTasks}`);

            const responseUnassignedTasks = await axios.post(
                urlUnassignedTasks,
                { projectId },
                {
                    headers: {
                        'Cookie': `${bonitaService.jsessionId}`,
                        'X-Bonita-API-Token': bonitaService.apiToken,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const tasksUnassigned = responseUnassignedTasks.data.data || [];

            // Si están todas las tareas asignadas, actualizar el estado del proyecto a PLANIFICADO y completar tarea de Bonita
            if (tasksUnassigned.length === 0) {
                const project = await Project.findByPk(projectId, { transaction });

                if (project && project.status !== 'PLANIFICADO') {
                    project.status = 'PLANIFICADO';
                    await project.save({ transaction });
                    console.log(`✅ Proyecto ${projectId} actualizado a estado PLANIFICADO - Todas las tareas están asignadas`);

                    // Consultar las tareas del caso en Bonita
                    console.log(`Obteniendo tareas del caso: ${project.bonitaCaseId}`);
                    const tasks = await bonitaService.getAllTasksForCase(project.bonitaCaseId);
                    console.log(`Tareas: ${JSON.stringify(tasks)}`);

                    // Completar la tarea del caso
                    await bonitaService.autoCompleteTask(tasks[0].id, {});

                }
            }

            await transaction.commit();

            res.json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            await transaction.rollback();

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
        const transaction = await sequelize.transaction();

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

            const projectId = response.data.data.task.projectId;
            const localTasks = [];
            const cloudTasks = [];
            let localTasksError = null;
            let cloudTasksError = null;

            // Obtener tareas locales
            try {
                const where = { isCoverageRequest: false, projectId: parseInt(projectId) };
                const tasks = await Task.findAll({ where });
                localTasks.push(...tasks);
            } catch (error) {
                console.error('Error obteniendo tareas locales:', error);
                localTasksError = error.message;
            }

            // Obtener tareas del cloud
            if (username && password) {
                try {
                    // 🔐 Autenticación con Bonita
                    const loggedIn = await bonitaService.authenticate(username, password);
                    if (loggedIn) {
                        const url = `${bonitaService.baseURL}/API/extension/getTasksByProject`;
                        console.log(`📡 Llamando a Bonita Extension POST ${url}`);

                        const response = await axios.post(
                            url,
                            { projectId: parseInt(projectId) },
                            {
                                headers: {
                                    'Cookie': `${bonitaService.jsessionId}`,
                                    'X-Bonita-API-Token': bonitaService.apiToken,
                                    'Content-Type': 'application/json',
                                },
                            }
                        );

                        // Si response.data es un array, lo agregamos directamente
                        // Si es un objeto con una propiedad data, la usamos
                        const tasks = Array.isArray(response.data)
                            ? response.data
                            : (response.data?.data || response.data?.tasks || []);

                        if (Array.isArray(tasks)) {
                            cloudTasks.push(...tasks);
                        }
                    } else {
                        cloudTasksError = 'No se pudo autenticar con Bonita';
                    }
                } catch (error) {
                    console.error('Error obteniendo tareas del cloud:', error);
                    cloudTasksError = error.response?.data || error.message;
                }
            }

            // Combinar ambas listas
            const allTasks = [...localTasks, ...cloudTasks];

            // Verificar si todas las tareas están completadas
            const allTasksCompleted = allTasks.every(task => task.status === 'done');

            // Si están todas las tareas completadas, actualizar el estado del proyecto a COMPLETADO
            if (allTasksCompleted) {
                const project = await Project.findByPk(projectId, { transaction });

                if (project && project.status !== 'COMPLETADO') {
                    project.status = 'COMPLETADO';
                    await project.save({ transaction });
                    console.log(`✅ Proyecto ${projectId} actualizado a estado COMPLETADO - Todas las tareas están completadas`);
                }
            }

            await transaction.commit();

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
     * @desc Proxy a Bonita /API/extension/taskObservation tras autenticación
     * @body {string} username - Usuario Bonita
     * @body {string} password - Password Bonita
     * @body {number} userId - ID del usuario que crea la observación
     * @body {number} taskId - ID de la tarea
     * @body {string} observations - Descripción de la observación
     */
    createTaskObservation: async (req, res) => {
        try {
            const { username, password, taskId, observations, userId } = req.body;

            if (!username || !password || !taskId || !observations || !userId) {
                return res.status(400).json({ success: false, message: 'Faltan datos requeridos en el body' });
            }

            // 🔐 Autenticación Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                return res.status(500).json({ success: false, message: 'No se pudo autenticar con Bonita' });
            }

            const url = `${bonitaService.baseURL}/API/extension/taskObservation`;

            console.log(`Llamando a Bonita Extension POST ${url}`);

            const response = await axios.post(
                url,
                {
                    taskId,
                    observations,
                    userId
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
                data: response.data.data || [],
            });
        } catch (error) {
            console.error('Error llamando a extension/taskObservation:', error.response?.data || error.message);
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/taskObservation',
                error: error.response?.data || error.message,
            });
        }
    },

    /**
     * @desc Proxy a Bonita /API/extension/getTaskObservations (envía username, password y taskId en body)
     * @body {string} username - Usuario Bonita
     * @body {string} password - Password Bonita
     * @body {number} taskId - ID de la tarea
     */
    getTaskObservations: async (req, res) => {
        try {
            const { username, password, taskId } = req.body;
            if (!username || !password || !taskId) {
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

            const url = `${bonitaService.baseURL}/API/extension/getTaskObservations`;
            console.log(`📡 Llamando a Bonita Extension POST ${url}`);

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
                data: response.data.data || [],
            });
        } catch (error) {
            console.error(
                '❌ Error llamando a extension/getTaskObservations:',
                error.response?.data || error.message
            );
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/getTaskObservations',
                error: error.response?.data || error.message,
            });
        }
    },

    /**
     * @desc Proxy a Bonita /API/extension/taskObservationResolved tras autenticación
     * @body {string} username - Usuario Bonita
     * @body {string} password - Password Bonita
     * @body {number} userId - ID del usuario que resuelve la observación
     * @body {number} observationId - ID de la observación
     * @body {string} resolution - Resolución de la observación
     */
    markTaskObservationResolved: async (req, res) => {
        try {
            const { username, password, observationId, userId, resolution } = req.body;
            if (!username || !password || !observationId || !userId || !resolution) {
                return res.status(400).json({ success: false, message: 'Faltan datos requeridos en el body' });
            }

            // 🔐 Autenticación Bonita
            const loggedIn = await bonitaService.authenticate(username, password);
            if (!loggedIn) {
                return res.status(500).json({ success: false, message: 'No se pudo autenticar con Bonita' });
            }

            const url = `${bonitaService.baseURL}/API/extension/taskObservationResolved`;

            console.log(`Llamando a Bonita Extension POST ${url}`);

            const response = await axios.post(
                url,
                {
                    observationId,
                    userId,
                    resolution
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
            console.error('Error llamando a extension/taskObservationResolved:', error.response?.data || error.message);
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/taskObservationResolved',
                error: error.response?.data || error.message,
            });
        }
    },

    /**
     * @desc Proxy a Bonita /API/extension/getTotalTasks sin parámetros
     */
    getTotalTasks: async (req, res) => {
        try {
            // 🔐 Autenticación con Bonita usando credenciales por defecto
            const loggedIn = await bonitaService.authenticate();
            if (!loggedIn) {
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo autenticar con Bonita',
                });
            }

            const url = `${bonitaService.baseURL}/API/extension/getTotalTasks`;
            console.log(`📡 Llamando a Bonita Extension POST ${url}`);

            // 👇 No enviamos parámetros en el body
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

            res.json({
                success: true,
                data: response.data,
            });
        } catch (error) {
            console.error('❌ Error llamando a extension/getTotalTasks:', error.response?.data || error.message);
            res.status(500).json({
                success: false,
                message: 'Error llamando a extension/getTotalTasks',
                error: error.response?.data || error.message,
            });
        }
    },

};

module.exports = taskController;

