# Bonita Express Backend

Backend en Express.js para conectar con la API de Bonita Software BPM.

## Características

- 🚀 **Express.js** con middleware de seguridad
- 🔐 **Autenticación** con Bonita Software
- 📋 **Gestión de Procesos BPM** (crear, listar, ejecutar)
- ✅ **Gestión de Tareas** (asignar, ejecutar, consultar)
- 📄 **Manejo de Formularios** y contextos
- 🍪 **Manejo de sesiones** con cookies
- 🔒 **Middleware de autenticación**
- 🌐 **CORS configurado**
- ⚡ **Hot reload** con nodemon

## Instalación

1. **Clonar e instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   
   Edita el archivo `.env` con tu configuración de Bonita:
   ```env
   BONITA_SERVER_URL=http://localhost:8080
   BONITA_USERNAME=install
   BONITA_PASSWORD=install
   PORT=3001
   NODE_ENV=development
   CORS_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

3. **Ejecutar el servidor:**
   ```bash
   # Modo desarrollo (con hot reload)
   npm run dev
   
   # Modo producción
   npm start
   ```

## Estructura del Proyecto

```
bonita-express-backend/
├── routes/
│   ├── auth.js          # Rutas de autenticación
│   └── bonita.js        # Rutas de la API Bonita
├── services/
│   └── bonitaService.js # Servicio principal de Bonita
├── middleware/
│   └── auth.js          # Middleware de autenticación
├── server.js            # Servidor principal
├── package.json
└── .env
```

## API Endpoints

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login con Bonita |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Verificar sesión |

### Procesos BPM

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/bonita/processes` | Listar procesos |
| GET | `/api/bonita/processes/:id` | Obtener proceso específico |
| POST | `/api/bonita/processes/:id/instantiation` | Crear instancia de proceso |

### Casos (Process Instances)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/bonita/cases` | Listar casos |
| GET | `/api/bonita/cases/:id` | Obtener caso específico |

### Tareas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/bonita/tasks/pending` | Tareas pendientes del usuario |
| GET | `/api/bonita/tasks/assigned` | Tareas asignadas al usuario |
| GET | `/api/bonita/tasks/:id` | Obtener tarea específica |
| PUT | `/api/bonita/tasks/:id/assign` | Asignar tarea |
| POST | `/api/bonita/tasks/:id/execution` | Ejecutar tarea |

### Formularios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/bonita/forms/:id` | Obtener formulario |
| GET | `/api/bonita/forms/:id/context` | Obtener contexto del formulario |

### Usuario

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/bonita/user/info` | Información del usuario actual |

## Uso desde Frontend

### 1. Login
```javascript
const login = async (username, password) => {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Importante para las cookies
    body: JSON.stringify({ username, password })
  });
  
  return await response.json();
};
```

### 2. Obtener Procesos
```javascript
const getProcesses = async () => {
  const response = await fetch('http://localhost:3001/api/bonita/processes', {
    credentials: 'include' // Importante para las cookies
  });
  
  return await response.json();
};
```

### 3. Crear Instancia de Proceso
```javascript
const createProcessInstance = async (processId, variables = {}) => {
  const response = await fetch(`http://localhost:3001/api/bonita/processes/${processId}/instantiation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(variables)
  });
  
  return await response.json();
};
```

### 4. Obtener Tareas Pendientes
```javascript
const getPendingTasks = async () => {
  const response = await fetch('http://localhost:3001/api/bonita/tasks/pending', {
    credentials: 'include'
  });
  
  return await response.json();
};
```

### 5. Ejecutar Tarea
```javascript
const executeTask = async (taskId, variables = {}) => {
  const response = await fetch(`http://localhost:3001/api/bonita/tasks/${taskId}/execution`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ variables })
  });
  
  return await response.json();
};
```

## Configuración de CORS

El backend está configurado para aceptar requests desde múltiples orígenes. Puedes configurar los orígenes permitidos en el archivo `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://tu-frontend.com
```

## Manejo de Errores

El API devuelve errores en formato JSON:

```javascript
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

Códigos de estado comunes:
- `200`: Éxito
- `400`: Bad Request (datos inválidos)
- `401`: Unauthorized (no autenticado)
- `404`: Not Found (recurso no encontrado)
- `500`: Internal Server Error

## Desarrollo

Para desarrollo con hot reload:

```bash
npm run dev
```

El servidor se reiniciará automáticamente cuando detecte cambios en los archivos.

## Notas Importantes

1. **Cookies**: El backend maneja automáticamente las cookies de sesión de Bonita
2. **Autenticación**: Todas las rutas bajo `/api/bonita/` requieren autenticación
3. **CORS**: Configurado para desarrollo local, ajusta para producción
4. **Seguridad**: Usa HTTPS en producción y configura las cookies como `secure`

## Próximos Pasos

- [ ] Implementar cache de sesiones
- [ ] Agregar logging más detallado
- [ ] Implementar rate limiting
- [ ] Agregar tests unitarios
- [ ] Documentación con Swagger/OpenAPI