const bonitaService = require('../services/bonitaService');
const { models } = require('../models');
const { Project, Task } = models;
const { sequelize } = require('../config/database');
const axios = require('axios');

const projectController = {

  getProjects: async (req, res) => {
    try {
      const { status, createdBy } = req.body;
      const { Op } = require('sequelize');

      console.log('📥 Body recibido:', { status, createdBy, statusType: typeof status, createdByType: typeof createdBy });

      const where = {};
  
      if (status) {
        where.status = {
          [Op.in]: status
        };
        console.log('🔍 Filtrando por status:', status);
      }

      if (createdBy) {
        where.createdBy = createdBy;
      }

      const projects = await Project.findAll({
        where,
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: projects,
      });
    } catch (error) {
      console.error('Error getting projects:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo proyectos'
      });
    }
  },

  createProject: async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const {
        name,
        description,
        startDate,
        endDate,
        tasks = [],
        ownerId
      } = req.body;

      // Validaciones
      if (!name || !startDate || !endDate || !ownerId) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios: name, startDate, endDate, ownerId'
        });
      }

      // Verificar que la ONG existe
      const owner = await bonitaService.getBonitaUserById(ownerId);

      if (!owner) {
        return res.status(404).json({
          success: false,
          message: 'ONG no encontrada'
        });
      }

      console.log('🚀 Procesando proyecto con tareas:', {
        projectName: name,
        totalTasks: tasks.length,
        coverageRequests: tasks.filter(t => t.isCoverageRequest === true).length,
        localTasks: tasks.filter(t => t.isCoverageRequest !== true).length
      });

      // 1. CREAR PROYECTO EN BD LOCAL
      const project = await Project.create({
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        progress: 0,
        createdBy: ownerId,
        bonitaCaseId: null
      }, { transaction });

      console.log('💾 Proyecto guardado en BD local:', project.id);

      // 2. SEPARAR TAREAS SEGÚN isCoverageRequest
      const localTasks = tasks.filter(task => task.isCoverageRequest !== true);
      const coverageRequestTasks = tasks.filter(task => task.isCoverageRequest === true);

      console.log('📋 Tareas separadas:', {
        localTasks: localTasks.length,
        coverageRequests: coverageRequestTasks.length
      });

      // 3. GUARDAR TAREAS LOCALES EN BD
      const createdLocalTasks = [];
      if (localTasks.length > 0) {
        for (const taskData of localTasks) {
          const {
            title,
            description: taskDescription,
            dueDate,
            estimatedHours,
            taskTypeId,
            priority = 'medium'
          } = taskData;

          if (!title) {
            throw new Error(`Tarea local sin título encontrada`);
          }

          const task = await Task.create({
            title,
            description: taskDescription,
            status: 'todo',
            dueDate: dueDate ? new Date(dueDate) : null,
            estimatedHours: estimatedHours || 0,
            actualHours: 0,
            priority,
            projectId: project.id,
            takenBy: ownerId,
            createdBy: ownerId,
            taskTypeId: taskTypeId || 1,
            isCoverageRequest: false
          }, { transaction });

          createdLocalTasks.push(task);
        }
        console.log('💾 Tareas locales guardadas en BD:', createdLocalTasks.length);
      }

      // 4. ENVIAR TODAS LAS COVERAGE REQUESTS EN UN SOLO CASO ÚNICO
      const bonitaCoverageRequests = [];
      if (coverageRequestTasks.length > 0) {
        console.log('🚀 Enviando TODAS las Coverage Requests en UN SOLO CASO de Bonita...');
        try {
          // No enviar variables al crear el caso en Bonita
          const bonitaCase = await bonitaService.startProcess();
          const caseId = bonitaCase.id || bonitaCase.caseId;

          console.log('✅ Caso creado en Bonita:', caseId);

          const coverageRequestsData = coverageRequestTasks.length
            ? coverageRequestTasks.map(task => ({
              title: task.title || '',
              description: task.description || '',
              estimatedHours: task.estimatedHours ?? 0,
              dueDate: task.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              urgencyLevel: task.urgencyLevel || 'medium',
              requiredSkills: task.requiredSkills || [],
              taskTypeId: task.taskTypeId || 1,
              createdBy: ownerId,
              projectId: project.id,
              isCoverageRequest: true,
              source: "bonita_batch_process"
            }))
            : [];

          const batchVars = {
            projectId: project.id,
            createdBy: ownerId,
            totalCoverageRequests: coverageRequestTasks.length,
            timestamp: new Date().toISOString(),
            requestType: 'batch_coverage_requests',
            isBatchCoverageRequest: true,
            coverageRequestsData: JSON.stringify(coverageRequestsData)
          };

          // Esperar 1 segundo para evitar problemas de timing
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Buscar la primera tarea humana del caso
          const tasks = await bonitaService.getAllTasksForCase(caseId);
          console.log('🧩 Tareas encontradas para el caso:', tasks);
          if (!tasks.length) throw new Error('No se encontraron tareas humanas para el caso');
          const firstTask = tasks[0];

          console.log('⚡ Completando la primera tarea del caso y enviando batchVars:', batchVars);
          const result = await bonitaService.completeTaskWithVariables(firstTask.id, caseId, batchVars);
          console.log('✅ Tarea completada:', result);
          // Actualizar proyecto con referencia al caso
          await project.update({
            bonitaCaseId: caseId
          }, { transaction });

          bonitaCoverageRequests.push({
            batchCaseId: caseId,
            totalRequests: coverageRequestTasks.length,
            requestTitles: coverageRequestTasks.map(t => t.title),
            processType: 'coverage_requests',
            firstTaskCompleted: true
          });

          console.log('✅ Caso procesado completamente:', {
            caseId: caseId,
            totalRequests: coverageRequestTasks.length,
            firstTaskCompleted: true
          });
        } catch (bonitaError) {
          console.error('❌ Error enviando caso a Bonita:', bonitaError.message);
          bonitaCoverageRequests.push({
            error: bonitaError.message,
            processType: 'coverage_requests_failed',
            firstTaskCompleted: false
          });
        }
      }

      await transaction.commit();

      // 5. RESPUESTA COMPLETA
      res.status(201).json({
        success: true,
        message: 'Proyecto creado exitosamente con caso único',
        data: {
          project: {
            ...project.toJSON(),
            creator: owner,
            bonitaCaseId: project.bonitaCaseId // Referencia al caso único
          },
          localTasks: {
            count: createdLocalTasks.length,
            tasks: createdLocalTasks.map(t => ({
              id: t.id,
              title: t.title,
              isCoverageRequest: false,
              storageLocation: 'local_database'
            }))
          },
          coverageRequests: {
            count: bonitaCoverageRequests.length,
            successful: bonitaCoverageRequests.filter(cr => !cr.error).length,
            failed: bonitaCoverageRequests.filter(cr => cr.error).length,
            requests: bonitaCoverageRequests.map(cr => ({
              batchCaseId: cr.batchCaseId,
              totalRequests: cr.totalRequests,
              requestTitles: cr.requestTitles,
              status: cr.error ? 'failed' : 'sent_to_bonita_batch',
              error: cr.error,
              firstTaskCompleted: cr.firstTaskCompleted || false,
              storageLocation: 'bonita_bmp_single_case'
            }))
          },
          summary: {
            totalTasksProcessed: tasks.length,
            savedToDatabase: createdLocalTasks.length,
            sentToBonita: bonitaCoverageRequests.filter(cr => !cr.error).length,
            processingErrors: bonitaCoverageRequests.filter(cr => cr.error).length,
            coverageRequestsAutoCompleted: bonitaCoverageRequests.filter(cr => cr.firstTaskCompleted).length,
            projectHasSingleBonitaCase: true, // Un solo caso para todas las coverage requests
            batchCoverageRequests: true // Coverage requests en batch
          }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error creando proyecto:', error);

      res.status(500).json({
        success: false,
        message: 'Error creando proyecto y procesando tareas',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
      });
    }
  },

  executeProject: async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { projectId } = req.params;

      // Validar que el proyecto existe
      const project = await Project.findByPk(projectId, { transaction });

      if (!project) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }

      // Validar que el proyecto está en estado PLANIFICADO
      if (project.status !== 'PLANIFICADO') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `El proyecto debe estar en estado PLANIFICADO para ser ejecutado. Estado actual: ${project.status}`
        });
      }

      // Validar que el proyecto tiene un caso de Bonita asociado
      if (!project.bonitaCaseId) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'El proyecto no tiene un caso de Bonita asociado'
        });
      }

      console.log(`🚀 Ejecutando proyecto ${projectId} - Cambiando estado a EN_EJECUCION`);

      // Cambiar estado del proyecto a EN_EJECUCION
      project.status = 'EN_EJECUCION';
      await project.save({ transaction });

      console.log(`✅ Proyecto ${projectId} actualizado a estado EN_EJECUCION`);

      // Recuperar y cambiar estado de las tareas del cloud a in_progress
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

      const projectTasks = response.data.data || [];

      // Actualizar cada tarea del proyecto a 'in_progress'
      console.log(`🔄 Actualizando ${projectTasks.length} tareas a estado 'in_progress'`);
      for (const task of projectTasks) {
        try {
          const updateUrl = `${bonitaService.baseURL}/API/extension/updateTaskStatus`;
          console.log(`📝 Actualizando tarea ${task.id} a 'in_progress'`);
          
          await axios.post(
            updateUrl,
            { 
              taskId: task.id, 
              status: 'in_progress' 
            },
            {
              headers: {
                'Cookie': `${bonitaService.jsessionId}`,
                'X-Bonita-API-Token': bonitaService.apiToken,
                'Content-Type': 'application/json',
              },
            }
          );
          
          console.log(`✅ Tarea ${task.id} actualizada exitosamente`);
        } catch (taskError) {
          console.error(`❌ Error al actualizar tarea ${task.id}:`, taskError.message);
          // Continuar con las demás tareas aunque falle una
        }
      }

      // Obtener las tareas del caso en Bonita
      console.log(`🔍 Obteniendo tareas del caso de Bonita: ${project.bonitaCaseId}`);
      const tasks = await bonitaService.getAllTasksForCase(project.bonitaCaseId);
      console.log(`📋 Tareas encontradas:`, tasks.map(t => ({ id: t.id, name: t.name, state: t.state })));

      if (!tasks || tasks.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'No se encontraron tareas en el caso de Bonita'
        });
      }

      // Buscar la primera tarea humana pendiente (state === 'ready')
      const humanTask = tasks.find(t => t.state === 'ready') || tasks[0];
      console.log(`⚡ Completando tarea de Bonita: ${humanTask.name} (ID: ${humanTask.id})`);

      // Completar la tarea automáticamente
      await bonitaService.autoCompleteTask(humanTask.id, {});

      console.log(`✅ Tarea de Bonita completada exitosamente`);

      await transaction.commit();

      res.json({
        success: true,
        message: 'Proyecto ejecutado exitosamente',
        data: {
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            bonitaCaseId: project.bonitaCaseId
          },
          bonitaTask: {
            id: humanTask.id,
            name: humanTask.name,
            completed: true
          }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error ejecutando proyecto:', error);

      res.status(500).json({
        success: false,
        message: 'Error ejecutando proyecto',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
      });
    }
  },

  completeProject: async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { projectId } = req.params;

      // Validar que el proyecto existe
      const project = await Project.findByPk(projectId, { transaction });

      if (!project) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }

      // Validar que el proyecto está en estado PLANIFICADO
      if (project.status !== 'EN_EJECUCION') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `El proyecto debe estar en estado EN_EJECUCION para ser completado. Estado actual: ${project.status}`
        });
      }

      // Validar que el proyecto tiene un caso de Bonita asociado
      if (!project.bonitaCaseId) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'El proyecto no tiene un caso de Bonita asociado'
        });
      }

      console.log(`🚀 Completando proyecto ${projectId} - Cambiando estado a COMPLETADO`);

      // Cambiar estado del proyecto a COMPLETADO
      project.status = 'COMPLETADO';
      await project.save({ transaction });
      console.log(`✅ Proyecto ${projectId} actualizado a estado COMPLETADO`);

      // Obtener las tareas del caso en Bonita
      console.log(`🔍 Obteniendo tareas del caso de Bonita: ${project.bonitaCaseId}`);
      const tasks = await bonitaService.getAllTasksForCase(project.bonitaCaseId);
      console.log(`📋 Tareas encontradas:`, tasks.map(t => ({ id: t.id, name: t.name, state: t.state })));

      if (!tasks || tasks.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'No se encontraron tareas en el caso de Bonita'
        });
      }

      // Buscar la primera tarea humana pendiente (state === 'ready')
      const humanTask = tasks.find(t => t.state === 'ready') || tasks[0];
      console.log(`⚡ Completando tarea de Bonita: ${humanTask.name} (ID: ${humanTask.id})`);

      // Completar la tarea automáticamente
      await bonitaService.autoCompleteTask(humanTask.id, {});

      console.log(`✅ Tarea de Bonita completada exitosamente`);

      await transaction.commit();

      res.json({
        success: true,
        message: 'Proyecto completado exitosamente',
        data: {
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            bonitaCaseId: project.bonitaCaseId
          },
          bonitaTask: {
            id: humanTask.id,
            name: humanTask.name,
            completed: true
          }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error completando proyecto:', error);

      res.status(500).json({
        success: false,
        message: 'Error completando proyecto',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
      });
    }
  },

};

module.exports = projectController;

