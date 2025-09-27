# 🧪 GUÍA DE TESTING - PROJECT PLANNING BACKEND

## 🚀 Cómo probar todo lo que acabamos de crear

### 1. ⚡ Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus datos de MySQL

# 3. Iniciar con Docker (recomendado)
npm run docker:dev

# O iniciar sin Docker
npm run dev
```

### 2. 🏥 Health Check - Primera prueba

```bash
# Verificar que el servidor esté funcionando
curl http://localhost:5000/health
```

**Respuesta esperada:**
```json
{
  "status": "OK",
  "message": "Project Planning Backend está funcionando",
  "timestamp": "2024-12-19T...",
  "environment": "development",
  "database": "MySQL + Sequelize"
}
```

### 3. 👥 Testing de Usuarios

#### Crear un usuario
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "user"
  }'
```

#### Obtener todos los usuarios
```bash
curl http://localhost:5000/api/users
```

### 4. 📋 Testing de Proyectos

#### Crear un proyecto
```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Proyecto de Testing",
    "description": "Este es un proyecto para testing",
    "startDate": "2024-12-19",
    "endDate": "2025-01-19",
    "budget": 25000,
    "currency": "USD",
    "priority": "high",
    "createdBy": 1,
    "managerId": 1,
    "tags": ["testing", "api", "backend"]
  }'
```

#### Obtener proyectos con filtros
```bash
# Todos los proyectos
curl http://localhost:5000/api/projects

# Proyectos por status
curl "http://localhost:5000/api/projects?status=active"

# Proyectos por prioridad
curl "http://localhost:5000/api/projects?priority=high"

# Con paginación
curl "http://localhost:5000/api/projects?page=1&limit=5"
```

#### Obtener un proyecto específico
```bash
curl http://localhost:5000/api/projects/1
```

### 5. ✅ Testing de Tareas

#### Crear una tarea
```bash
curl -X POST http://localhost:5000/api/projects/1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tarea de Testing",
    "description": "Esta es una tarea para testing",
    "priority": "medium",
    "dueDate": "2024-12-26",
    "estimatedHours": 8,
    "assignedTo": 1,
    "createdBy": 1,
    "tags": ["testing", "task"]
  }'
```

#### Obtener tareas de un proyecto
```bash
# Todas las tareas del proyecto 1
curl http://localhost:5000/api/projects/1/tasks

# Tareas por status
curl "http://localhost:5000/api/projects/1/tasks?status=todo"

# Tareas asignadas a un usuario
curl "http://localhost:5000/api/projects/1/tasks?assignedTo=1"
```

### 6. 📊 Testing de Estadísticas

```bash
curl http://localhost:5000/api/stats
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 3,
    "totalProjects": 2,
    "totalTasks": 5,
    "activeProjects": 2,
    "pendingTasks": 3,
    "completedTasks": 2
  }
}
```

## 🎯 Testing con el Frontend Client

### Opción 1: Node.js
```javascript
const ProjectPlanningAPI = require('./examples/frontend-usage.js');
const api = new ProjectPlanningAPI('http://localhost:5000');

// Testing completo automático
api.fullDemoWorkflow()
  .then(result => console.log('✅ Testing completado:', result))
  .catch(error => console.error('❌ Error:', error));
```

### Opción 2: Browser Console
```javascript
// Abrir browser en cualquier página y ejecutar en consola
const api = new ProjectPlanningAPI('http://localhost:5000');

// Health check
api.healthCheck().then(console.log);

// Crear usuario
api.createUser({
  username: 'browser_user',
  email: 'browser@test.com',
  password: 'test123',
  firstName: 'Browser',
  lastName: 'User'
}).then(console.log);

// Demo completo
api.fullDemoWorkflow().then(console.log);
```

## 🐛 Testing de Errores

### Usuario duplicado
```bash
# Intentar crear el mismo usuario dos veces
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "123"}'
```

### Proyecto no encontrado
```bash
curl http://localhost:5000/api/projects/999
```

### Datos inválidos
```bash
# Proyecto sin datos requeridos
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'
```

## 🔍 Testing de Relaciones

### Verificar relaciones User -> Projects
```bash
# Un usuario con sus proyectos creados y administrados
curl http://localhost:5000/api/users
```

### Verificar relaciones Project -> Tasks
```bash
# Un proyecto con todas sus tareas
curl http://localhost:5000/api/projects/1
```

### Verificar relaciones Task -> User
```bash
# Tareas con información de asignado y creador
curl http://localhost:5000/api/projects/1/tasks
```

## 📋 Checklist de Testing

- [ ] ✅ Servidor inicia correctamente
- [ ] ✅ Base de datos se conecta
- [ ] ✅ Se crean datos de prueba (seed)
- [ ] ✅ Health check responde OK
- [ ] 👥 CRUD de usuarios funciona
- [ ] 📋 CRUD de proyectos funciona
- [ ] ✅ CRUD de tareas funciona
- [ ] 📊 Estadísticas se calculan correctamente
- [ ] 🔗 Relaciones entre modelos funcionan
- [ ] ❌ Manejo de errores funciona
- [ ] 🛡️ Validaciones funcionan
- [ ] 📄 Paginación funciona
- [ ] 🔍 Filtros funcionan

## 🚨 Troubleshooting

### Error de conexión a MySQL
1. Verificar que MySQL esté ejecutándose
2. Verificar credenciales en `.env`
3. Verificar que la base de datos existe

### Puerto ya en uso
```bash
# Cambiar puerto en .env
PORT=5001

# O matar proceso en puerto 5000
npx kill-port 5000
```

### Datos de prueba no se crean
- Verificar que `NODE_ENV=development`
- Revisar logs en consola
- Verificar que no haya errores de validación

## 🎯 Next Steps

1. **Autenticación JWT**: Agregar login/logout real
2. **Validaciones**: Más validaciones en modelos
3. **Tests unitarios**: Jest + Supertest
4. **Documentación API**: Swagger/OpenAPI
5. **Deployment**: Production ready config

¡Ya tenés todo listo para testear tu backend completo! 🚀