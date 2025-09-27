// 🎯 PROJECT PLANNING FRONTEND CLIENT
// Completo con todas las nuevas APIs y relaciones User -> Project -> Task

class ProjectPlanningAPI {
  constructor(baseURL = 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
  }

  // 🔧 MÉTODOS AUXILIARES
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP Error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // 🏥 HEALTH CHECK
  async healthCheck() {
    return this.request('/health');
  }

  // 📊 ESTADÍSTICAS
  async getStats() {
    return this.request('/api/stats');
  }

  // 👥 MÉTODOS DE USUARIOS
  async getUsers() {
    return this.request('/api/users');
  }

  async createUser(userData) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Ejemplo de uso para crear usuario
  async createUserExample() {
    try {
      const newUser = {
        username: 'nuevo_usuario',
        email: 'usuario@example.com',
        password: 'password123',
        firstName: 'Nuevo',
        lastName: 'Usuario',
        role: 'user'
      };

      const response = await this.createUser(newUser);
      console.log('Usuario creado:', response.data);
      return response;
    } catch (error) {
      console.error('Error creando usuario:', error);
      throw error;
    }
  }

  // 📋 MÉTODOS DE PROYECTOS
  async getProjects(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const queryString = params.toString();
    const endpoint = queryString ? `/api/projects?${queryString}` : '/api/projects';
    
    return this.request(endpoint);
  }

  async getProject(id) {
    return this.request(`/api/projects/${id}`);
  }

  async createProject(projectData) {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  // Ejemplo de uso para crear proyecto
  async createProjectExample(createdBy, managerId) {
    try {
      const newProject = {
        name: 'Proyecto de Ejemplo',
        description: 'Este es un proyecto de prueba con todas las características',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 días
        budget: 50000,
        currency: 'USD',
        priority: 'high',
        createdBy: createdBy, // ID del usuario creador
        managerId: managerId, // ID del usuario manager
        tags: ['desarrollo', 'web', 'react'],
        metadata: {
          client: 'Cliente Ejemplo',
          department: 'IT',
          technologies: ['React', 'Node.js', 'MySQL']
        }
      };

      const response = await this.createProject(newProject);
      console.log('Proyecto creado:', response.data);
      return response;
    } catch (error) {
      console.error('Error creando proyecto:', error);
      throw error;
    }
  }

  // ✅ MÉTODOS DE TAREAS
  async getTasks(projectId, filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);

    const queryString = params.toString();
    const endpoint = queryString 
      ? `/api/projects/${projectId}/tasks?${queryString}` 
      : `/api/projects/${projectId}/tasks`;
    
    return this.request(endpoint);
  }

  async createTask(projectId, taskData) {
    return this.request(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  // Ejemplo de uso para crear tarea
  async createTaskExample(projectId, assignedTo, createdBy) {
    try {
      const newTask = {
        title: 'Tarea de Ejemplo',
        description: 'Esta es una tarea de prueba con todas las características',
        priority: 'medium',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +7 días
        estimatedHours: 8,
        assignedTo: assignedTo, // ID del usuario asignado
        createdBy: createdBy, // ID del usuario creador
        tags: ['frontend', 'react', 'urgent']
      };

      const response = await this.createTask(projectId, newTask);
      console.log('Tarea creada:', response.data);
      return response;
    } catch (error) {
      console.error('Error creando tarea:', error);
      throw error;
    }
  }

  // 🎭 MÉTODOS DE DEMOSTRACIÓN COMPLETA
  async fullDemoWorkflow() {
    try {
      console.log('🚀 Iniciando demostración completa...');

      // 1. Health check
      console.log('1️⃣ Verificando servidor...');
      const health = await this.healthCheck();
      console.log('✅ Servidor OK:', health);

      // 2. Crear usuarios
      console.log('\n2️⃣ Creando usuarios...');
      const creator = await this.createUser({
        username: 'proyecto_creator',
        email: 'creator@example.com',
        password: 'password123',
        firstName: 'María',
        lastName: 'González',
        role: 'admin'
      });

      const manager = await this.createUser({
        username: 'proyecto_manager',
        email: 'manager@example.com',
        password: 'password123',
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        role: 'manager'
      });

      const developer = await this.createUser({
        username: 'developer_user',
        email: 'dev@example.com',
        password: 'password123',
        firstName: 'Ana',
        lastName: 'López',
        role: 'user'
      });

      console.log('👥 Usuarios creados:', {
        creator: creator.data.id,
        manager: manager.data.id,
        developer: developer.data.id
      });

      // 3. Crear proyecto
      console.log('\n3️⃣ Creando proyecto...');
      const project = await this.createProject({
        name: 'Sistema de Gestión Empresarial',
        description: 'Desarrollo de un sistema completo de gestión para la empresa',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        budget: 100000,
        currency: 'USD',
        priority: 'high',
        createdBy: creator.data.id,
        managerId: manager.data.id,
        tags: ['sistema', 'gestion', 'enterprise'],
        metadata: {
          client: 'Empresa ABC',
          department: 'IT',
          technologies: ['React', 'Node.js', 'MySQL', 'Docker']
        }
      });

      console.log('📋 Proyecto creado:', project.data.id);

      // 4. Crear tareas
      console.log('\n4️⃣ Creando tareas...');
      const tasks = await Promise.all([
        this.createTask(project.data.id, {
          title: 'Diseño de la arquitectura del sistema',
          description: 'Definir la arquitectura técnica y los componentes del sistema',
          priority: 'high',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedHours: 16,
          assignedTo: manager.data.id,
          createdBy: creator.data.id,
          tags: ['arquitectura', 'diseño', 'planning']
        }),
        
        this.createTask(project.data.id, {
          title: 'Desarrollo del frontend',
          description: 'Implementar la interfaz de usuario con React',
          priority: 'high',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedHours: 40,
          assignedTo: developer.data.id,
          createdBy: manager.data.id,
          tags: ['frontend', 'react', 'ui']
        }),
        
        this.createTask(project.data.id, {
          title: 'Configuración de base de datos',
          description: 'Setup inicial de MySQL y Sequelize',
          priority: 'medium',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedHours: 8,
          assignedTo: developer.data.id,
          createdBy: manager.data.id,
          tags: ['backend', 'database', 'mysql']
        })
      ]);

      console.log('✅ Tareas creadas:', tasks.map(t => t.data.id));

      // 5. Obtener datos completos
      console.log('\n5️⃣ Obteniendo datos completos...');
      
      const allUsers = await this.getUsers();
      console.log('👥 Total usuarios:', allUsers.total);

      const projectDetails = await this.getProject(project.data.id);
      console.log('📋 Proyecto con relaciones:', {
        name: projectDetails.data.name,
        creator: projectDetails.data.creator?.firstName + ' ' + projectDetails.data.creator?.lastName,
        manager: projectDetails.data.manager?.firstName + ' ' + projectDetails.data.manager?.lastName,
        totalTasks: projectDetails.data.tasks?.length || 0
      });

      const projectTasks = await this.getTasks(project.data.id);
      console.log('✅ Tareas del proyecto:', projectTasks.total);

      // 6. Estadísticas finales
      console.log('\n6️⃣ Estadísticas finales...');
      const stats = await this.getStats();
      console.log('📊 Estadísticas:', stats.data);

      console.log('\n🎉 ¡Demostración completa finalizada exitosamente!');
      
      return {
        users: allUsers.data,
        project: projectDetails.data,
        tasks: projectTasks.data,
        stats: stats.data
      };

    } catch (error) {
      console.error('❌ Error en la demostración:', error);
      throw error;
    }
  }

  // 🔍 MÉTODOS DE CONSULTA ESPECÍFICA
  async getProjectsByStatus(status) {
    return this.getProjects({ status });
  }

  async getTasksByUser(userId) {
    // Este método requeriría un endpoint adicional en el backend
    // Por ahora, podemos obtener todos los proyectos y filtrar las tareas
    console.log(`Obteniendo tareas asignadas al usuario ${userId}...`);
    const projects = await this.getProjects();
    
    let userTasks = [];
    for (const project of projects.data) {
      const projectTasks = await this.getTasks(project.id, { assignedTo: userId });
      userTasks = userTasks.concat(projectTasks.data);
    }
    
    return { success: true, data: userTasks, total: userTasks.length };
  }

  async getProjectStats(projectId) {
    const project = await this.getProject(projectId);
    const tasks = await this.getTasks(projectId);
    
    const tasksByStatus = tasks.data.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        project: project.data,
        totalTasks: tasks.total,
        tasksByStatus,
        progress: {
          completed: tasksByStatus.done || 0,
          inProgress: tasksByStatus.in_progress || 0,
          pending: tasksByStatus.todo || 0
        }
      }
    };
  }
}

