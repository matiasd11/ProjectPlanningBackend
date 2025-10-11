const axios = require('axios');

class BonitaService {
  constructor() {
    this.baseURL = process.env.BONITA_URL || 'http://localhost:8080/bonita';
    this.username = process.env.BONITA_USERNAME || 'walter.bates';
    this.password = process.env.BONITA_PASSWORD || 'bpm';
    this.apiToken = null;
    this.jsessionId = null;
    this.processDefinitionId = process.env.BONITA_PROCESS_ID || null;
  }

  // Autenticación con Bonita
  async authenticate() {
    try {
      const response = await axios.post(`${this.baseURL}/loginservice`, 
        `username=${this.username}&password=${this.password}&redirect=false`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          withCredentials: true
        }
      );
      
      // Extraer tokens de las cookies
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        // Buscar JSESSIONID
        const sessionCookie = cookies.find(cookie => cookie.includes('JSESSIONID'));
        if (sessionCookie) {
          this.jsessionId = sessionCookie.split(';')[0];
        }
        
        // Buscar X-Bonita-API-Token
        const apiTokenCookie = cookies.find(cookie => cookie.includes('X-Bonita-API-Token'));
        if (apiTokenCookie) {
          this.apiToken = apiTokenCookie.split('=')[1].split(';')[0];
        }
      }
      
      if (this.apiToken && this.jsessionId) {
        console.log('Autenticado con Bonita BPM');
        console.log('API Token:', this.apiToken);
        console.log('Session ID:', this.jsessionId);
        return true;
      }
      
      throw new Error('No se pudo obtener el token de API o session ID');
    } catch (error) {
      console.error('Error autenticando con Bonita:', error.message);
      return false;
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

  // Iniciar una instancia del proceso
  async startProcess(projectData) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // SIEMPRE obtener el process ID más actual antes de crear el caso
      await this.getProcessDefinition();

      // Preparar las variables para Bonita en el formato correcto
      const variables = this.mapProjectDataToBonitaVariables(projectData);

      const payload = {
        processDefinitionId: this.processDefinitionId,
        variables: Object.entries(variables).map(([key, value]) => ({
          name: key,
          value: value
        }))
      };

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

      console.log('Respuesta completa de Bonita:', JSON.stringify(response.data, null, 2));
      console.log('Proceso iniciado en Bonita, Case ID:', response.data.id || response.data.caseId);
      return response.data;
    } catch (error) {
      console.error('Error iniciando proceso en Bonita:', error.response?.data || error.message);
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

  // Completar una tarea específica con variables específicas
  async completeTaskWithVariables(taskId, taskVariables) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      console.log('Completando tarea con variables específicas:', taskId);
      console.log('Variables para esta tarea:', JSON.stringify(taskVariables, null, 2));

      // Bonita requiere asignación antes de completar tareas de usuario
      // Asignar directamente al usuario autenticado (walter.bates)
      const users = await this.getBonitaUsers();
      
      // Buscar específicamente walter.bates (usuario autenticado)
      const walterUser = users.find(user => user.userName === 'walter.bates');
      const userToAssign = walterUser || users[0];
      
      if (!userToAssign) {
        throw new Error('No se encontraron usuarios en Bonita');
      }
      
      console.log(`Asignando tarea al usuario: ${userToAssign.userName} (ID: ${userToAssign.id})`);
      
      // Asignar la tarea
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
      
      console.log('Tarea asignada, completando con variables específicas...');
      
      // Completar la tarea con variables
      const response = await axios.post(
        `${this.baseURL}/API/bpm/userTask/${taskId}/execution`,
        taskVariables,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Tarea completada exitosamente con variables específicas');
      return response.data;
      
    } catch (error) {
      console.error('Error completando tarea con variables específicas:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new BonitaService();