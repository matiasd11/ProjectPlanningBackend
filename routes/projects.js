const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const projectService = require('../services/projectService');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Rate limiting para creación de proyectos
const createProjectLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 proyectos por 15 minutos
  message: {
    error: 'Demasiados proyectos creados. Intenta nuevamente en 15 minutos.'
  }
});

// Middleware de validación
const validateProject = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('El nombre debe tener entre 3 y 255 caracteres'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio debe ser válida (ISO 8601)'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin debe ser válida (ISO 8601)')
    .custom((endDate, { req }) => {
      if (req.body.startDate && endDate <= req.body.startDate) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    }),
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El presupuesto debe ser un número positivo'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Prioridad debe ser: low, medium, high o critical'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La categoría no puede exceder 100 caracteres'),
  body('managerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID del manager debe ser un número positivo')
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100'),
  query('status')
    .optional()
    .isIn(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Estado no válido')
];

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array()
    });
  }
  next();
};

// Crear nuevo proyecto
router.post('/create', 
  requireAuth, 
  createProjectLimit, 
  validateProject, 
  handleValidationErrors,
  async (req, res) => {
    try {
      const projectData = req.body;
      const userId = req.user.id;

      const project = await projectService.createProject(projectData, userId);

      res.status(201).json({
        success: true,
        message: 'Proyecto creado exitosamente',
        data: project
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Obtener proyectos del usuario
router.get('/my-projects', 
  requireAuth, 
  validatePagination, 
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        status: req.query.status,
        category: req.query.category,
        search: req.query.search
      };

      const result = await projectService.getUserProjects(userId, options);

      res.json({
        success: true,
        data: result.projects,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Error getting user projects:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo proyectos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Obtener proyecto específico
router.get('/:id', 
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.id;

      const project = await projectService.getProjectById(projectId, userId);

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Error getting project:', error);
      const statusCode = error.message.includes('no encontrado') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Actualizar proyecto
router.put('/:id', 
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  validateProject,
  handleValidationErrors,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.id;
      const updateData = req.body;

      const project = await projectService.updateProject(projectId, updateData, userId);

      res.json({
        success: true,
        message: 'Proyecto actualizado exitosamente',
        data: project
      });
    } catch (error) {
      console.error('Error updating project:', error);
      const statusCode = error.message.includes('no encontrado') || error.message.includes('sin permisos') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Enviar proyecto a Bonita
router.post('/:id/submit', 
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.id;

      const project = await projectService.submitProjectToBonita(projectId, userId);

      res.json({
        success: true,
        message: 'Proyecto enviado a Bonita exitosamente',
        data: project
      });
    } catch (error) {
      console.error('Error submitting project to Bonita:', error);
      const statusCode = error.message.includes('no encontrado') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Obtener estado del proyecto en Bonita
router.get('/:id/bonita-status', 
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.id;

      const status = await projectService.getProjectBonitaStatus(projectId, userId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error getting project Bonita status:', error);
      const statusCode = error.message.includes('no encontrado') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Eliminar proyecto (soft delete)
router.delete('/:id', 
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.id;

      // Solo permitir eliminar proyectos en estado draft
      const project = await projectService.getProjectById(projectId, userId);
      
      if (project.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Solo se pueden eliminar proyectos en estado draft'
        });
      }

      await projectService.updateProject(projectId, { status: 'cancelled' }, userId);

      res.json({
        success: true,
        message: 'Proyecto eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      const statusCode = error.message.includes('no encontrado') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

module.exports = router;