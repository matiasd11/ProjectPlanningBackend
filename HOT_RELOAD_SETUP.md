# Configuración de Hot-Reload para Desarrollo

Esta configuración permite que los cambios en el código se reflejen automáticamente en el contenedor Docker sin necesidad de reconstruir o reiniciar.

## 🚀 Uso Rápido

### 1. Iniciar el proyecto con hot-reload
```bash
npm run docker:up
```

Esto iniciará:
- MySQL en el puerto configurado (por defecto 3307)
- Backend con nodemon en el puerto configurado (por defecto 5000/5001)
- Hot-reload activado automáticamente

### 2. Ver logs en tiempo real
```bash
npm run docker:logs
```

### 3. Realizar cambios
Simplemente edita cualquier archivo en:
- `server.js`
- `routes/`
- `models/`
- `config/`
- `services/`
- `middleware/`

Nodemon detectará los cambios y reiniciará el servidor automáticamente.

### 4. Detener el proyecto
```bash
npm run docker:down
```

## 📋 Configuración Técnica

### Archivos Modificados

1. **`nodemon.json`**: Configuración de nodemon para observar cambios
   - Observa: `server.js`, `routes/`, `models/`, `config/`, `services/`, `middleware/`
   - Ignora: `node_modules/`, archivos de test, Docker

2. **`docker-compose.yml`**: Configuración de volúmenes
   - Monta el código fuente desde el host
   - Excluye `node_modules` para mejor rendimiento
   - Configuración especial para Windows con polling

3. **Variables de entorno para Windows**:
   - `CHOKIDAR_USEPOLLING=true`: Necesario en Windows para detectar cambios
   - `CHOKIDAR_INTERVAL=1000`: Intervalo de polling

## 🔍 Debugging

### Ver si nodemon está funcionando
Los logs mostrarán algo como:
```
[nodemon] restarting due to changes...
[nodemon] starting `node server.js`
```

### Si los cambios no se detectan

1. **Verificar que nodemon está corriendo**:
   ```bash
   docker exec project-planning-backend ps aux | grep nodemon
   ```

2. **Verificar los volúmenes montados**:
   ```bash
   docker inspect project-planning-backend | grep -A 10 Mounts
   ```

3. **Reiniciar el contenedor**:
   ```bash
   npm run docker:restart
   ```

4. **Reconstruir si es necesario**:
   ```bash
   npm run docker:build
   npm run docker:up
   ```

### Probar un cambio rápido
Edita `server.js` y cambia el mensaje de health check:
```javascript
message: 'Project Planning Backend está funcionando - HOT RELOAD ACTIVO'
```

Deberías ver el cambio reflejado inmediatamente en los logs.

## 🐛 Problemas Comunes

### 1. "Error: Cannot find module"
**Solución**: Asegúrate de que `node_modules` está excluido del volumen
- El contenedor usa sus propios `node_modules`
- Si instalas nuevas dependencias, reconstruye:
  ```bash
  npm run docker:build
  ```

### 2. Cambios no se detectan en Windows
**Solución**: Verifica que `CHOKIDAR_USEPOLLING` esté configurado
- Ya está configurado en `docker-compose.yml`
- Si persiste, aumenta el intervalo:
  ```yaml
  CHOKIDAR_INTERVAL: 2000
  ```

### 3. Puerto ya en uso
**Solución**: Cambia el puerto en `.env`:
```env
NODE_LOCAL_PORT=5001
```

### 4. MySQL no conecta
**Solución**: Asegúrate de que MySQL esté corriendo y saludable:
```bash
docker ps
docker logs project-planning-mysql
```

## 📝 Comandos Útiles

```bash
# Ver logs en tiempo real
npm run docker:logs

# Reiniciar solo el backend
npm run docker:restart

# Entrar al contenedor
docker exec -it project-planning-backend sh

# Ver procesos corriendo
docker exec project-planning-backend ps aux

# Reconstruir después de cambiar package.json
npm run docker:build

# Reiniciar desde cero
npm run docker:down
npm run docker:up
```

## ✅ Checklist de Setup

- [ ] `.env` configurado correctamente
- [ ] Dependencias instaladas (`npm install`)
- [ ] Docker Desktop corriendo
- [ ] Puertos libres (5000/5001, 3307)
- [ ] `nodemon.json` presente
- [ ] `docker-compose.yml` actualizado

## 🎯 Flujo de Trabajo Recomendado

1. **Primera vez**:
   ```bash
   npm install
   npm run docker:build
   npm run docker:up
   ```

2. **Desarrollo diario**:
   ```bash
   npm run docker:up
   # Editar código normalmente
   # Ver cambios automáticamente en logs
   ```

3. **Después de cambios en `package.json`**:
   ```bash
   npm run docker:build
   npm run docker:up
   ```

4. **Al terminar**:
   ```bash
   npm run docker:down
   ```
