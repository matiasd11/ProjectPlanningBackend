# 🚀 Guía de Inicio Rápido - Dockerizado

## Prerrequisitos
- Docker y Docker Compose instalados
- Git

## 🏃‍♂️ Inicio Rápido (5 minutos)

### 1. Clonar el repositorio
```bash
git clone https://github.com/matiasd11/ProjectPlanningBackend.git
cd ProjectPlanningBackend
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env si es necesario
```

### 3. Iniciar solo la base de datos (para desarrollo)
```bash
npm run docker:dev
```
Esto iniciará:
- MySQL en puerto 3307
- Adminer (gestor BD) en http://localhost:8081

### 4. Instalar dependencias y ejecutar backend localmente
```bash
npm install
npm run dev
```

### 5. ¡Listo! 
- **Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Adminer (BD)**: http://localhost:8081
  - Servidor: `mysql-dev`
  - Usuario: `projectuser`
  - Contraseña: `projectpass`
  - Base de datos: `projectplanning`

## 🐳 Ejecución Completa con Docker

Para ejecutar todo el stack dockerizado:

```bash
# Construir y ejecutar
npm run docker:up

# Ver logs
npm run docker:logs

# Detener
npm run docker:down
```

## 📊 Base de Datos

### Esquema principal:
- **users**: Usuarios del sistema
- **projects**: Proyectos principales
- **project_forms**: Campos adicionales de formularios
- **project_comments**: Comentarios y notas
- **project_attachments**: Archivos adjuntos
- **project_history**: Historial de cambios

### Datos de prueba:
```sql
-- Usuarios por defecto
admin / password (admin@projectplanning.com)
manager / password (manager@projectplanning.com)  
user1 / password (user1@projectplanning.com)
```

## 🎯 API Endpoints Principales

### Proyectos
```bash
# Crear proyecto
POST /api/projects/create
{
  "name": "Mi Proyecto",
  "description": "Descripción del proyecto",
  "startDate": "2025-01-01",
  "budget": 100000,
  "priority": "high",
  "formFields": {
    "client": "Cliente ABC",
    "technology": "React + Node.js"
  }
}

# Obtener mis proyectos
GET /api/projects/my-projects?page=1&limit=10&status=draft

# Enviar a Bonita
POST /api/projects/123/submit

# Ver estado en Bonita  
GET /api/projects/123/bonita-status
```

### Autenticación
```bash
# Login
POST /api/auth/login
{
  "username": "admin",
  "password": "password"
}

# Verificar sesión
GET /api/auth/session
```

## 🧪 Testing

```bash
# Test de conectividad
npm test

# Test de salud
curl http://localhost:3001/health

# Test de creación de proyecto
curl -X POST http://localhost:3001/api/projects/create \
  -H "Content-Type: application/json" \
  -H "Cookie: JSESSIONID=tu-sesion" \
  -d '{
    "name": "Proyecto Test",
    "description": "Test desde curl",
    "budget": 50000
  }'
```

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev                    # Servidor con hot reload
npm run docker:dev             # Solo BD en Docker  
npm run docker:dev:down        # Parar BD

# Producción
npm run docker:build           # Construir imagen
npm run docker:up              # Todo el stack
npm run docker:down            # Parar todo
npm run docker:logs            # Ver logs

# Base de datos
npm run db:reset               # Resetear BD
```

## 📱 Ejemplo Frontend

```javascript
import { ProjectPlanningApiClient } from './api-client';

const api = new ProjectPlanningApiClient();

async function crearProyecto() {
  // 1. Login
  await api.login('admin', 'password');
  
  // 2. Crear proyecto
  const proyecto = await api.createProject({
    name: 'Sistema de Ventas',
    description: 'Aplicación web para gestión de ventas',
    startDate: '2025-02-01',
    endDate: '2025-12-31',
    budget: 200000,
    priority: 'high',
    category: 'Web Development',
    formFields: {
      client: 'Empresa XYZ',
      technology: 'React + Express + MySQL',
      teamSize: 6
    }
  });
  
  // 3. Enviar a Bonita
  await api.submitProjectToBonita(proyecto.data.id);
  
  console.log('Proyecto creado y enviado a Bonita!');
}
```

## 🌐 Integración con Bonita

### Preparar Bonita:
1. Descargar Bonita Community
2. Crear proceso "ProjectApprovalProcess" 
3. Variables del proceso:
   - `projectId` (Text)
   - `projectName` (Text)
   - `projectBudget` (Integer)
   - `projectData` (JSON)

### Flujo típico:
```
[Frontend] → [Backend API] → [MySQL] → [Bonita BPM] → [Cloud Service]
```

## 🛡️ Seguridad

- Rate limiting habilitado
- Helmet.js para headers de seguridad  
- Validación de datos con Joi
- CORS configurado
- Cookies HTTP-only
- Variables de entorno para secretos

## 📋 Troubleshooting

**Error de conexión BD:**
```bash
docker-compose logs mysql-dev
npm run docker:dev:down && npm run docker:dev
```

**Puerto ocupado:**
```bash
# Cambiar puerto en .env
PORT=3002
# O matar proceso
lsof -ti:3001 | xargs kill -9
```

**Bonita no conecta:**
```bash
# Verificar que Bonita esté en puerto 8080
curl http://localhost:8080/bonita

# Ajustar URL en .env
BONITA_SERVER_URL=http://localhost:8080
```

## 🚀 Producción

Ver archivo `DEPLOYMENT.md` para guías completas de:
- Deploy en Heroku
- Deploy en AWS EC2
- Configuración Docker
- SSL/HTTPS
- Monitoreo

---

**¿Necesitas ayuda?** Revisa los archivos `README.md` y `SETUP.md` para documentación completa.