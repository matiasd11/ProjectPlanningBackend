const axios = require('axios');

class BonitaService {
  constructor() {
    this.baseURL = process.env.BONITA_SERVER_URL || 'http://localhost:8080';
    this.apiPath = '/bonita/API';
  }

  // Crear cliente HTTP con configuración de cookies
  createHttpClient(session = null) {
    const config = {
      baseURL: `${this.baseURL}${this.apiPath}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (session && session.cookies) {
      // Convertir cookies a string
      const cookieString = session.cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
      config.headers.Cookie = cookieString;

      // Agregar token de API si existe
      const apiTokenCookie = session.cookies.find(c => c.name === 'X-Bonita-API-Token');
      if (apiTokenCookie) {
        config.headers['X-Bonita-API-Token'] = apiTokenCookie.value;
      }
    }

    return axios.create(config);
  }

  // Login a Bonita
  async login(username, password) {
    try {
      const loginData = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&redirect=false`;
      
      const response = await axios.post(
        `${this.baseURL}/bonita/loginservice`,
        loginData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          maxRedirects: 0,
          validateStatus: function (status) {
            return status >= 200 && status < 400;
          }
        }
      );

      // Extraer cookies de la respuesta
      const cookies = [];
      if (response.headers['set-cookie']) {
        response.headers['set-cookie'].forEach(cookieStr => {
          const [nameValue] = cookieStr.split(';');
          const [name, value] = nameValue.split('=');
          if (name && value) {
            cookies.push({ name: name.trim(), value: value.trim() });
          }
        });
      }

      if (cookies.length > 0) {
        // Obtener información del usuario
        const session = { cookies };
        const userInfo = await this.getCurrentUser(session);
        
        return {
          success: true,
          data: {
            cookies,
            user: userInfo
          }
        };
      } else {
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }
    } catch (error) {
      console.error('Login error:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  }

  // Logout
  async logout(session) {
    try {
      const client = this.createHttpClient(session);
      await axios.get(`${this.baseURL}/bonita/logoutservice`, {
        headers: client.defaults.headers
      });
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error.message);
      return { success: false, message: 'Logout failed' };
    }
  }

  // Validar sesión
  async validateSession(session) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get('/system/session/unusedid');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Obtener información del usuario actual
  async getCurrentUser(session) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get('/system/session/unusedid');
      
      if (response.data && response.data.user_id) {
        const userResponse = await client.get(`/identity/user/${response.data.user_id}`);
        return userResponse.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user:', error.message);
      throw error;
    }
  }

  // Obtener procesos
  async getProcesses(session, params = {}) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get('/bpm/process', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting processes:', error.message);
      throw error;
    }
  }

  // Obtener un proceso específico
  async getProcess(session, processId) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get(`/bpm/process/${processId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting process:', error.message);
      throw error;
    }
  }

  // Instanciar proceso
  async instantiateProcess(session, processId, variables = {}) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.post(
        `/bpm/process/${processId}/instantiation`,
        variables
      );
      return response.data;
    } catch (error) {
      console.error('Error instantiating process:', error.message);
      throw error;
    }
  }

  // Obtener casos (instancias de proceso)
  async getCases(session, params = {}) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get('/bpm/case', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting cases:', error.message);
      throw error;
    }
  }

  // Obtener un caso específico
  async getCase(session, caseId) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get(`/bpm/case/${caseId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting case:', error.message);
      throw error;
    }
  }

  // Obtener tareas pendientes
  async getPendingTasks(session, params = {}) {
    try {
      const client = this.createHttpClient(session);
      const userInfo = await this.getCurrentUser(session);
      const filter = `assigned_id=${userInfo.id}&state=ready`;
      const finalParams = { ...params, f: filter };
      
      const response = await client.get('/bpm/humanTask', { params: finalParams });
      return response.data;
    } catch (error) {
      console.error('Error getting pending tasks:', error.message);
      throw error;
    }
  }

  // Obtener tareas asignadas
  async getAssignedTasks(session, params = {}) {
    try {
      const client = this.createHttpClient(session);
      const userInfo = await this.getCurrentUser(session);
      const filter = `assigned_id=${userInfo.id}`;
      const finalParams = { ...params, f: filter };
      
      const response = await client.get('/bpm/humanTask', { params: finalParams });
      return response.data;
    } catch (error) {
      console.error('Error getting assigned tasks:', error.message);
      throw error;
    }
  }

  // Obtener una tarea específica
  async getTask(session, taskId) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get(`/bpm/humanTask/${taskId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting task:', error.message);
      throw error;
    }
  }

  // Asignar tarea
  async assignTask(session, taskId, userId) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.put(`/bpm/humanTask/${taskId}`, {
        assigned_id: userId
      });
      return response.data;
    } catch (error) {
      console.error('Error assigning task:', error.message);
      throw error;
    }
  }

  // Ejecutar tarea
  async executeTask(session, taskId, variables = {}) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.post(
        `/bpm/humanTask/${taskId}/execution`,
        variables
      );
      return response.data;
    } catch (error) {
      console.error('Error executing task:', error.message);
      throw error;
    }
  }

  // Obtener formulario
  async getForm(session, taskId) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get(`/form/${taskId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting form:', error.message);
      throw error;
    }
  }

  // Obtener contexto de formulario
  async getFormContext(session, taskId) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get(`/form/${taskId}/context`);
      return response.data;
    } catch (error) {
      console.error('Error getting form context:', error.message);
      throw error;
    }
  }

  // Obtener variables de proceso
  async getProcessVariables(session, caseId) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.get(`/bpm/caseVariable`, {
        params: { f: `case_id=${caseId}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting process variables:', error.message);
      throw error;
    }
  }

  // Actualizar variable de proceso
  async updateProcessVariable(session, caseId, variableName, value) {
    try {
      const client = this.createHttpClient(session);
      const response = await client.put(`/bpm/caseVariable/${caseId}/${variableName}`, {
        value: value
      });
      return response.data;
    } catch (error) {
      console.error('Error updating process variable:', error.message);
      throw error;
    }
  }
}

module.exports = new BonitaService();