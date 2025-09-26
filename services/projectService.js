const { Project, ProjectForm, User } = require('../models');
const bonitaService = require('./bonitaService');
const Joi = require('joi');

class ProjectService {

  // Esquema de validación para proyectos
  getProjectSchema() {
    return Joi.object({
      name: Joi.string().min(3).max(255).required(),
      description: Joi.string().max(1000),
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().greater(Joi.ref('startDate')),
      budget: Joi.number().positive(),
      currency: Joi.string().length(3).default('USD'),
      priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
      category: Joi.string().max(100),
      managerId: Joi.number().integer().positive(),
      formFields: Joi.object().pattern(
        Joi.string(),
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.date())
      )
    });
  }

  // Validar datos del proyecto
  async validateProjectData(projectData) {
    try {
      const schema = this.getProjectSchema();
      const { error, value } = schema.validate(projectData, { 
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return {
          isValid: false,
          errors: error.details.map(detail => detail.message)
        };
      }

      // Validar que el manager existe si se proporciona
      if (value.managerId) {
        const manager = await User.findByPk(value.managerId);
        if (!manager) {
          return {
            isValid: false,
            errors: ['Manager no encontrado']
          };
        }
      }

      return {
        isValid: true,
        data: value
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Error de validación: ${error.message}`]
      };
    }
  }

  // Crear nuevo proyecto
  async createProject(projectData, userId) {
    try {
      // Validar datos
      const validation = await this.validateProjectData(projectData);
      if (!validation.isValid) {
        throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
      }

      const validatedData = validation.data;
      const { formFields, ...projectFields } = validatedData;

      // Crear proyecto en la base de datos
      const project = await Project.create({
        ...projectFields,
        createdBy: userId,
        status: 'draft'
      });

      // Guardar campos adicionales del formulario
      if (formFields) {
        const formFieldsArray = Object.entries(formFields).map(([fieldName, fieldValue]) => ({
          projectId: project.id,
          fieldName,
          fieldValue: typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue),
          fieldType: this.getFieldType(fieldValue)
        }));

        if (formFieldsArray.length > 0) {
          await ProjectForm.bulkCreate(formFieldsArray);
        }
      }

      // Obtener proyecto completo con relaciones
      const completeProject = await this.getProjectById(project.id, userId);

      return completeProject;
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Error creando proyecto: ${error.message}`);
    }
  }

  // Obtener proyecto por ID
  async getProjectById(projectId, userId = null) {
    try {
      const whereClause = { id: projectId };
      
      // Si se proporciona userId, verificar que tenga acceso
      if (userId) {
        whereClause[Sequelize.Op.or] = [
          { createdBy: userId },
          { managerId: userId }
        ];
      }

      const project = await Project.findOne({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'firstName', 'lastName', 'email']
          },
          {
            model: User,
            as: 'manager',
            attributes: ['id', 'username', 'firstName', 'lastName', 'email']
          },
          {
            model: ProjectForm,
            as: 'formFields'
          }
        ]
      });

      if (!project) {
        throw new Error('Proyecto no encontrado');
      }

      // Transformar campos del formulario a objeto
      const formFieldsObject = {};
      if (project.formFields) {
        project.formFields.forEach(field => {
          formFieldsObject[field.fieldName] = this.parseFieldValue(field.fieldValue, field.fieldType);
        });
      }

      return {
        ...project.toJSON(),
        formFields: formFieldsObject
      };
    } catch (error) {
      console.error('Error getting project:', error);
      throw new Error(`Error obteniendo proyecto: ${error.message}`);
    }
  }

  // Obtener proyectos del usuario
  async getUserProjects(userId, options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status = null, 
        category = null,
        search = null
      } = options;

      const whereClause = {
        [Sequelize.Op.or]: [
          { createdBy: userId },
          { managerId: userId }
        ]
      };

      if (status) {
        whereClause.status = status;
      }

      if (category) {
        whereClause.category = category;
      }

      if (search) {
        whereClause[Sequelize.Op.or] = [
          ...whereClause[Sequelize.Op.or],
          { name: { [Sequelize.Op.like]: `%${search}%` } },
          { description: { [Sequelize.Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await Project.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'firstName', 'lastName']
          },
          {
            model: User,
            as: 'manager',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return {
        projects: rows,
        pagination: {
          total: count,
          page,
          pages: Math.ceil(count / limit),
          limit
        }
      };
    } catch (error) {
      console.error('Error getting user projects:', error);
      throw new Error(`Error obteniendo proyectos del usuario: ${error.message}`);
    }
  }

  // Actualizar proyecto
  async updateProject(projectId, updateData, userId) {
    try {
      const project = await Project.findOne({
        where: {
          id: projectId,
          [Sequelize.Op.or]: [
            { createdBy: userId },
            { managerId: userId }
          ]
        }
      });

      if (!project) {
        throw new Error('Proyecto no encontrado o sin permisos');
      }

      const validation = await this.validateProjectData(updateData);
      if (!validation.isValid) {
        throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
      }

      const validatedData = validation.data;
      const { formFields, ...projectFields } = validatedData;

      // Actualizar proyecto
      await project.update(projectFields);

      // Actualizar campos del formulario
      if (formFields) {
        // Eliminar campos existentes
        await ProjectForm.destroy({ where: { projectId } });

        // Crear nuevos campos
        const formFieldsArray = Object.entries(formFields).map(([fieldName, fieldValue]) => ({
          projectId,
          fieldName,
          fieldValue: typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue),
          fieldType: this.getFieldType(fieldValue)
        }));

        if (formFieldsArray.length > 0) {
          await ProjectForm.bulkCreate(formFieldsArray);
        }
      }

      return await this.getProjectById(projectId, userId);
    } catch (error) {
      console.error('Error updating project:', error);
      throw new Error(`Error actualizando proyecto: ${error.message}`);
    }
  }

  // Enviar proyecto a Bonita
  async submitProjectToBonita(projectId, userId) {
    try {
      const project = await this.getProjectById(projectId, userId);
      
      if (project.status !== 'draft') {
        throw new Error('Solo se pueden enviar proyectos en estado draft');
      }

      // Crear proceso en Bonita
      const bonitaResult = await bonitaService.createProjectProcess({
        projectId: project.id,
        projectName: project.name,
        projectData: project,
        createdBy: userId
      });

      // Actualizar proyecto con información de Bonita
      await Project.update({
        status: 'submitted',
        bonitaCaseId: bonitaResult.caseId,
        bonitaProcessId: bonitaResult.definitionId
      }, {
        where: { id: projectId }
      });

      return await this.getProjectById(projectId, userId);
    } catch (error) {
      console.error('Error submitting project to Bonita:', error);
      throw new Error(`Error enviando proyecto a Bonita: ${error.message}`);
    }
  }

  // Obtener estado del proyecto desde Bonita
  async getProjectBonitaStatus(projectId, userId) {
    try {
      const project = await Project.findOne({
        where: {
          id: projectId,
          [Sequelize.Op.or]: [
            { createdBy: userId },
            { managerId: userId }
          ]
        }
      });

      if (!project || !project.bonitaCaseId) {
        throw new Error('Proyecto no encontrado o no enviado a Bonita');
      }

      const bonitaStatus = await bonitaService.getProjectStatus(project.bonitaCaseId);
      
      return {
        project: project.toJSON(),
        bonitaStatus
      };
    } catch (error) {
      console.error('Error getting project Bonita status:', error);
      throw new Error(`Error obteniendo estado desde Bonita: ${error.message}`);
    }
  }

  // Utilidades privadas
  getFieldType(value) {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') return 'json';
    return 'text';
  }

  parseFieldValue(value, type) {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === true;
      case 'date':
        return new Date(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }
}

module.exports = new ProjectService();