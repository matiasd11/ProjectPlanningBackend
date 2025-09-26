// Ejemplo de uso del backend desde un frontend React/JavaScript

class ProjectPlanningApiClient {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.isAuthenticated = false;
    this.token = null;
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

    // Agregar token JWT si existe
    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

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
      if (result.token) {
        this.token = result.token;
      }
      
      return result;
    } catch (error) {
      this.isAuthenticated = false;
      this.token = null;
      throw error;
    }
  }

  async logout() {
    try {
      const result = await this.request('/api/auth/logout', {
        method: 'POST'
      });
      
      this.isAuthenticated = false;
      this.token = null;
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

  // PROYECTOS - Métodos principales
  
  // Crear nuevo proyecto
  async createProject(projectData) {
    return this.request('/api/projects/create', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
  }

  // Obtener proyectos del usuario
  async getMyProjects(options = {}) {
    const params = new URLSearchParams();
    
    if (options.page) params.append('page', options.page);
    if (options.limit) params.append('limit', options.limit);
    if (options.status) params.append('status', options.status);
    if (options.category) params.append('category', options.category);
    if (options.search) params.append('search', options.search);
    
    const queryString = params.toString();
    const url = `/api/projects/my-projects${queryString ? '?' + queryString : ''}`;
    
    return this.request(url);
  }

  // Obtener proyecto específico
  async getProject(projectId) {
    return this.request(`/api/projects/${projectId}`);
  }

  // Actualizar proyecto
  async updateProject(projectId, updateData) {
    return this.request(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  // Enviar proyecto a Bonita
  async submitProjectToBonita(projectId) {
    return this.request(`/api/projects/${projectId}/submit`, {
      method: 'POST'
    });
  }

  // Obtener estado del proyecto en Bonita
  async getProjectBonitaStatus(projectId) {
    return this.request(`/api/projects/${projectId}/bonita-status`);
  }

  // Eliminar proyecto
  async deleteProject(projectId) {
    return this.request(`/api/projects/${projectId}`, {
      method: 'DELETE'
    });
  }

  // BONITA - Métodos heredados del cliente anterior
  
  async getCurrentUser() {
    return this.request('/api/bonita/user/info');
  }

  async getProcesses(page = 0, count = 10, filter = '') {
    const params = new URLSearchParams({ p: page, c: count });
    if (filter) params.append('f', filter);
    
    return this.request(`/api/bonita/processes?${params}`);
  }

  async getPendingTasks(page = 0, count = 10) {
    const params = new URLSearchParams({ p: page, c: count });
    return this.request(`/api/bonita/tasks/pending?${params}`);
  }

  async executeTask(taskId, variables = {}) {
    return this.request(`/api/bonita/tasks/${taskId}/execution`, {
      method: 'POST',
      body: JSON.stringify({ variables })
    });
  }
}

// EJEMPLOS DE USO COMPLETOS

// Ejemplo 1: Crear un proyecto completo
async function createCompleteProject() {
  const api = new ProjectPlanningApiClient();
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    await api.login('admin', 'password123');
    
    // 2. Crear proyecto con formulario completo
    console.log('2. Creating project...');
    const projectData = {
      name: 'Sistema de Gestión de Inventario',
      description: 'Desarrollo de un sistema web para gestión de inventario y almacén',
      startDate: '2025-02-01',
      endDate: '2025-12-31',
      budget: 150000,
      currency: 'USD',
      priority: 'high',
      category: 'Software Development',
      managerId: 2, // ID del manager
      
      // Campos adicionales del formulario
      formFields: {
        client: 'Empresa ABC S.A.',
        technology: 'React + Node.js + MySQL',
        teamSize: 5,
        riskLevel: 'medium',
        methodology: 'Scrum',
        deliverables: ['Aplicación Web', 'API REST', 'Base de Datos', 'Documentación'],
        milestones: [
          { name: 'Análisis y Diseño', date: '2025-03-01' },
          { name: 'Desarrollo Backend', date: '2025-06-01' },
          { name: 'Desarrollo Frontend', date: '2025-09-01' },
          { name: 'Testing y Deploy', date: '2025-11-01' }
        ]
      }
    };
    
    const createdProject = await api.createProject(projectData);
    console.log('Project created:', createdProject.data);
    
    // 3. Enviar a Bonita para aprobación
    console.log('3. Submitting to Bonita...');
    const submittedProject = await api.submitProjectToBonita(createdProject.data.id);
    console.log('Project submitted:', submittedProject.data.status);
    
    // 4. Verificar estado en Bonita
    console.log('4. Checking Bonita status...');
    const bonitaStatus = await api.getProjectBonitaStatus(createdProject.data.id);
    console.log('Bonita status:', bonitaStatus.data.bonitaStatus);
    
    return createdProject.data.id;
    
  } catch (error) {
    console.error('Error in project workflow:', error.message);
    throw error;
  }
}

// Ejemplo 2: Gestión de proyectos existentes
async function manageExistingProjects() {
  const api = new ProjectPlanningApiClient();
  
  try {
    await api.login('manager', 'password123');
    
    // Obtener todos los proyectos del usuario
    const myProjects = await api.getMyProjects({
      page: 1,
      limit: 20,
      status: 'submitted'
    });
    
    console.log(`Found ${myProjects.data.length} submitted projects`);
    
    // Procesar cada proyecto
    for (const project of myProjects.data) {
      console.log(`Processing project: ${project.name}`);
      
      // Verificar estado en Bonita
      try {
        const status = await api.getProjectBonitaStatus(project.id);
        console.log(`Project ${project.name} status:`, status.data.bonitaStatus.state);
        
        // Si hay tareas pendientes, mostrarlas
        if (status.data.bonitaStatus.currentTasks?.length > 0) {
          console.log('Pending tasks:', status.data.bonitaStatus.currentTasks);
        }
        
      } catch (error) {
        console.log(`No Bonita data for project ${project.name}`);
      }
    }
    
  } catch (error) {
    console.error('Error managing projects:', error.message);
  }
}

// Ejemplo 3: Integración con React hooks
const useProjectManagement = () => {
  const [api] = useState(() => new ProjectPlanningApiClient());
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createProject = async (projectData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.createProject(projectData);
      await loadProjects(); // Recargar lista
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (options = {}) => {
    setLoading(true);
    try {
      const result = await api.getMyProjects(options);
      setProjects(result.data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitToWorkflow = async (projectId) => {
    try {
      const result = await api.submitProjectToBonita(projectId);
      await loadProjects(); // Recargar para actualizar estados
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    api,
    projects,
    loading,
    error,
    createProject,
    loadProjects,
    submitToWorkflow
  };
};

// Ejemplo 4: Componente React para formulario de proyecto
const ProjectForm = () => {
  const { createProject, loading } = useProjectManagement();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    budget: '',
    priority: 'medium',
    category: '',
    formFields: {}
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createProject(formData);
      alert('Proyecto creado exitosamente!');
      // Resetear formulario o redirigir
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Nombre del proyecto"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        required
      />
      
      <textarea
        placeholder="Descripción"
        value={formData.description}
        onChange={(e) => setFormData({...formData, description: e.target.value})}
      />
      
      <input
        type="date"
        value={formData.startDate}
        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
      />
      
      <input
        type="number"
        placeholder="Presupuesto"
        value={formData.budget}
        onChange={(e) => setFormData({...formData, budget: e.target.value})}
      />
      
      <select
        value={formData.priority}
        onChange={(e) => setFormData({...formData, priority: e.target.value})}
      >
        <option value="low">Baja</option>
        <option value="medium">Media</option>
        <option value="high">Alta</option>
        <option value="critical">Crítica</option>
      </select>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear Proyecto'}
      </button>
    </form>
  );
};

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    ProjectPlanningApiClient,
    useProjectManagement,
    createCompleteProject,
    manageExistingProjects
  };
}

// Para uso en el navegador
if (typeof window !== 'undefined') {
  window.ProjectPlanningApiClient = ProjectPlanningApiClient;
  window.useProjectManagement = useProjectManagement;
}