// 🎯 EJEMPLOS DE USO

// Instanciar el cliente
const api = new ProjectPlanningAPI('http://localhost:5000');

// Ejemplo 1: Health check simple
console.log('=== EJEMPLO 1: Health Check ===');
api.healthCheck()
  .then(response => console.log('✅ Servidor funcionando:', response))
  .catch(error => console.error('❌ Error:', error));

// Ejemplo 2: Crear un usuario
console.log('\n=== EJEMPLO 2: Crear Usuario ===');
api.createUserExample()
  .then(response => console.log('✅ Usuario creado exitosamente'))
  .catch(error => console.error('❌ Error creando usuario:', error));

// Ejemplo 3: Obtener todos los proyectos con filtros
console.log('\n=== EJEMPLO 3: Obtener Proyectos ===');
api.getProjects({ status: 'active', page: 1, limit: 5 })
  .then(response => {
    console.log('📋 Proyectos obtenidos:', response.data.length);
    console.log('📄 Paginación:', response.pagination);
  })
  .catch(error => console.error('❌ Error:', error));

// Ejemplo 4: Workflow completo (¡Ejecuta la demostración completa!)
console.log('\n=== EJEMPLO 4: Demostración Completa ===');
// api.fullDemoWorkflow()
//   .then(result => console.log('🎉 Demostración completada:', result))
//   .catch(error => console.error('❌ Error en demostración:', error));

// 📤 EXPORTAR PARA USO EN MÓDULOS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectPlanningAPI;
}

// 🌐 DISPONIBLE GLOBALMENTE EN BROWSER
if (typeof window !== 'undefined') {
  window.ProjectPlanningAPI = ProjectPlanningAPI;
}

/*
🎯 GUÍA DE USO RÁPIDO:

1. IMPORTAR:
   const ProjectPlanningAPI = require('./frontend-usage');
   const api = new ProjectPlanningAPI('http://localhost:5000');

2. HEALTH CHECK:
   await api.healthCheck();

3. CREAR USUARIO:
   await api.createUser({
     username: 'usuario',
     email: 'email@example.com',
     password: 'password123',
     firstName: 'Nombre',
     lastName: 'Apellido'
   });

4. CREAR PROYECTO:
   await api.createProject({
     name: 'Mi Proyecto',
     description: 'Descripción del proyecto',
     createdBy: userId,
     managerId: managerId
   });

5. CREAR TAREA:
   await api.createTask(projectId, {
     title: 'Mi Tarea',
     description: 'Descripción de la tarea',
     assignedTo: userId,
     createdBy: userId
   });

6. DEMOSTRACIÓN COMPLETA:
   await api.fullDemoWorkflow();

¡Ya tenés todas las APIs listas para usar! 🚀
*/