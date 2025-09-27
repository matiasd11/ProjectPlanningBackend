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
        console.log('✅ Autenticado con Bonita BPM');
        console.log('🔑 API Token:', this.apiToken);
        console.log('🍪 Session ID:', this.jsessionId);
        return true;
      }
      
      throw new Error('No se pudo obtener el token de API o session ID');
    } catch (error) {
      console.error('❌ Error autenticando con Bonita:', error.message);
      return false;
    }
  }

  // Obtener la definición del proceso
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
          s: process.env.BONITA_PROCESS_NAME || 'Project Management',
          p: 0,
          c: 1
        }
      });

      if (response.data && response.data.length > 0) {
        this.processDefinitionId = response.data[0].id;
        console.log('✅ Proceso encontrado:', response.data[0].name, 'ID:', this.processDefinitionId);
        return response.data[0];
      }
      
      throw new Error('Proceso no encontrado');
    } catch (error) {
      console.error('❌ Error obteniendo proceso:', error.message);
      return null;
    }
  }

  // Iniciar una instancia del proceso
  async startProcess(projectData) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      if (!this.processDefinitionId) {
        await this.getProcessDefinition();
      }

      // Preparar las variables para Bonita
      const bonitaVariables = this.mapProjectDataToBonitaVariables(projectData);

      const response = await axios.post(
        `${this.baseURL}/API/bpm/process/${this.processDefinitionId}/instantiation`,
        bonitaVariables,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📋 Respuesta completa de Bonita:', JSON.stringify(response.data, null, 2));
      console.log('✅ Proceso iniciado en Bonita, Case ID:', response.data.id || response.data.caseId);
      return response.data;
    } catch (error) {
      console.error('❌ Error iniciando proceso en Bonita:', error.message);
      throw error;
    }
  }

  // Mapear datos del proyecto a variables de Bonita (simplificado)
  mapProjectDataToBonitaVariables(projectData) {
    return {
      projectName: projectData.name,
      projectDescription: projectData.description || '',
      startDate: projectData.startDate,
      endDate: projectData.endDate,
      organizationId: parseInt(projectData.ownerId),
      organizationName: projectData.organizationName || '',
      tasks: JSON.stringify(projectData.tasks || []),
      status: 'pending_approval'
    };
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
      console.error('❌ Error obteniendo tareas:', error.message);
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

      console.log('✅ Tarea completada en Bonita');
      return response.data;
    } catch (error) {
      console.error('❌ Error completando tarea:', error.message);
      throw error;
    }
  }
}

module.exports = new BonitaService();