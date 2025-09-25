# Configuración adicional para desarrollo

## Variables de entorno de ejemplo

# Copiar este contenido al archivo .env y ajustar según tu configuración

# Bonita Server Configuration
BONITA_SERVER_URL=http://localhost:8080
BONITA_USERNAME=install
BONITA_PASSWORD=install

# Express Server Configuration  
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173

# Security Settings (para producción)
# JWT_SECRET=your-super-secret-jwt-key
# SESSION_SECRET=your-session-secret
# HTTPS_ENABLED=true

## Configuración de Bonita Software

Para que este backend funcione correctamente, necesitas tener Bonita Community o Subscription ejecutándose.

### Instalación rápida de Bonita Community:

1. **Descargar Bonita Community:**
   - Ve a: https://www.bonitasoft.com/downloads
   - Descarga Bonita Community Edition
   - Extrae el archivo ZIP

2. **Ejecutar Bonita:**
   ```bash
   # En Windows
   cd path/to/bonita/setup
   start.bat
   
   # En Linux/Mac
   cd path/to/bonita/setup
   ./start.sh
   ```

3. **Acceder a Bonita:**
   - URL: http://localhost:8080/bonita
   - Usuario por defecto: install
   - Contraseña por defecto: install

### Configuración de usuarios de prueba:

Si necesitas crear usuarios adicionales en Bonita:

1. **Accede al Portal de Bonita:** http://localhost:8080/bonita
2. **Login como administrator:** install / install  
3. **Ve a Organization > Users**
4. **Crea nuevos usuarios según necesites**

## URLs importantes:

- **Backend API:** http://localhost:3001
- **Bonita Portal:** http://localhost:8080/bonita  
- **Bonita REST API:** http://localhost:8080/bonita/API

## Solución de problemas comunes:

### Error: "ECONNREFUSED"
- Asegúrate de que Bonita esté ejecutándose en el puerto 8080
- Verifica la variable BONITA_SERVER_URL en .env

### Error: "Invalid credentials"  
- Verifica BONITA_USERNAME y BONITA_PASSWORD en .env
- Asegúrate de que el usuario existe en Bonita

### Error: "CORS policy"
- Agrega tu dominio frontend a CORS_ORIGINS en .env
- Para desarrollo local, usa: http://localhost:3000

### Error: "Session expired"
- Las sesiones de Bonita expiran después de cierto tiempo
- El cliente debe manejar re-autenticación automática

## Arquitectura del sistema:

```
Frontend (React/Vue/etc)
    ↓ HTTP Requests
Express Backend (Puerto 3001)  
    ↓ Bonita REST API
Bonita BPM Server (Puerto 8080)
    ↓ Database
H2/PostgreSQL/MySQL/etc
```