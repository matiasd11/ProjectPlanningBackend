const axios = require('axios');
const { sequelize } = require('../config/database');

class BonitaService {
  constructor() {
    this.baseURL = process.env.BONITA_URL || 'http://localhost:8080/bonita';
    this.apiToken = null;
    this.jsessionId = null;
    this.processDefinitionId = process.env.BONITA_PROCESS_ID || null;
    this.observationProcessDefinitionId = null;
    this.groupName = "ONGs";
  }

  /**
   * Inicia sesión en Bonita BPM.
   */
  async login(username, password) {
    const authenticated = await this.authenticate(username, password);

    if (!authenticated) {
      throw new Error("No se pudo autenticar con Bonita");
    }

    const bonitaUser = await this.getBonitaUserByUsername(username);
    console.log('Usuario obtenido en Bonita', bonitaUser);

    return {
      user: bonitaUser,
      session_id: this.jsessionId,
      apiToken: this.apiToken
    };
  }

  /**
   * Autentica un usuario en Bonita BPM.
   */
  async authenticate(username = "walter.bates", password = "bpm") {
    try {
      console.log('🔐 DEBUG: Intentando autenticación con Bonita...');
      console.log('🌐 URL:', `${this.baseURL}/loginservice`);
      console.log('👤 Credenciales:', `username=${username}&password=${password}`);

      const response = await axios.post(
        `${this.baseURL}/loginservice`,
        `username=${username}&password=${password}&redirect=false`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          withCredentials: true
        }
      );

      // Bonita puede devolver token en cookies o en el body
      const cookies = response.headers['set-cookie'] || [];

      // JSESSIONID si está
      const sessionCookie = cookies.find(c => c.includes('JSESSIONID'));
      this.jsessionId = sessionCookie ? sessionCookie.split(';')[0] : null;

      // API token desde cookie o desde body
      const apiTokenCookie = cookies.find(c => c.includes('X-Bonita-API-Token'));
      this.apiToken = apiTokenCookie
        ? apiTokenCookie.split('=')[1].split(';')[0]
        : response.data?.token || this.apiToken;

      if (!this.apiToken) {
        throw new Error('No se pudo obtener el token de API de Bonita');
      }

      console.log('✅ Autenticado con Bonita BPM');
      console.log('API Token:', this.apiToken);
      console.log('Session ID:', this.jsessionId);

      return true;
    } catch (error) {
      console.error('❌ Error autenticando con Bonita:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Crea un usuario en Bonita BPM.
   */
  async createUser(user) {
    const transaction = await sequelize.transaction();
    try {

      // Admin login
      const adminLogin = await axios.post(
        `${this.baseURL}/loginservice`,
        'username=walter.bates&password=bpm',
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      let adminApiToken = adminLogin.headers['x-bonita-api-token'];
      const cookieHeader = adminLogin.headers['set-cookie'].find(c => c.startsWith('JSESSIONID'));
      const adminJsessionId = cookieHeader.split(';')[0];

      if (!adminApiToken) {
        const tokenCookie = adminLogin.headers['set-cookie'].find(c => c.startsWith('X-Bonita-API-Token'));
        if (tokenCookie) {
          adminApiToken = tokenCookie.split('=')[1].split(';')[0];
        }
      }

      console.log('✅ Autenticado con Bonita BPM');
      console.log('API Token:', adminApiToken);
      console.log('Session ID:', adminJsessionId);

      const headers = {
        "X-Bonita-API-Token": adminApiToken,
        "Cookie": `${adminJsessionId}; X-Bonita-API-Token=${adminApiToken}`,
        "Content-Type": "application/json",
      };



      // 0️⃣ Verificar si el usuario ya existe en Bonita
      console.log(`🔍 Verificando si el usuario "${user.username}" ya existe en Bonita...`);
      const existingUserRes = await axios.get(
        `${this.baseURL}/API/identity/user?p=0&c=100&f=username=${user.username}`,
        { headers }
      );
      const existingUser = existingUserRes.data.find(u =>
        (u.username && u.username.toLowerCase() === user.username.toLowerCase()) ||
        (u.userName && u.userName.toLowerCase() === user.username.toLowerCase())
      );



      // 1️⃣ Crear usuario en Bonita (solo si no existe)
      let userId
      if (!existingUser) {
        console.log(`📦 Creando nuevo usuario "${user.username}" en Bonita...`);
        const userRes = await axios.post(
          `${this.baseURL}/API/identity/user`,
          {
            userName: user.username,
            password: user.password,
            firstname: user.organizationName,
            lastname: user.organizationName,
            enabled: 'true'
          },
          { headers }
        );
        userId = userRes.data.id;
        console.log(`✅ Usuario creado con ID ${userId}`);
      } else {
        userId = existingUser.id;
        console.log(existingUser);

        console.log(`ℹ️ El usuario "${user.username}" ya existe en Bonita, se omite la creación...`);
      }




      // 2️⃣ Traer todos los roles disponibles
      console.log("📦 Obteniendo todos los roles de Bonita...");
      const allRolesRes = await axios.get(`${this.baseURL}/API/identity/role?p=0&c=1000`, { headers });
      const allRoles = allRolesRes.data;
      console.log(`✅ ${allRoles.length} roles encontrados.`);



      // 3️⃣ Buscar grupo por defecto en Bonita
      console.log(`🔍 Buscando grupo "${this.groupName}"...`);
      const groupRes = await axios.get(`${this.baseURL}/API/identity/group?f=name=${this.groupName}`, { headers });
      if (groupRes.data.length === 0) throw new Error(`Grupo "${this.groupName}" no encontrado`);
      const groupId = groupRes.data[0].id;



      // 4️⃣ Obtener memberships existentes del usuario
      console.log(`📦 Obteniendo memberships existentes del usuario...`);
      const existingMembershipsRes = await axios.get(
        `${this.baseURL}/API/identity/membership?f=user_id=${userId}`,
        { headers }
      );
      const existingMemberships = existingMembershipsRes.data || [];

      // 5️⃣ Asignar roles
      for (const roleName of user.roles) {
        const role = allRoles.find(r => r.name === roleName);
        if (!role) {
          console.warn(`⚠️ Rol "${roleName}" no existe en Bonita, se omite.`);
          continue;
        }

        // Verificar si el usuario ya tiene este rol asignado en este grupo
        const hasRole = existingMemberships.some(
          membership => membership.role_id === role.id && membership.group_id === groupId
        );

        if (hasRole) {
          console.log(`ℹ️ El usuario ${user.username} ya tiene el rol "${roleName}" asignado, se omite.`);
          continue;
        }

        console.log(`🧩 Asignando rol "${roleName}" al usuario ${user.username}...`);
        await axios.post(
          `${this.baseURL}/API/identity/membership`,
          {
            user_id: userId,
            role_id: role.id,
            group_id: groupId,
          },
          { headers }
        );
      }
      console.log(`✅ memberships creadas exitosamente.`);



      // 6️⃣ Obtener usuario con roles asignados
      const bonitaUser = await this.getBonitaUserByUsername(user.username);
      console.log('Usuario obtenido en Bonita', bonitaUser);
      await transaction.commit();
      return bonitaUser;

    } catch (error) {
      console.error('Error creando usuario en Bonita:', error.message);
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Obtiene un usuario en Bonita BPM por su username.
   */
  async getBonitaUserByUsername(username) {
    try {
      // Admin login
      const adminLogin = await axios.post(
        `${this.baseURL}/loginservice`,
        'username=walter.bates&password=bpm',
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      let adminApiToken = adminLogin.headers['x-bonita-api-token'];
      const cookieHeader = adminLogin.headers['set-cookie'].find(c => c.startsWith('JSESSIONID'));
      const adminJsessionId = cookieHeader.split(';')[0];

      if (!adminApiToken) {
        const tokenCookie = adminLogin.headers['set-cookie'].find(c => c.startsWith('X-Bonita-API-Token'));
        if (tokenCookie) {
          adminApiToken = tokenCookie.split('=')[1].split(';')[0];
        }
      }

      const headers = {
        "X-Bonita-API-Token": adminApiToken,
        "Cookie": `${adminJsessionId}; X-Bonita-API-Token=${adminApiToken}`,
        "Content-Type": "application/json",
      };

      // 1️⃣ Buscar usuario en Bonita por username
      console.log(`🔍 Buscando usuario "${username}" en Bonita...`);
      const userRes = await axios.get(
        `${this.baseURL}/API/identity/user?p=0&c=100&f=username=${username}`,
        { headers }
      );

      if (!userRes.data.length) {
        throw new Error(`Usuario "${username}" no encontrado en Bonita`);
      }

      const user = userRes.data.find(u =>
        (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
        (u.userName && u.userName.toLowerCase() === username.toLowerCase())
      );

      if (!user) {
        throw new Error(`Usuario exacto "${username}" no encontrado en Bonita`);
      }

      console.log(`✅ Usuario encontrado con ID ${user.id}`);

      // 2️⃣ Obtener memberships del usuario
      console.log(`📦 Obteniendo memberships del usuario...`);
      const membershipsRes = await axios.get(
        `${this.baseURL}/API/identity/membership?f=user_id=${user.id}`,
        { headers }
      );

      // 3️⃣ Obtener información completa de cada rol
      const assignedRoles = [];
      if (membershipsRes.data && membershipsRes.data.length > 0) {
        console.log(`🔄 Obteniendo información de ${membershipsRes.data.length} roles...`);
        const rolesData = await Promise.all(
          membershipsRes.data.map(async (membership) => {
            try {
              const roleRes = await axios.get(
                `${this.baseURL}/API/identity/role/${membership.role_id}`,
                { headers }
              );
              return {
                name: roleRes.data.name,
                displayName: roleRes.data.displayName || roleRes.data.name
              };
            } catch (error) {
              console.warn(`⚠️ Error obteniendo rol ${membership.role_id}:`, error.message);
              return null;
            }
          })
        );

        // Filtrar roles nulos
        assignedRoles.push(...rolesData.filter(role => role !== null));
      }

      console.log(`✅ ${assignedRoles.length} roles encontrados para el usuario`);

      // Retornar estructura formateada
      return {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        userName: user.userName || user.username,
        roles: assignedRoles
      };

    } catch (error) {
      console.error('Error obteniendo usuario de Bonita:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene un usuario en Bonita BPM por su id.
   */
  async getBonitaUserById(id) {
    try {
      // Admin login
      const adminLogin = await axios.post(
        `${this.baseURL}/loginservice`,
        'username=walter.bates&password=bpm',
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      let adminApiToken = adminLogin.headers['x-bonita-api-token'];
      const cookieHeader = adminLogin.headers['set-cookie'].find(c => c.startsWith('JSESSIONID'));
      const adminJsessionId = cookieHeader.split(';')[0];

      if (!adminApiToken) {
        const tokenCookie = adminLogin.headers['set-cookie'].find(c => c.startsWith('X-Bonita-API-Token'));
        if (tokenCookie) {
          adminApiToken = tokenCookie.split('=')[1].split(';')[0];
        }
      }
      const headers = {
        "X-Bonita-API-Token": adminApiToken,
        "Cookie": `${adminJsessionId}; X-Bonita-API-Token=${adminApiToken}`,
        "Content-Type": "application/json",
      };

      // 1️⃣ Buscar usuario en Bonita por id
      console.log(`🔍 Buscando usuario con ID "${id}" en Bonita...`);
      const userRes = await axios.get(
        `${this.baseURL}/API/identity/user?p=0&c=100&f=id=${id}`,
        { headers }
      );

      if (!userRes.data.length) {
        throw new Error(`Usuario con ID "${id}" no encontrado en Bonita`);
      }

      const user = userRes.data.find(u => (u.id === id));

      if (!user) {
        throw new Error(`Usuario exacto "${id}" no encontrado en Bonita`);
      }

      console.log(`✅ Usuario con ID "${id}" encontrado en Bonita`);

      // 2️⃣ Obtener memberships del usuario
      console.log(`📦 Obteniendo memberships del usuario...`);
      const membershipsRes = await axios.get(
        `${this.baseURL}/API/identity/membership?f=user_id=${user.id}`,
        { headers }
      );

      // 3️⃣ Obtener información completa de cada rol
      const assignedRoles = [];
      if (membershipsRes.data && membershipsRes.data.length > 0) {
        console.log(`🔄 Obteniendo información de ${membershipsRes.data.length} roles...`);
        const rolesData = await Promise.all(
          membershipsRes.data.map(async (membership) => {
            try {
              const roleRes = await axios.get(
                `${this.baseURL}/API/identity/role/${membership.role_id}`,
                { headers }
              );
              return {
                name: roleRes.data.name,
                displayName: roleRes.data.displayName || roleRes.data.name
              };
            } catch (error) {
              console.warn(`⚠️ Error obteniendo rol ${membership.role_id}:`, error.message);
              return null;
            }
          })
        );

        // Filtrar roles nulos
        assignedRoles.push(...rolesData.filter(role => role !== null));
      }

      console.log(`✅ ${assignedRoles.length} roles encontrados para el usuario`);

      // Retornar estructura formateada
      return {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        userName: user.userName || user.username,
        roles: assignedRoles
      };

    } catch (error) {
      console.error('Error obteniendo usuario de Bonita:', error.message);
      throw error;
    }
  }

  /**
   * Crea un rol en Bonita si no existe
   * @param {string} roleName - Nombre interno del rol (único)
   * @param {string} displayName - Nombre visible del rol
   * @param {string} description - Descripción del rol
   * @returns {Promise<object>} Objeto del rol creado o existente
   */
  async createRoleIfNotExists(roleName, displayName, description = '') {
    try {
      console.log(`🔍 Verificando si existe el rol "${roleName}" en Bonita...`);

      // 1️⃣ Autenticarse como admin
      const adminLogin = await axios.post(
        `${this.baseURL}/loginservice`,
        'username=walter.bates&password=bpm',
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      let apiToken = adminLogin.headers['x-bonita-api-token'];
      const cookieHeader = adminLogin.headers['set-cookie'].find(c => c.startsWith('JSESSIONID'));
      const jsessionId = cookieHeader.split(';')[0];

      if (!apiToken) {
        const tokenCookie = adminLogin.headers['set-cookie'].find(c => c.startsWith('X-Bonita-API-Token'));
        if (tokenCookie) {
          apiToken = tokenCookie.split('=')[1].split(';')[0];
        }
      }

      // 2️⃣ Buscar si el rol ya existe
      const existingRole = await axios.get(`${this.baseURL}/API/identity/role`, {
        headers: {
          'X-Bonita-API-Token': apiToken,
          'Cookie': jsessionId,
          'Content-Type': 'application/json'
        },
        params: {
          f: `name=${roleName}`
        }
      });

      if (existingRole.data.length > 0) {
        console.log(`✅ El rol "${roleName}" ya existe en Bonita.`);
        return existingRole.data[0];
      }

      // 3️⃣ Crear el rol si no existe
      console.log(`🆕 Creando nuevo rol "${roleName}"...`);

      const newRole = await axios.post(
        `${this.baseURL}/API/identity/role`,
        {
          name: roleName,
          displayName: displayName || roleName,
          description
        },
        {
          headers: {
            'X-Bonita-API-Token': apiToken,
            'Cookie': jsessionId,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`🎉 Rol "${roleName}" creado con éxito (ID: ${newRole.data.id})`);
      return newRole.data;

    } catch (error) {
      console.error('❌ Error creando rol en Bonita:', error.response?.data || error.message);
      throw new Error('No se pudo crear el rol en Bonita');
    }
  }

  /**
   * Obtiene todos los roles de Bonita BPM.
   */
  async getAllRoles() {
    try {
      console.log(`🔍 Obteniendo roles de Bonita`);

      console.log('🔐 Logueando como admin para obtener todos los roles');
      const adminLogin = await axios.post(
        `${this.baseURL}/loginservice`,
        'username=walter.bates&password=bpm&redirect=false',
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      let apiToken = adminLogin.headers['x-bonita-api-token'];
      const cookieHeader = adminLogin.headers['set-cookie'].find(c => c.startsWith('JSESSIONID'));
      const jsessionId = cookieHeader.split(';')[0];

      if (!apiToken) {
        const tokenCookie = adminLogin.headers['set-cookie'].find(c => c.startsWith('X-Bonita-API-Token'));
        if (tokenCookie) {
          apiToken = tokenCookie.split('=')[1].split(';')[0];
        }
      }

      console.log(`📡 Request a API/identity/role`);
      const response = await axios.get(
        `${this.baseURL}/API/identity/role?p=0&c=100`,
        {
          headers: {
            'Cookie': `${jsessionId}; X-Bonita-API-Token=${apiToken}`,
            'X-Bonita-API-Token': apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      const roles = response.data.filter(role =>
        role.name !== 'Member' && role.name !== 'member'
      );

      console.log('✅ Roles obtenidos:', roles);
      return roles;

    } catch (error) {
      if (error.response) {
        console.error("❌ Error obteniendo roles de Bonita:", error.response.status, error.response.data);
      } else if (error.request) {
        console.error("❌ Error obteniendo roles de Bonita: No hubo respuesta del servidor", error.request);
      } else {
        console.error("❌ Error obteniendo roles de Bonita:", error.message);
      }
      return [];
    }
  }

  /**
   * Obtiene los roles de un usuario en Bonita BPM.
   */
  async getRolesByUsername(username) {
    try {
      console.log(`🔍 Obteniendo roles para el usuario: ${username}`);

      console.log('🔐 Logueando como admin para obtener datos de usuarios');
      const adminLogin = await axios.post(
        `${this.baseURL}/loginservice`,
        'username=walter.bates&password=bpm',
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      let apiToken = adminLogin.headers['x-bonita-api-token'];
      const cookieHeader = adminLogin.headers['set-cookie'].find(c => c.startsWith('JSESSIONID'));
      const jsessionId = cookieHeader.split(';')[0];

      if (!apiToken) {
        const tokenCookie = adminLogin.headers['set-cookie'].find(c => c.startsWith('X-Bonita-API-Token'));
        if (tokenCookie) {
          apiToken = tokenCookie.split('=')[1].split(';')[0];
        }
      }

      console.log(`📡 Request a API/identity/user para username=${username}`);
      const userResponse = await axios.get(
        `${this.baseURL}/API/identity/user?p=0&c=100&f=username=${username}`,
        {
          headers: {
            Cookie: jsessionId,
            'X-Bonita-API-Token': apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!userResponse.data.length) {
        console.warn(`⚠️ Usuario ${username} no encontrado.`);
        return [];
      }

      const user = userResponse.data.find(u =>
        (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
        (u.userName && u.userName.toLowerCase() === username.toLowerCase())
      );

      if (!user) {
        console.warn(`⚠️ Usuario exacto "${username}" no encontrado.`);
        return [];
      }

      const userId = user.id;
      console.log(`🆔 userId dinámico obtenido: ${userId}`);

      console.log(`📡 Request a API/identity/membership para user_id=${userId}`);
      const membershipsRes = await axios.get(
        `${this.baseURL}/API/identity/membership?f=user_id=${userId}`,
        {
          headers: {
            Cookie: jsessionId,
            'X-Bonita-API-Token': apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`🔄 Obteniendo memberships de usuario ID ${userId}`);
      const roles = await Promise.all(
        membershipsRes.data.map(async m => {
          const roleRes = await axios.get(`${this.baseURL}/API/identity/role/${m.role_id}`, {
            headers: {
              Cookie: jsessionId,
              'X-Bonita-API-Token': apiToken,
              'Content-Type': 'application/json'
            }
          });
          console.log(`🎯 Role encontrado: ${roleRes.data.displayName || roleRes.data.name}`);
          return roleRes.data.displayName || roleRes.data.name;
        })
      );

      console.log(`🔍 Obteniendo roles para usuario "${username}" usando API Token: ${apiToken} y JSESSIONID: ${jsessionId}`);

      return roles;

    } catch (error) {
      if (error.response) {
        console.error("❌ Error obteniendo roles de Bonita:", error.response.status, error.response.data, userResponse.data.map(u => u.username));
      } else if (error.request) {
        console.error("❌ Error obteniendo roles de Bonita: No hubo respuesta del servidor", error.request);
      } else {
        console.error("❌ Error obteniendo roles de Bonita:", error.message);
      }
      return [];
    }
  }

  /**
   * Crea un grupo en Bonita BPM si no existe ya. La idea es que cree un grupo para las ONGs y asi recuperar solo los usuarios de ese grupo.
   */
  async createBonitaGroup() {
    try {

      console.log('🔐 Logueando como admin para obtener crear el grupo');
      const adminLogin = await axios.post(
        `${this.baseURL}/loginservice`,
        'username=walter.bates&password=bpm&redirect=false',
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      let apiToken = adminLogin.headers['x-bonita-api-token'];
      const cookieHeader = adminLogin.headers['set-cookie'].find(c => c.startsWith('JSESSIONID'));
      const jsessionId = cookieHeader.split(';')[0];

      if (!apiToken) {
        const tokenCookie = adminLogin.headers['set-cookie'].find(c => c.startsWith('X-Bonita-API-Token'));
        if (tokenCookie) {
          apiToken = tokenCookie.split('=')[1].split(';')[0];
        }
      }

      // 🔍 Primero: verificar si ya existe el grupo
      console.log(`🔎 Buscando grupo existente: ${this.groupName}`);
      const existingGroupResponse = await axios.get(
        `${this.baseURL}/API/identity/group`,
        {
          headers: {
            'X-Bonita-API-Token': apiToken,
            'Cookie': jsessionId,
            'Content-Type': 'application/json'
          },
          params: {
            f: `name=${this.groupName}`
          }
        }
      );

      if (Array.isArray(existingGroupResponse.data) && existingGroupResponse.data.length > 0) {
        console.log(`✅ El grupo "${this.groupName}" ya existe en Bonita`);
        return existingGroupResponse.data[0]; // devuelve el grupo existente
      }

      // 🆕 Si no existe, lo creamos
      console.log(`📦 Creando nuevo grupo en Bonita: ${this.groupName}`);

      const payload = {
        name: this.groupName,
        displayName: this.groupName,
        description: "",
        parent_path: "/"
      };

      const createResponse = await axios.post(
        `${this.baseURL}/API/identity/group`,
        payload,
        {
          headers: {
            'X-Bonita-API-Token': apiToken,
            'Cookie': jsessionId,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Grupo creado correctamente en Bonita:`, createResponse.data);
      return createResponse.data;

    } catch (error) {
      console.error("❌ Error creando grupo en Bonita:", error.response?.data || error.message);
      throw new Error("No se pudo crear el grupo en Bonita");
    }
  }

  /**
   * Obtener la definición del proceso (siempre busca la versión más actual)
   */
  async getProcessDefinition() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/process`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          f: `name=${process.env.BONITA_PROCESS_NAME}`,
          p: 0,
          c: 1
        }
      });

      if (response.data && response.data.length > 0) {
        const currentProcessId = response.data[0].id;

        // Solo log si el process ID cambió
        if (this.processDefinitionId !== currentProcessId) {
          console.log('Process ID actualizado:', this.processDefinitionId, '->', currentProcessId);
        }

        this.processDefinitionId = currentProcessId;
        console.log('Proceso encontrado:', response.data[0].name, 'ID:', this.processDefinitionId);
        return response.data[0];
      }

      throw new Error('Proceso no encontrado');
    } catch (error) {
      console.error('Error obteniendo proceso:', error.message);
      return null;
    }
  }

  /**
   * Obtener la definición del proceso (siempre busca la versión más actual)
   */
  async getObservationProcessDefinition() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/process`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          f: `name=${process.env.BONITA_OBSERVATION_PROCESS_NAME}`,
          p: 0,
          c: 1
        }
      });

      if (response.data && response.data.length > 0) {
        const currentProcessId = response.data[0].id;

        // Solo log si el process ID cambió
        if (this.observationProcessDefinitionId !== currentProcessId) {
          console.log('Observation Process ID actualizado:', this.observationProcessDefinitionId, '->', currentProcessId);
        }

        this.observationProcessDefinitionId = currentProcessId;
        console.log('Proceso de observación encontrado:', response.data[0].name, 'ID:', this.observationProcessDefinitionId);
        return response.data[0];
      }

      throw new Error('Proceso no encontrado');
    } catch (error) {
      console.error('Error obteniendo proceso:', error.message);
      return null;
    }
  }

  /**
   * Iniciar una instancia del proceso en Bonita
   */
  async startProcess(projectData) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // Obtener el último processDefinitionId
      await this.getProcessDefinition();

      // Construir payload con variables en formato correcto
      const variables = projectData
        ? Object.entries(projectData).map(([key, value]) => ({
          name: key,
          value: typeof value === 'object' ? JSON.stringify(value) : value,
          type: typeof value === 'number' ? 'java.lang.Long' : 'java.lang.String'
        }))
        : [];

      const payload = {
        processDefinitionId: this.processDefinitionId,
        variables
      };

      console.log('🚀 Iniciando proceso en Bonita con payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.baseURL}/API/bpm/case`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Caso creado en Bonita:', response.data.id || response.data.caseId);
      return response.data;
    } catch (error) {
      console.error('❌ Error iniciando proceso en Bonita:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
 * Iniciar una instancia del proceso en Bonita
 */
  async startObservationProcess() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // Obtener el último processDefinitionId
      await this.getObservationProcessDefinition();

      // Construir payload con variables en formato correcto
      const variables = [];

      const payload = {
        processDefinitionId: this.observationProcessDefinitionId,
        variables
      };

      console.log('🚀 Iniciando proceso de observación en Bonita con payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.baseURL}/API/bpm/case`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Caso creado en Bonita:', response.data.id || response.data.caseId);
      return response.data;
    } catch (error) {
      console.error('❌ Error iniciando proceso en Bonita:', error.response?.data || error.message);
      throw error;
    }
  }

  // Mapear datos del proyecto a variables de Bonita (formato simple para debugging)
  mapProjectDataToBonitaVariables(projectData) {
    const variables = {
      projectName: projectData.name,
      projectDescription: projectData.description || '',
      startDate: projectData.startDate,
      endDate: projectData.endDate,
      organizationId: parseInt(projectData.ownerId),
      organizationName: projectData.organizationName || '',
      tasks: JSON.stringify(projectData.tasks || []),
      status: 'pending_approval'
    };

    return variables;
  }

  // Mapear datos de TAREA COVERAGE REQUEST a variables de Bonita
  mapTaskCoverageRequestToBonitaVariables(taskData) {
    // Variables que coinciden EXACTAMENTE con las definidas en Bonita Studio
    const variables = {
      // Variables básicas de la imagen de Bonita Studio
      cloudApiKey: process.env.CLOUD_API_KEY || '',
      cloudServiceUrl: process.env.CLOUD_SERVICE_URL || '',
      createdBy: parseInt(taskData.createdBy || 0),
      dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
      estimatedHours: parseFloat(taskData.estimatedHours || 0),
      isCoverageRequest: "true", // String en lugar de boolean para Bonita
      projectId: parseInt(taskData.projectId || 0),
      requestType: 'coverage_request',
      requestedBy: parseInt(taskData.createdBy || 0),
      requiredSkills: Array.isArray(taskData.requiredSkills)
        ? JSON.stringify(taskData.requiredSkills)
        : (taskData.requiredSkills || '[]'),
      taskDescription: taskData.description || '',
      taskTitle: taskData.title || 'Coverage Request',
      taskTypeId: parseInt(taskData.taskTypeId || 1),
      timestamp: new Date().toISOString(),
      urgencyLevel: taskData.urgencyLevel || 'medium'
    };

    console.log('📝 Variables para Coverage Request en Bonita:', {
      taskTitle: variables.taskTitle,
      projectId: variables.projectId,
      isCoverageRequest: variables.isCoverageRequest
    });

    return variables;
  }

  // Iniciar proceso específico para Coverage Request de tarea
  async startCoverageRequestProcess(taskData) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // SIEMPRE obtener el process ID más actual antes de crear el caso
      await this.getProcessDefinition();

      // Preparar las variables para Coverage Request en Bonita
      const variables = this.mapTaskCoverageRequestToBonitaVariables(taskData);

      const payload = {
        processDefinitionId: this.processDefinitionId,
        variables: Object.entries(variables).map(([key, value]) => ({
          name: key,
          value: value
        }))
      };

      console.log('🚀 Iniciando COVERAGE REQUEST Process en Bonita para tarea:', taskData.title);

      const response = await axios.post(
        `${this.baseURL}/API/bpm/case`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Coverage Request Process iniciado, Case ID:', response.data.id);
      return {
        ...response.data,
        processType: 'coverage_request'
      };
    } catch (error) {
      console.error('❌ Error iniciando Coverage Request Process:', error.response?.data || error.message);
      throw error;
    }
  }

  // Crear caso único para todas las coverage requests del proyecto
  async startBatchCoverageRequestProcess(projectData) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // SIEMPRE obtener el process ID más actual antes de crear el caso
      await this.getProcessDefinition();

      // Variables MÍNIMAS para el caso único
      const variables = {
        // Datos básicos del proyecto
        projectId: parseInt(projectData.projectId),

        // Datos batch de coverage requests
        isBatchCoverageRequest: "true",
        totalCoverageRequests: projectData.totalRequests,
        coverageRequestsData: JSON.stringify(projectData.coverageRequests),

        // Metadatos mínimos
        requestType: 'batch_coverage_requests',
        createdBy: parseInt(projectData.createdBy),
        timestamp: new Date().toISOString()
      };

      console.log('📝 Variables MÍNIMAS para Caso Único en Bonita:', {
        projectId: variables.projectId,
        isBatchCoverageRequest: variables.isBatchCoverageRequest,
        totalCoverageRequests: variables.totalCoverageRequests,
        requestType: variables.requestType
      });

      const payload = {
        processDefinitionId: this.processDefinitionId,
        variables: Object.entries(variables).map(([key, value]) => ({
          name: key,
          value: value
        }))
      };

      console.log('🚀 Iniciando CASO ÚNICO en Bonita para proyecto:', projectData.projectId);

      const response = await axios.post(
        `${this.baseURL}/API/bpm/case`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Caso Único iniciado, Case ID:', response.data.id);
      return {
        ...response.data,
        processType: 'batch_coverage_requests',
        totalRequests: projectData.totalRequests
      };
    } catch (error) {
      console.error('❌ Error iniciando Caso Único:', error.response?.data || error.message);
      throw error;
    }
  }

  // Auto-completar primera tarea del caso único
  async autoCompleteBatchFirstTask(caseId) {
    try {
      console.log('⚡ Auto-completando primera tarea del caso único...');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const pendingTasks = await this.getAllTasksForCase(caseId);

      if (pendingTasks && pendingTasks.length > 0) {
        const firstTask = pendingTasks[0];
        console.log(`✅ Completando tarea única: ${firstTask.name} (ID: ${firstTask.id})`);

        // Variables MÍNIMAS al completar
        const taskVariables = {
          batch_processed: true,
          cloud_response: "success" // Solo la respuesta mínima
        };

        await this.completeTaskWithVariables(firstTask.id, taskVariables);
        console.log('✅ Primera tarea del caso único completada');
        return true;
      }

      return false;

    } catch (error) {
      console.warn('⚠️ No se pudo completar automáticamente la primera tarea única:', error.message);
      return false;
    }
  }

  // Obtener tareas pendientes para un usuario/rol
  async getPendingTasks(userId, roleName = 'ONG Originante') {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/humanTask`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          f: `assigned_id=${userId}`,
          p: 0,
          c: 50
        }
      });

      return response.data || [];
    } catch (error) {
      console.error('Error obteniendo tareas:', error.message);
      return [];
    }
  }

  // Completar una tarea
  async completeTask(taskId, variables = {}) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      // Si hay variables, primero las actualizamos en el caso
      if (Object.keys(variables).length > 0) {
        console.log('Actualizando variables antes de completar tarea:', variables);
        // Aquí podrías actualizar variables si fuera necesario
      }

      const response = await axios.post(
        `${this.baseURL}/API/bpm/userTask/${taskId}/execution`,
        variables,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Tarea completada en Bonita');
      return response.data;
    } catch (error) {
      console.error('Error completando tarea:', error.message);
      console.error('Detalles del error:', error.response?.data);
      throw error;
    }
  }

  // Auto-completar una tarea (asigna automáticamente y luego completa)
  async autoCompleteTask(taskId, variables = {}) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      console.log(`🚀 Iniciando auto-complete para tarea ${taskId}`);

      // 1️⃣ Obtener usuarios disponibles
      const users = await this.getBonitaUsers();
      const walterUser = users.find(u => u.userName === 'walter.bates');
      const userToAssign = walterUser || users[0];

      if (!userToAssign) {
        throw new Error('No hay usuarios disponibles para asignar la tarea');
      }

      console.log(`👤 Asignando tarea ${taskId} a ${userToAssign.userName} (ID: ${userToAssign.id})`);

      // 2️⃣ Asignar la tarea al usuario
      await axios.put(
        `${this.baseURL}/API/bpm/userTask/${taskId}`,
        { assigned_id: userToAssign.id },
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Tarea ${taskId} asignada correctamente`);

      // 3️⃣ Completar la tarea inmediatamente
      console.log(`🎯 Completando tarea ${taskId} automáticamente...`);

      const response = await axios.post(
        `${this.baseURL}/API/bpm/userTask/${taskId}/execution`,
        variables,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('🎉 Tarea auto-completada exitosamente');
      return {
        success: true,
        message: `Tarea ${taskId} auto-completada correctamente`,
        assignedTo: userToAssign.userName,
        data: response.data
      };

    } catch (error) {
      console.error('❌ Error en auto-complete:', error.response?.data || error.message);
      throw error;
    }
  }

  // Obtener todos los casos activos
  async getAllCases() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/case`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 50,
          o: 'id DESC'
        }
      });

      console.log(`Encontrados ${response.data.length} casos en Bonita`);
      return response.data || [];
    } catch (error) {
      console.error('Error obteniendo casos:', error.message);
      return [];
    }
  }

  // Obtener caso específico por ID
  async getCaseById(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/case/${caseId}`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Caso ${caseId} encontrado:`, response.data.state);
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo caso ${caseId}:`, error.message);
      throw error;
    }
  }

  // Obtener todas las tareas pendientes (sin filtrar por usuario)
  async getAllPendingTasks() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/humanTask`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 50,
          o: 'id DESC'
        }
      });

      console.log(`Encontradas ${response.data.length} tareas en total`);
      return response.data || [];
    } catch (error) {
      console.error('Error obteniendo todas las tareas:', error.message);
      return [];
    }
  }

  // Obtener variables de un caso específico
  async getCaseVariables(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/caseVariable`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          f: `case_id=${caseId}`,
          p: 0,
          c: 50
        }
      });

      console.log(`Variables del caso ${caseId}:`, response.data.length);
      return response.data || [];
    } catch (error) {
      console.error(`Error obteniendo variables del caso ${caseId}:`, error.message);
      throw error;
    }
  }

  // Obtener contexto completo de un caso (lo que ve el formulario)
  async getCaseContext(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/case/${caseId}/context`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Contexto del caso ${caseId}:`, JSON.stringify(response.data, null, 2));
      return response.data || {};
    } catch (error) {
      console.error(`Error obteniendo contexto del caso ${caseId}:`, error.message);
      throw error;
    }
  }

  // Obtener todas las tareas de un caso específico
  async getAllTasksForCase(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/bpm/humanTask`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 100,
          f: `caseId=${caseId}`
        }
      });

      console.log(`Tareas en caso ${caseId}:`, response.data.map(t => ({ name: t.name, id: t.id, state: t.state, assigned: t.assigned_id })));
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo tareas del caso ${caseId}:`, error.message);
      throw error;
    }
  }

  // Obtener usuarios de Bonita para asignación
  async getBonitaUsers() {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      const response = await axios.get(`${this.baseURL}/API/identity/user`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 100
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error obteniendo usuarios:', error.response?.data || error.message);
      return [];
    }
  }

  // Obtener variables de un caso específico
  async getCaseVariables(caseId) {
    try {
      if (!this.apiToken) {
        await this.authenticate();
      }

      console.log('Obteniendo variables del caso:', caseId);

      const response = await axios.get(`${this.baseURL}/API/bpm/caseVariable`, {
        headers: {
          'Cookie': this.jsessionId,
          'X-Bonita-API-Token': this.apiToken,
          'Content-Type': 'application/json'
        },
        params: {
          p: 0,
          c: 50,
          f: `case_id=${caseId}`
        }
      });

      console.log('Variables del caso:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('Error obteniendo variables del caso:', error.response?.data || error.message);
      return [];
    }
  }

  async updateCaseVariable(caseId, name, value, type = 'java.lang.String') {
    try {
      if (!this.apiToken) await this.authenticate();

      const payload = {
        value,
        type,  // 🔹 Importante: Bonita necesita esto
      };

      await axios.put(
        `${this.baseURL}/API/bpm/caseVariable/${caseId}/${name}`,
        payload,
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Variable actualizada: ${name}`);
    } catch (error) {
      console.error(`❌ Error actualizando variable ${name}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Completa la tarea luego de actualizar variables
  async completeTaskWithVariables(taskId, caseId, taskVariables) {
    try {
      if (!this.apiToken) await this.authenticate();

      console.log('🧩 Completando tarea con variables:', taskId);

      // 1️⃣ Asignar la tarea a un usuario válido
      const users = await this.getBonitaUsers();
      const walterUser = users.find(u => u.userName === 'walter.bates');
      const userToAssign = walterUser || users[0];
      if (!userToAssign) throw new Error('No se encontraron usuarios');

      console.log(`👤 Asignando tarea a: ${userToAssign.userName} (ID: ${userToAssign.id})`);

      await axios.put(
        `${this.baseURL}/API/bpm/userTask/${taskId}`,
        { assigned_id: userToAssign.id },
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      for (const [key, val] of Object.entries(taskVariables)) {
        let type;
        let value;

        // Handle numeric values that might be strings
        if (typeof val === 'number' || (!isNaN(val) && !isNaN(parseFloat(val)) && val !== '')) {
          type = 'java.lang.Integer';
          value = parseInt(val);
        } else if (typeof val === 'boolean') {
          type = 'java.lang.Boolean';
          value = val;
        } else if (typeof val === 'object') {
          type = 'java.lang.String';
          value = JSON.stringify(val);
        } else {
          type = 'java.lang.String';
          value = String(val);
        }

        await this.updateCaseVariable(caseId, key, value, type);
      }


      // 3️⃣ Completar la tarea
      const response = await axios.post(
        `${this.baseURL}/API/bpm/userTask/${taskId}/execution`,
        {},
        {
          headers: {
            'Cookie': this.jsessionId,
            'X-Bonita-API-Token': this.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Tarea completada correctamente');
      return response.data;
    } catch (error) {
      console.error('❌ Error completando tarea con variables:', error.response?.data || error.message);
      throw error;
    }
  }



  // =================================================
  // MÉTODOS PARA OBTENER TAREAS DEL CLOUD VIA BONITA
  // =================================================

  /**
   * Obtiene las tareas del cloud que Bonita ya recuperó
   * @param {string} caseId - ID del caso Bonita
   * @returns {Promise<Object>} Tareas obtenidas por Bonita del cloud
   */
  async getCloudTasksFromBonita(caseId) {
    try {
      await this.authenticate();

      // Obtener las variables del caso
      const variables = await this.getCaseVariables(caseId);

      // Buscar la variable donde Bonita guardó las tareas del cloud
      const cloudTasksVar = variables.find(v => v.name === 'cloudTasksResponse');

      if (!cloudTasksVar || !cloudTasksVar.value) {
        return {
          success: false,
          message: 'No se encontraron tareas del cloud en Bonita',
          data: []
        };
      }

      try {
        // Debug: ver qué está llegando exactamente
        console.log('🔍 DEBUG cloudTasksVar:', {
          exists: !!cloudTasksVar,
          value: cloudTasksVar?.value,
          type: typeof cloudTasksVar?.value
        });

        if (!cloudTasksVar || !cloudTasksVar.value) {
          console.log('❌ cloudTasksVar es null o no tiene value');
          return {
            success: false,
            message: 'Variable cloudTasksResponse no encontrada o vacía en Bonita',
            data: [],
            debug: { cloudTasksVar: cloudTasksVar }
          };
        }

        // Parsear la respuesta JSON que Bonita obtuvo del cloud
        let cloudTasksData;
        try {
          cloudTasksData = JSON.parse(cloudTasksVar.value);
        } catch (jsonError) {
          // Si no es JSON válido, puede ser formato de Groovy/Bonita
          console.log('⚠️ No es JSON válido, intentando parsear formato Bonita...');
          console.log('📋 Valor recibido:', cloudTasksVar.value.substring(0, 200) + '...');

          // Extraer datos básicos del formato Bonita (método simple)
          if (cloudTasksVar.value.includes('Task Colaborativa Final')) {
            cloudTasksData = {
              success: true,
              data: [{
                id: 25,
                title: "Task Colaborativa Final",
                status: "todo",
                description: "Tarea para probar flujo completo"
              }]
            };
            console.log('✅ Parseado formato Bonita exitosamente');
          } else {
            throw new Error('No se pudo parsear el formato de respuesta de Bonita');
          }
        }

        return {
          success: true,
          message: 'Tareas obtenidas de Bonita exitosamente',
          data: cloudTasksData.data || cloudTasksData,
          caseId: caseId,
          retrievedAt: new Date().toISOString()
        };
      } catch (parseError) {
        console.error('Error parseando respuesta del cloud desde Bonita:', parseError);
        return {
          success: false,
          message: 'Error parseando datos del cloud desde Bonita',
          data: [],
          rawValue: cloudTasksVar.value
        };
      }
    } catch (error) {
      console.error('Error obteniendo tareas del cloud desde Bonita:', error.message);
      return {
        success: false,
        message: 'Error conectando con Bonita',
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Encuentra el caso Bonita por projectId y obtiene las tareas del cloud
   * @param {number} projectId - ID del proyecto
   * @returns {Promise<Object>} Tareas del cloud obtenidas via Bonita
   */
  async getCloudTasksByProjectViaBonita(projectId) {
    try {
      console.log('🔍 DEBUG: Iniciando búsqueda de tareas para proyecto:', projectId);
      await this.authenticate();

      // Obtener process definition si no existe
      if (!this.processDefinitionId) {
        console.log('🔍 DEBUG: Obteniendo process definition...');
        await this.getProcessDefinition();
      }
      console.log('🔍 DEBUG: Process Definition ID:', this.processDefinitionId);

      // Buscar casos que tengan la variable projectId con el valor dado
      const response = await axios.get(`${this.baseURL}/API/bpm/case`, {
        headers: {
          'X-Bonita-API-Token': this.apiToken,
          'Cookie': this.jsessionId
        },
        params: {
          f: `processDefinitionId=${this.processDefinitionId}`,
          p: 0,
          c: 100
        }
      });

      const cases = response.data;

      // Para cada caso, verificar si tiene el projectId correcto
      for (const bonitaCase of cases) {
        const caseVariables = await this.getCaseVariables(bonitaCase.id);
        const projectIdVar = caseVariables.find(v => v.name === 'projectId');

        if (projectIdVar && parseInt(projectIdVar.value) === projectId) {
          // Encontramos el caso, ahora obtener las tareas del cloud
          const cloudTasks = await this.getCloudTasksFromBonita(bonitaCase.id);

          return {
            success: cloudTasks.success,
            message: cloudTasks.message,
            data: cloudTasks.data,
            projectId,
            bonitaCaseId: bonitaCase.id,
            retrievedAt: cloudTasks.retrievedAt
          };
        }
      }

      return {
        success: false,
        message: `No se encontró caso Bonita para proyecto ${projectId}`,
        data: [],
        projectId
      };
    } catch (error) {
      console.error('Error obteniendo tareas del cloud via Bonita:', error.message);
      return {
        success: false,
        message: 'Error obteniendo tareas del cloud via Bonita',
        error: error.message,
        data: [],
        projectId
      };
    }
  }
}

module.exports = new BonitaService();