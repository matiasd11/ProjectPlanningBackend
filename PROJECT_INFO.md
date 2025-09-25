# 🚀 Project Planning Backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-blue.svg)](https://expressjs.com/)
[![Bonita](https://img.shields.io/badge/Bonita-Compatible-orange.svg)](https://www.bonitasoft.com/)

**Backend en Express.js para integración con Bonita Software BPM**

Este proyecto proporciona una API RESTful completa que actúa como intermediario entre aplicaciones frontend y Bonita Software, facilitando la gestión de procesos BPM, tareas, formularios y autenticación.

## 🎯 Propósito

Este backend fue diseñado para:
- **Facilitar la integración** con Bonita Software desde aplicaciones frontend
- **Manejar la autenticación** y sesiones de Bonita de forma transparente
- **Proporcionar endpoints RESTful** para todas las operaciones BPM
- **Simplificar el desarrollo** de aplicaciones que usan Bonita

## ⚡ Inicio Rápido

```bash
# Clonar el repositorio
git clone https://github.com/matiasd11/ProjectPlanningBackend.git
cd ProjectPlanningBackend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu configuración de Bonita

# Iniciar el servidor
npm start
```

El servidor estará disponible en: **http://localhost:3001**

## 📋 Requisitos Previos

- **Node.js 18+**
- **Bonita Community/Subscription** ejecutándose en puerto 8080
- **npm** o **yarn** para gestión de dependencias

## 🔧 Configuración

### Variables de Entorno (.env):
```env
BONITA_SERVER_URL=http://localhost:8080
BONITA_USERNAME=install
BONITA_PASSWORD=install
PORT=3001
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Configuración de Bonita:
1. Descarga Bonita Community desde https://www.bonitasoft.com/downloads
2. Ejecuta Bonita: `./start.sh` (Linux/Mac) o `start.bat` (Windows)
3. Accede a http://localhost:8080/bonita
4. Login con: `install` / `install`

## 🌐 API Endpoints

| Categoría | Endpoint | Método | Descripción |
|-----------|----------|--------|-------------|
| **Auth** | `/api/auth/login` | POST | Autenticación con Bonita |
| | `/api/auth/logout` | POST | Cerrar sesión |
| | `/api/auth/session` | GET | Verificar sesión |
| **Procesos** | `/api/bonita/processes` | GET | Listar procesos BPM |
| | `/api/bonita/processes/:id/instantiation` | POST | Crear instancia |
| **Tareas** | `/api/bonita/tasks/pending` | GET | Tareas pendientes |
| | `/api/bonita/tasks/:id/execution` | POST | Ejecutar tarea |
| **Formularios** | `/api/bonita/forms/:id` | GET | Obtener formulario |

Ver documentación completa en [`README.md`](./README.md)

## 💻 Uso desde Frontend

```javascript
// Ejemplo con fetch API
const api = 'http://localhost:3001';

// Login
const login = await fetch(`${api}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ username: 'install', password: 'install' })
});

// Obtener procesos
const processes = await fetch(`${api}/api/bonita/processes`, {
  credentials: 'include'
});
```

Ver ejemplos completos en [`examples/frontend-usage.js`](./examples/frontend-usage.js)

## 📁 Estructura del Proyecto

```
ProjectPlanningBackend/
├── 📂 routes/           # Rutas de la API
├── 📂 services/         # Servicios de negocio
├── 📂 middleware/       # Middleware de Express
├── 📂 config/           # Configuración
├── 📂 examples/         # Ejemplos de uso
├── server.js            # Servidor principal
└── README.md           # Documentación
```

## 🛠️ Scripts Disponibles

```bash
npm start          # Iniciar servidor en producción
npm run dev        # Desarrollo con hot reload
npm test           # Ejecutar pruebas
```

## 🔒 Seguridad

- ✅ **Helmet.js** para headers de seguridad
- ✅ **CORS** configurado para desarrollo y producción
- ✅ **Manejo seguro de cookies** de sesión
- ✅ **Validación de sesiones** con Bonita
- ✅ **Variables de entorno** para credenciales

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver [`LICENSE`](./LICENSE) para más detalles.

## 🙋‍♂️ Soporte

- **Documentación:** [`README.md`](./README.md) y [`SETUP.md`](./SETUP.md)
- **Ejemplos:** [`examples/frontend-usage.js`](./examples/frontend-usage.js)
- **Issues:** https://github.com/matiasd11/ProjectPlanningBackend/issues

---

**⭐ Si este proyecto te resulta útil, no olvides darle una estrella!**