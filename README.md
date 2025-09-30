# Project Planning Backend

Backend API with Bonita BPM integration for NGO project management.

## Features

- REST API versioned (`/api/v1`)
- Bonita BPM integration with auto-detection
- MySQL database with Sequelize ORM
- Docker development environment
- Automatic test data seeding
- Security middleware (CORS, rate limiting, helmet)

## Architecture

```
Frontend (localhost:3000) ← → Backend Docker (localhost:5001) ← → Bonita Studio (localhost:8080)
                                              ↓
                                   MySQL Docker (localhost:3307)
```

## Quick Start

### Setup

```bash
git clone https://github.com/matiasd11/ProjectPlanningBackend.git
cd ProjectPlanningBackend
cp .env.example .env
```

### Start Services

```bash
npm run docker:up
curl http://localhost:5001/health
```

## Bonita BPM Configuration

### Required Setup

1. Install Bonita Studio
2. Create process: `Proceso de Ejecución de Proyecto de Financiamiento`
3. Add process variables:
   - projectName (String)
   - projectDescription (String) 
   - startDate (Date)
   - endDate (Date)
   - organizationId (Integer)
   - organizationName (String)
   - tasks (String)
   - status (String)
   - tareas_completas (Boolean)
4. Deploy process (no Contract needed)
5. Bonita runs on: `http://localhost:8080/bonita`

### Test Integration

```bash
# Test connection
curl -X POST http://localhost:5001/api/v1/bonita/test-connection

# Create project
curl -X POST http://localhost:5001/api/v1/projects/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "description": "Test description",
    "startDate": "2025-10-01",
    "endDate": "2025-12-31",
    "ownerId": 2,
    "tasks": [{"title": "Task 1", "description": "First task"}]
  }'
```

## Configuration

### Environment Variables

```bash
# API
NODE_ENV=development
API_VERSION=v1
NODE_LOCAL_PORT=5001

# Database  
MYSQLDB_DATABASE=projectplanning
MYSQLDB_USER=projectuser
MYSQL_ROOT_PASSWORD=root
MYSQLDB_LOCAL_PORT=3307

# Bonita BPM
BONITA_URL=http://host.docker.internal:8080/bonita
BONITA_USERNAME=walter.bates
BONITA_PASSWORD=bpm
BONITA_PROCESS_NAME=Proceso de Ejecución de Proyecto de Financiamiento

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Frontend Configuration

```javascript
const config = {
  API_BASE_URL: 'http://localhost:5001/api/v1',
  BONITA_URL: 'http://localhost:8080/bonita'
};
```

## API Endpoints

### Users
- `GET /api/v1/users/` - List users
- `GET /api/v1/users/:id` - Get user
- `POST /api/v1/users/` - Create user

### Projects  
- `GET /api/v1/projects/` - List projects
- `GET /api/v1/projects/:id` - Get project
- `POST /api/v1/projects/` - Create project (auto-sends to Bonita)

### Tasks
- `PUT /api/v1/tasks/:taskId/take` - Take task

### Bonita BPM
- `POST /api/v1/bonita/test-connection` - Test connection
- `GET /api/v1/bonita/cases` - List cases
- `GET /api/v1/bonita/cases/:caseId/variables` - Get case variables
- `GET /api/v1/bonita/status` - Bonita status

## Test Users

Auto-created on startup:

```javascript
// Use ownerId: 2 for testing
{
  id: 2,
  username: "ong-verde", 
  email: "contacto@ongverde.org",
  organizationName: "ONG Verde Futuro",
  role: "ong"
}

// Admin user (id: 1)
{
  username: "admin",
  email: "admin@project.com", 
  role: "admin"
}
```

## Docker Commands

```bash
# Development
npm run docker:up         # Start services
npm run docker:logs       # View logs  
npm run docker:restart    # Restart backend
npm run docker:down       # Stop services

# Production
npm run docker:prod       # Start in production mode
npm run docker:build      # Rebuild images

# Database
npm run db:reset          # Reset database
```

## Bonita BPM Setup

### Required Process Configuration

1. **Download** [Bonita Studio](https://www.bonitasoft.com/downloads)
2. **Create process** with exact name: `Proceso de Ejecución de Proyecto de Financiamiento`
3. **Add process variables:**
   ```
   - projectName (String)
   - projectDescription (String) 
   - startDate (Date)
   - endDate (Date)
   - organizationId (Integer)
   - organizationName (String)
   - tasks (String)
   - status (String)
   - tareas_completas (Boolean)
   ```
4. **Important**: NO Contract (process must be contract-free)
5. **Deploy** process in Bonita Studio
6. **Verify** Bonita running at `http://localhost:8080/bonita`

### Test Integration

```bash
# Test connection
curl -X POST http://localhost:5001/api/v1/bonita/test-connection

# Create project (auto-sends to Bonita)
curl -X POST http://localhost:5001/api/v1/projects/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "description": "Project description",
    "startDate": "2025-10-01", 
    "endDate": "2025-12-31",
    "ownerId": 2,
    "tasks": [{"title": "Task 1", "description": "First task"}]
  }'
```


### Backend Issues
```bash
# Check containers
docker ps

# View logs
docker logs project-planning-backend

# Reset database
npm run db:reset

# Port conflicts
npx kill-port 5001
npx kill-port 3307
```

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

