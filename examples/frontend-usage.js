// Ejemplo de uso del backend desde un frontend React/JavaScript

class BonitaApiClient {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.isAuthenticated = false;
  }

  // Método helper para hacer requests
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Importante para las cookies
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Autenticación
  async login(username, password) {
    try {
      const result = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      
      this.isAuthenticated = result.success;
      return result;
    } catch (error) {
      this.isAuthenticated = false;
      throw error;
    }
  }

  async logout() {
    try {
      const result = await this.request('/api/auth/logout', {
        method: 'POST'
      });
      
      this.isAuthenticated = false;
      return result;
    } catch (error) {
      throw error;
    }
  }

  async checkSession() {
    try {
      const result = await this.request('/api/auth/session');
      this.isAuthenticated = result.authenticated;
      return result;
    } catch (error) {
      this.isAuthenticated = false;
      throw error;
    }
  }

  // Usuarios
  async getCurrentUser() {
    return this.request('/api/bonita/user/info');
  }

  // Procesos
  async getProcesses(page = 0, count = 10, filter = '') {
    const params = new URLSearchParams({ p: page, c: count });
    if (filter) params.append('f', filter);
    
    return this.request(`/api/bonita/processes?${params}`);
  }

  async getProcess(processId) {
    return this.request(`/api/bonita/processes/${processId}`);
  }

  async createProcessInstance(processId, variables = {}) {
    return this.request(`/api/bonita/processes/${processId}/instantiation`, {
      method: 'POST',
      body: JSON.stringify(variables)
    });
  }

  // Casos
  async getCases(page = 0, count = 10, filter = '') {
    const params = new URLSearchParams({ p: page, c: count });
    if (filter) params.append('f', filter);
    
    return this.request(`/api/bonita/cases?${params}`);
  }

  async getCase(caseId) {
    return this.request(`/api/bonita/cases/${caseId}`);
  }

  // Tareas
  async getPendingTasks(page = 0, count = 10) {
    const params = new URLSearchParams({ p: page, c: count });
    return this.request(`/api/bonita/tasks/pending?${params}`);
  }

  async getAssignedTasks(page = 0, count = 10) {
    const params = new URLSearchParams({ p: page, c: count });
    return this.request(`/api/bonita/tasks/assigned?${params}`);
  }

  async getTask(taskId) {
    return this.request(`/api/bonita/tasks/${taskId}`);
  }

  async assignTask(taskId, userId) {
    return this.request(`/api/bonita/tasks/${taskId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ userId })
    });
  }

  async executeTask(taskId, variables = {}) {
    return this.request(`/api/bonita/tasks/${taskId}/execution`, {
      method: 'POST',
      body: JSON.stringify({ variables })
    });
  }

  // Formularios
  async getForm(taskId) {
    return this.request(`/api/bonita/forms/${taskId}`);
  }

  async getFormContext(taskId) {
    return this.request(`/api/bonita/forms/${taskId}/context`);
  }
}

// Ejemplo de uso en una aplicación
const bonitaApi = new BonitaApiClient();

// Función de ejemplo para login
async function handleLogin() {
  try {
    const result = await bonitaApi.login('install', 'install');
    console.log('Login successful:', result);
    
    // Obtener información del usuario
    const userInfo = await bonitaApi.getCurrentUser();
    console.log('User info:', userInfo);
    
    // Obtener procesos disponibles
    const processes = await bonitaApi.getProcesses();
    console.log('Available processes:', processes);
    
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}

// Función de ejemplo para trabajar con tareas
async function handleTasks() {
  try {
    // Obtener tareas pendientes
    const pendingTasks = await bonitaApi.getPendingTasks();
    console.log('Pending tasks:', pendingTasks);
    
    if (pendingTasks.length > 0) {
      const taskId = pendingTasks[0].id;
      
      // Obtener detalles de la primera tarea
      const taskDetails = await bonitaApi.getTask(taskId);
      console.log('Task details:', taskDetails);
      
      // Ejecutar la tarea (ejemplo)
      const executionResult = await bonitaApi.executeTask(taskId, {
        // Variables del proceso
        variable1: 'value1',
        variable2: 'value2'
      });
      console.log('Task execution result:', executionResult);
    }
    
  } catch (error) {
    console.error('Task handling failed:', error.message);
  }
}

// Función de ejemplo para crear una instancia de proceso
async function createProcess() {
  try {
    const processes = await bonitaApi.getProcesses();
    
    if (processes.length > 0) {
      const processId = processes[0].id;
      
      // Crear una nueva instancia del primer proceso
      const processInstance = await bonitaApi.createProcessInstance(processId, {
        // Variables iniciales del proceso
        startVariable: 'initial_value',
        requestedBy: 'user@example.com'
      });
      
      console.log('Process instance created:', processInstance);
    }
    
  } catch (error) {
    console.error('Process creation failed:', error.message);
  }
}

// Ejemplo de uso completo
async function exampleWorkflow() {
  try {
    // 1. Login
    console.log('1. Logging in...');
    await bonitaApi.login('install', 'install');
    
    // 2. Verificar sesión
    console.log('2. Checking session...');
    const session = await bonitaApi.checkSession();
    console.log('Session status:', session);
    
    // 3. Obtener procesos
    console.log('3. Getting processes...');
    const processes = await bonitaApi.getProcesses();
    console.log(`Found ${processes.length} processes`);
    
    // 4. Obtener tareas
    console.log('4. Getting tasks...');
    const tasks = await bonitaApi.getPendingTasks();
    console.log(`Found ${tasks.length} pending tasks`);
    
    // 5. Logout
    console.log('5. Logging out...');
    await bonitaApi.logout();
    
  } catch (error) {
    console.error('Workflow failed:', error.message);
  }
}

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BonitaApiClient };
}

// Para uso en el navegador
if (typeof window !== 'undefined') {
  window.BonitaApiClient = BonitaApiClient;
}

// Ejemplos de integración con React hooks
/*
// Hook personalizado para Bonita
const useBonitaApi = () => {
  const [api] = useState(() => new BonitaApiClient());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const login = async (username, password) => {
    try {
      const result = await api.login(username, password);
      setIsAuthenticated(true);
      const userInfo = await api.getCurrentUser();
      setUser(userInfo);
      return result;
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  return {
    api,
    isAuthenticated,
    user,
    login,
    logout
  };
};

// Componente de ejemplo
const ProcessList = () => {
  const { api, isAuthenticated } = useBonitaApi();
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadProcesses();
    }
  }, [isAuthenticated]);

  const loadProcesses = async () => {
    setLoading(true);
    try {
      const data = await api.getProcesses();
      setProcesses(data);
    } catch (error) {
      console.error('Failed to load processes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <div>Please log in to view processes</div>;
  }

  if (loading) {
    return <div>Loading processes...</div>;
  }

  return (
    <div>
      <h2>Available Processes</h2>
      <ul>
        {processes.map(process => (
          <li key={process.id}>
            {process.name} - {process.version}
          </li>
        ))}
      </ul>
    </div>
  );
};
*/