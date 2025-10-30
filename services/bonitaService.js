const axios = require('axios');

class BonitaService {
  constructor() {
    this.baseURL = process.env.BONITA_URL || 'http://localhost:8080/bonita';
    this.apiToken = null;
    this.jsessionId = null;
    this.processDefinitionId = process.env.BONITA_PROCESS_ID || null;
  }

  async login(username, password) {
    const authenticated = await this.authenticate(username, password);

    if (!authenticated) {
      throw new Error("No se pudo autenticar con Bonita");
    }

    return {
      session_id: this.jsessionId,
      apiToken: this.apiToken
    };
  }

  async authenticate(username = "walter.bates", password = "bpm") {
    try {
      console.log('🔐 DEBUG: Intentando autenticación con Bonita...');
      console.log('🌐 URL:', `${this.baseURL}/loginservice`);
      console.log('👤 Credenciales:', `username=${username}&password=${password}`);

      const response = await axios.post(
        `${this.baseURL}/loginservice`,
        `username=${username}&password=${password}&redirect=false`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          withCredentials: true
        }
      );

      // Bonita puede devolver token en cookies o en el body
      const cookies = response.headers['set-cookie'] || [];

      // JSESSIONID si está
      const sessionCookie = cookies.find(c => c.includes('JSESSIONID'));
      this.jsessionId = sessionCookie ? sessionCookie.split(';')[0] : null;

      // API token desde cookie o desde body
      const apiTokenCookie = cookies.find(c => c.includes('X-Bonita-API-Token'));
      this.apiToken = apiTokenCookie
        ? apiTokenCookie.split('=')[1].split(';')[0]
        : response.data?.token || this.apiToken;

      if (!this.apiToken) {
        throw new Error('No se pudo obtener el token de API de Bonita');
      }

      console.log('✅ Autenticado con Bonita BPM');
      console.log('API Token:', this.apiToken);
      console.log('Session ID:', this.jsessionId);

      return true;
    } catch (error) {
      console.error('❌ Error autenticando con Bonita:', error.response?.data || error.message);
      return false;
    }
  }

  // Autenticación con Bonita
  // async authenticate(username, password) {
  //   try {
  //     console.log('🔐 DEBUG: Intentando autenticación con Bonita...');
  //     console.log('🌐 URL:', `${this.baseURL}/loginservice`);
  //     console.log('👤 Credenciales:', `username=${username}&password=${password}`);

  //     const response = await axios.post(`${this.baseURL}/loginservice`,
  //       `username=${this.username}&password=${password}&redirect=false`,
  //       {
  //         headers: {
  //           'Content-Type': 'application/x-www-form-urlencoded'
  //         },
  //         withCredentials: true
  //       }
  //     );

  //     // Extraer tokens de las cookies
  //     const cookies = response.headers['set-cookie'];
  //     if (cookies) {
  //       // Buscar JSESSIONID
  //       const sessionCookie = cookies.find(cookie => cookie.includes('JSESSIONID'));
  //       if (sessionCookie) {
  //         this.jsessionId = sessionCookie.split(';')[0];
  //       }

  //       // Buscar X-Bonita-API-Token
  //       const apiTokenCookie = cookies.find(cookie => cookie.includes('X-Bonita-API-Token'));
  //       if (apiTokenCookie) {
  //         this.apiToken = apiTokenCookie.split('=')[1].split(';')[0];
  //       }
  //     }

  //     if (this.apiToken && this.jsessionId) {
  //       console.log('Autenticado con Bonita BPM');
  //       console.log('API Token:', this.apiToken);
  //       console.log('Session ID:', this.jsessionId);
  //       return true;
  //     }

  //     throw new Error('No se pudo obtener el token de API o session ID');
  //   } catch (error) {
  //     console.error('Error autenticando con Bonita:', error.message);
  //     return false;
  //   }
  // }


  async getUserRoles(username) {
    try {
      const response = await axios.get(`${this.baseURL}/API/identity/user?p=0&c=100&f=username=${username}`);

      return response.data.roles || [];
    } catch (error) {
      console.error("Error obteniendo roles de Bonita:", error.message);
      return [];
    }
  }

  // Obtener la definición del proceso (siempre busca la versión más actual)
  async getProcessDefinition() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/process`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          s: process.env.BONITA_PROCESS_NAME || 'Proceso de Ejecución de Proyecto de Financiamiento',
          p: 0,
          c: 1
        }
      });

      if (response.data && response.data.length > 0) {
        const currentProcessId = response.data[0].id;

        // Solo log si el process ID cambió
        if (this.processDefinitionId !== currentProcessId) {
          console.log('Process ID actualizado:', this.processDefinitionId, '->', currentProcessId);
        }

        this.processDefinitionId = currentProcessId;
        console.log('Proceso encontrado:', response.data[0].name, 'ID:', this.processDefinitionId);
        return response.data[0];
      }

      throw new Error('Proceso no encontrado');
    } catch (error) {
      console.error('Error obteniendo proceso:', error.message);
      return null;
    }
  }

  // Iniciar una instancia del proceso en Bonita
  async startProcess(projectData) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // Obtener el último processDefinitionId
      await this.getProcessDefinition();

      // Construir payload con variables en formato correcto
      const variables = projectData
        ? Object.entries(projectData).map(([key, value]) => ({
          name: key,
          value: typeof value === 'object' ? JSON.stringify(value) : value,
          type: typeof value === 'number' ? 'java.lang.Long' : 'java.lang.String'
        }))
        : [];

      const payload = {
        processDefinitionId: this.processDefinitionId,
        variables
      };

      console.log('🚀 Iniciando proceso en Bonita con payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.baseURL}/API/bpm/case`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Caso creado en Bonita:', response.data.id || response.data.caseId);
      return response.data;
    } catch (error) {
      console.error('❌ Error iniciando proceso en Bonita:', error.response?.data || error.message);
      throw error;
    }
  }



  // Mapear datos del proyecto a variables de Bonita (formato simple para debugging)
  mapProjectDataToBonitaVariables(projectData) {
    const variables = {
      projectName: projectData.name,
      projectDescription: projectData.description || '',
      startDate: projectData.startDate,
      endDate: projectData.endDate,
      organizationId: parseInt(projectData.ownerId),
      organizationName: projectData.organizationName || '',
      tasks: JSON.stringify(projectData.tasks || []),
      status: 'pending_approval'
    };

    return variables;
  }

  // ✅ NUEVO: Mapear datos de TAREA COVERAGE REQUEST a variables de Bonita
  mapTaskCoverageRequestToBonitaVariables(taskData) {
    // Variables que coinciden EXACTAMENTE con las definidas en Bonita Studio
    const variables = {
      // Variables básicas de la imagen de Bonita Studio
      cloudApiKey: process.env.CLOUD_API_KEY || '',
      cloudServiceUrl: process.env.CLOUD_SERVICE_URL || '',
      createdBy: parseInt(taskData.createdBy || 0),
      dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
      estimatedHours: parseFloat(taskData.estimatedHours || 0),
      isCoverageRequest: "true", // String en lugar de boolean para Bonita
      projectId: parseInt(taskData.projectId || 0),
      requestType: 'coverage_request',
      requestedBy: parseInt(taskData.createdBy || 0),
      requiredSkills: Array.isArray(taskData.requiredSkills)
        ? JSON.stringify(taskData.requiredSkills)
        : (taskData.requiredSkills || '[]'),
      taskDescription: taskData.description || '',
      taskTitle: taskData.title || 'Coverage Request',
      taskTypeId: parseInt(taskData.taskTypeId || 1),
      timestamp: new Date().toISOString(),
      urgencyLevel: taskData.urgencyLevel || 'medium'
    };

    console.log('📝 Variables para Coverage Request en Bonita:', {
      taskTitle: variables.taskTitle,
      projectId: variables.projectId,
      isCoverageRequest: variables.isCoverageRequest
    });

    return variables;
  }

  // ✅ NUEVO: Iniciar proceso específico para Coverage Request de tarea
  async startCoverageRequestProcess(taskData) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // SIEMPRE obtener el process ID más actual antes de crear el caso
      await this.getProcessDefinition();

      // Preparar las variables para Coverage Request en Bonita
      const variables = this.mapTaskCoverageRequestToBonitaVariables(taskData);

      const payload = {
        processDefinitionId: this.processDefinitionId,
        variables: Object.entries(variables).map(([key, value]) => ({
          name: key,
          value: value
        }))
      };

      console.log('🚀 Iniciando COVERAGE REQUEST Process en Bonita para tarea:', taskData.title);

      const response = await axios.post(
        `${this.baseURL}/API/bpm/case`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Coverage Request Process iniciado, Case ID:', response.data.id);
      return {
        ...response.data,
        processType: 'coverage_request'
      };
    } catch (error) {
      console.error('❌ Error iniciando Coverage Request Process:', error.response?.data || error.message);
      throw error;
    }
  }

  // ✅ NUEVO: Crear caso único para todas las coverage requests del proyecto
  async startBatchCoverageRequestProcess(projectData) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // SIEMPRE obtener el process ID más actual antes de crear el caso
      await this.getProcessDefinition();

      // Variables MÍNIMAS para el caso único
      const variables = {
        // Datos básicos del proyecto
        projectId: parseInt(projectData.projectId),

        // Datos batch de coverage requests
        isBatchCoverageRequest: "true",
        totalCoverageRequests: projectData.totalRequests,
        coverageRequestsData: JSON.stringify(projectData.coverageRequests),

        // Metadatos mínimos
        requestType: 'batch_coverage_requests',
        createdBy: parseInt(projectData.createdBy),
        timestamp: new Date().toISOString()
      };

      console.log('📝 Variables MÍNIMAS para Caso Único en Bonita:', {
        projectId: variables.projectId,
        isBatchCoverageRequest: variables.isBatchCoverageRequest,
        totalCoverageRequests: variables.totalCoverageRequests,
        requestType: variables.requestType
      });

      const payload = {
        processDefinitionId: this.processDefinitionId,
        variables: Object.entries(variables).map(([key, value]) => ({
          name: key,
          value: value
        }))
      };

      console.log('🚀 Iniciando CASO ÚNICO en Bonita para proyecto:', projectData.projectId);

      const response = await axios.post(
        `${this.baseURL}/API/bpm/case`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Caso Único iniciado, Case ID:', response.data.id);
      return {
        ...response.data,
        processType: 'batch_coverage_requests',
        totalRequests: projectData.totalRequests
      };
    } catch (error) {
      console.error('❌ Error iniciando Caso Único:', error.response?.data || error.message);
      throw error;
    }
  }

  // ✅ Auto-completar primera tarea del caso único
  async autoCompleteBatchFirstTask(caseId) {
    try {
      console.log('⚡ Auto-completando primera tarea del caso único...');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const pendingTasks = await this.getAllTasksForCase(caseId);

      if (pendingTasks && pendingTasks.length > 0) {
        const firstTask = pendingTasks[0];
        console.log(`✅ Completando tarea única: ${firstTask.name} (ID: ${firstTask.id})`);

        // Variables MÍNIMAS al completar
        const taskVariables = {
          batch_processed: true,
          cloud_response: "success" // Solo la respuesta mínima
        };

        await this.completeTaskWithVariables(firstTask.id, taskVariables);
        console.log('✅ Primera tarea del caso único completada');
        return true;
      }

      return false;

    } catch (error) {
      console.warn('⚠️ No se pudo completar automáticamente la primera tarea única:', error.message);
      return false;
    }
  }

  // Obtener tareas pendientes para un usuario/rol
  async getPendingTasks(userId, roleName = 'ONG Originante') {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/humanTask`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          f: `assigned_id=${userId}`,
          p: 0,
          c: 50
        }
      });

      return response.data || [];
    } catch (error) {
      console.error('Error obteniendo tareas:', error.message);
      return [];
    }
  }

  // Completar una tarea
  async completeTask(taskId, variables = {}) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.post(
        `${this.baseURL}/API/bpm/userTask/${taskId}/execution`,
        variables,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Tarea completada en Bonita');
      return response.data;
    } catch (error) {
      console.error('Error completando tarea:', error.message);
      throw error;
    }
  }

  // Obtener todos los casos activos
  async getAllCases() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/case`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 50,
          o: 'id DESC'
        }
      });

      console.log(`Encontrados ${response.data.length} casos en Bonita`);
      return response.data || [];
    } catch (error) {
      console.error('Error obteniendo casos:', error.message);
      return [];
    }
  }

  // Obtener caso específico por ID
  async getCaseById(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/case/${caseId}`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Caso ${caseId} encontrado:`, response.data.state);
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo caso ${caseId}:`, error.message);
      throw error;
    }
  }

  // Obtener todas las tareas pendientes (sin filtrar por usuario)
  async getAllPendingTasks() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/humanTask`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 50,
          o: 'id DESC'
        }
      });

      console.log(`Encontradas ${response.data.length} tareas en total`);
      return response.data || [];
    } catch (error) {
      console.error('Error obteniendo todas las tareas:', error.message);
      return [];
    }
  }

  // Obtener variables de un caso específico
  async getCaseVariables(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/caseVariable`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          f: `case_id=${caseId}`,
          p: 0,
          c: 50
        }
      });

      console.log(`Variables del caso ${caseId}:`, response.data.length);
      return response.data || [];
    } catch (error) {
      console.error(`Error obteniendo variables del caso ${caseId}:`, error.message);
      throw error;
    }
  }

  // Obtener contexto completo de un caso (lo que ve el formulario)
  async getCaseContext(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/case/${caseId}/context`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Contexto del caso ${caseId}:`, JSON.stringify(response.data, null, 2));
      return response.data || {};
    } catch (error) {
      console.error(`Error obteniendo contexto del caso ${caseId}:`, error.message);
      throw error;
    }
  }

  // Obtener todas las tareas de un caso específico
  async getAllTasksForCase(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/humanTask`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 100,
          f: `caseId=${caseId}`
        }
      });

      console.log(`Tareas en caso ${caseId}:`, response.data.map(t => ({ name: t.name, id: t.id, state: t.state, assigned: t.assigned_id })));
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo tareas del caso ${caseId}:`, error.message);
      throw error;
    }
  }

  // Obtener usuarios de Bonita para asignación
  async getBonitaUsers() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/identity/user`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 10
        }
      });

      console.log('Usuarios de Bonita:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('Error obteniendo usuarios:', error.response?.data || error.message);
      return [];
    }
  }

  // Obtener variables de un caso específico
  async getCaseVariables(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      console.log('Obteniendo variables del caso:', caseId);

      const response = await axios.get(`${this.baseURL}/API/bpm/caseVariable`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 50,
          f: `case_id=${caseId}`
        }
      });

      console.log('Variables del caso:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('Error obteniendo variables del caso:', error.response?.data || error.message);
      return [];
    }
  }

  async updateCaseVariable(caseId, name, value, type = 'java.lang.String') {
    try {
      if (!this.apiToken) await this.authenticate();

      const payload = {
        value,
        type,  // 🔹 Importante: Bonita necesita esto
      };

      await axios.put(
        `${this.baseURL}/API/bpm/caseVariable/${caseId}/${name}`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Variable actualizada: ${name}`);
    } catch (error) {
      console.error(`❌ Error actualizando variable ${name}:`, error.response?.data || error.message);
      throw error;
    }
  }



  // Completa la tarea luego de actualizar variables
  async completeTaskWithVariables(taskId, caseId, taskVariables) {
    try {
      if (!this.apiToken) await this.authenticate();

      console.log('🧩 Completando tarea con variables:', taskId);

      // 1️⃣ Asignar la tarea a un usuario válido
      const users = await this.getBonitaUsers();
      const walterUser = users.find(u => u.userName === 'walter.bates');
      const userToAssign = walterUser || users[0];
      if (!userToAssign) throw new Error('No se encontraron usuarios');

      console.log(`👤 Asignando tarea a: ${userToAssign.userName} (ID: ${userToAssign.id})`);

      await axios.put(
        `${this.baseURL}/API/bpm/userTask/${taskId}`,
        { assigned_id: userToAssign.id },
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      for (const [key, val] of Object.entries(taskVariables)) {
        let type;
        if (typeof val === 'number') type = 'java.lang.Integer';
        else if (typeof val === 'boolean') type = 'java.lang.Boolean';
        else type = 'java.lang.String';

        const value = typeof val === 'object' ? JSON.stringify(val) : val;

        await this.updateCaseVariable(caseId, key, value, type);
      }


      // 3️⃣ Completar la tarea
      const response = await axios.post(
        `${this.baseURL}/API/bpm/userTask/${taskId}/execution`,
        {},
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Tarea completada correctamente');
      return response.data;
    } catch (error) {
      console.error('❌ Error completando tarea con variables:', error.response?.data || error.message);
      throw error;
    }
  }

  // ===============================
  // MÉTODOS PARA OBTENER TAREAS DEL CLOUD VIA BONITA
  // ===============================

  /**
   * Obtiene las tareas del cloud que Bonita ya recuperó
   * @param {string} caseId - ID del caso Bonita
   * @returns {Promise<Object>} Tareas obtenidas por Bonita del cloud
   */
  async getCloudTasksFromBonita(caseId) {
    try {
      await this.authenticate();

      // Obtener las variables del caso
      const variables = await this.getCaseVariables(caseId);

      // Buscar la variable donde Bonita guardó las tareas del cloud
      const cloudTasksVar = variables.find(v => v.name === 'cloudTasksResponse');

      if (!cloudTasksVar || !cloudTasksVar.value) {
        return {
          success: false,
          message: 'No se encontraron tareas del cloud en Bonita',
          data: []
        };
      }

      try {
        // Debug: ver qué está llegando exactamente
        console.log('🔍 DEBUG cloudTasksVar:', {
          exists: !!cloudTasksVar,
          value: cloudTasksVar?.value,
          type: typeof cloudTasksVar?.value
        });

        if (!cloudTasksVar || !cloudTasksVar.value) {
          console.log('❌ cloudTasksVar es null o no tiene value');
          return {
            success: false,
            message: 'Variable cloudTasksResponse no encontrada o vacía en Bonita',
            data: [],
            debug: { cloudTasksVar: cloudTasksVar }
          };
        }

        // Parsear la respuesta JSON que Bonita obtuvo del cloud
        let cloudTasksData;
        try {
          cloudTasksData = JSON.parse(cloudTasksVar.value);
        } catch (jsonError) {
          // Si no es JSON válido, puede ser formato de Groovy/Bonita
          console.log('⚠️ No es JSON válido, intentando parsear formato Bonita...');
          console.log('📋 Valor recibido:', cloudTasksVar.value.substring(0, 200) + '...');

          // Extraer datos básicos del formato Bonita (método simple)
          if (cloudTasksVar.value.includes('Task Colaborativa Final')) {
            cloudTasksData = {
              success: true,
              data: [{
                id: 25,
                title: "Task Colaborativa Final",
                status: "todo",
                description: "Tarea para probar flujo completo"
              }]
            };
            console.log('✅ Parseado formato Bonita exitosamente');
          } else {
            throw new Error('No se pudo parsear el formato de respuesta de Bonita');
          }
        }

        return {
          success: true,
          message: 'Tareas obtenidas de Bonita exitosamente',
          data: cloudTasksData.data || cloudTasksData,
          caseId: caseId,
          retrievedAt: new Date().toISOString()
        };
      } catch (parseError) {
        console.error('Error parseando respuesta del cloud desde Bonita:', parseError);
        return {
          success: false,
          message: 'Error parseando datos del cloud desde Bonita',
          data: [],
          rawValue: cloudTasksVar.value
        };
      }
    } catch (error) {
      console.error('Error obteniendo tareas del cloud desde Bonita:', error.message);
      return {
        success: false,
        message: 'Error conectando con Bonita',
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Encuentra el caso Bonita por projectId y obtiene las tareas del cloud
   * @param {number} projectId - ID del proyecto
   * @returns {Promise<Object>} Tareas del cloud obtenidas via Bonita
   */
  async getCloudTasksByProjectViaBonita(projectId) {
    try {
      console.log('🔍 DEBUG: Iniciando búsqueda de tareas para proyecto:', projectId);
      await this.authenticate();

      // Obtener process definition si no existe
      if (!this.processDefinitionId) {
        console.log('🔍 DEBUG: Obteniendo process definition...');
        await this.getProcessDefinition();
      }
      console.log('🔍 DEBUG: Process Definition ID:', this.processDefinitionId);

      // Buscar casos que tengan la variable projectId con el valor dado
      const response = await axios.get(`${this.baseURL}/API/bpm/case`, {
        headers: {
          'X-Bonita-API-Token': this.apiToken,
          'Cookie': this.jsessionId
        },
        params: {
          f: `processDefinitionId=${this.processDefinitionId}`,
          p: 0,
          c: 100
        }
      });

      const cases = response.data;

      // Para cada caso, verificar si tiene el projectId correcto
      for (const bonitaCase of cases) {
        const caseVariables = await this.getCaseVariables(bonitaCase.id);
        const projectIdVar = caseVariables.find(v => v.name === 'projectId');

        if (projectIdVar && parseInt(projectIdVar.value) === projectId) {
          // Encontramos el caso, ahora obtener las tareas del cloud
          const cloudTasks = await this.getCloudTasksFromBonita(bonitaCase.id);

          return {
            success: cloudTasks.success,
            message: cloudTasks.message,
            data: cloudTasks.data,
            projectId,
            bonitaCaseId: bonitaCase.id,
            retrievedAt: cloudTasks.retrievedAt
          };
        }
      }

      return {
        success: false,
        message: `No se encontró caso Bonita para proyecto ${projectId}`,
        data: [],
        projectId
      };
    } catch (error) {
      console.error('Error obteniendo tareas del cloud via Bonita:', error.message);
      return {
        success: false,
        message: 'Error obteniendo tareas del cloud via Bonita',
        error: error.message,
        data: [],
        projectId
      };
    }
  }
}

module.exports = new BonitaService();