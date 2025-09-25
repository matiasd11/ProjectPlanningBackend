# 🚀 Guía de Despliegue

## Despliegue Local

### Requisitos
- Node.js 18+
- Bonita Software Community/Subscription
- Git

### Pasos:

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/matiasd11/ProjectPlanningBackend.git
   cd ProjectPlanningBackend
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   # Editar .env con tu configuración
   ```

4. **Iniciar Bonita Software:**
   - Descargar desde https://www.bonitasoft.com/downloads
   - Ejecutar `start.bat` (Windows) o `./start.sh` (Linux/Mac)
   - Acceder a http://localhost:8080/bonita

5. **Iniciar el backend:**
   ```bash
   npm start
   ```

## Despliegue en Producción

### Heroku

1. **Preparar la aplicación:**
   ```bash
   # Crear Procfile
   echo "web: npm start" > Procfile
   git add Procfile
   git commit -m "Add Procfile for Heroku"
   ```

2. **Desplegar:**
   ```bash
   heroku create your-app-name
   heroku config:set BONITA_SERVER_URL=https://your-bonita-server.com
   heroku config:set BONITA_USERNAME=your-username
   heroku config:set BONITA_PASSWORD=your-password
   heroku config:set NODE_ENV=production
   git push heroku main
   ```

### Docker

1. **Crear Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3001
   CMD ["npm", "start"]
   ```

2. **Construir y ejecutar:**
   ```bash
   docker build -t bonita-backend .
   docker run -p 3001:3001 --env-file .env bonita-backend
   ```

### AWS EC2

1. **Conectar a la instancia:**
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   ```

2. **Instalar Node.js y PM2:**
   ```bash
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs
   sudo npm install -g pm2
   ```

3. **Clonar y configurar:**
   ```bash
   git clone https://github.com/matiasd11/ProjectPlanningBackend.git
   cd ProjectPlanningBackend
   npm install
   cp .env.example .env
   # Configurar .env
   ```

4. **Iniciar con PM2:**
   ```bash
   pm2 start server.js --name bonita-backend
   pm2 startup
   pm2 save
   ```

## Variables de Entorno en Producción

```env
# Bonita Configuration
BONITA_SERVER_URL=https://your-bonita-server.com
BONITA_USERNAME=production-user
BONITA_PASSWORD=secure-password

# Server Configuration
PORT=3001
NODE_ENV=production

# Security
CORS_ORIGINS=https://your-frontend.com,https://your-domain.com

# Optional: Database for session storage
# DATABASE_URL=postgresql://user:pass@host:port/db
```

## Configuración de Proxy Reverso (Nginx)

```nginx
server {
    listen 80;
    server_name your-api-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## SSL/HTTPS

Para producción, siempre usa HTTPS. Puedes usar:
- **Let's Encrypt** (gratuito)
- **Cloudflare** (gratuito)
- **AWS Certificate Manager** (gratuito en AWS)

```bash
# Con Certbot (Let's Encrypt)
sudo certbot --nginx -d your-api-domain.com
```

## Monitoreo y Logs

### PM2 Monitoring:
```bash
pm2 monit
pm2 logs bonita-backend
pm2 restart bonita-backend
```

### Logs de aplicación:
```bash
# Ver logs en tiempo real
tail -f logs/app.log

# Ver logs con filtros
grep "ERROR" logs/app.log
```

## Backup y Mantenimiento

### Backup de configuración:
```bash
# Backup del .env
cp .env .env.backup.$(date +%Y%m%d)

# Backup de la base de datos (si usas una)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Actualizaciones:
```bash
# Actualizar código
git pull origin main
npm install

# Reiniciar servicio
pm2 restart bonita-backend

# Verificar estado
pm2 status
```

## Troubleshooting

### Problemas Comunes:

1. **Error de conexión con Bonita:**
   - Verificar BONITA_SERVER_URL
   - Confirmar que Bonita esté accesible
   - Revisar credenciales

2. **Error de CORS:**
   - Verificar CORS_ORIGINS en .env
   - Confirmar que el frontend esté en la lista

3. **Error 502 Bad Gateway:**
   - Verificar que el servidor esté ejecutándose
   - Revisar configuración del proxy

4. **Alta CPU/Memoria:**
   - Verificar logs para errores repetitivos
   - Revisar conexiones a Bonita
   - Considerar cache de sesiones

### Logs útiles:
```bash
# Ver todos los logs
pm2 logs

# Solo errores
pm2 logs --err

# Logs específicos de la app
pm2 logs bonita-backend
```