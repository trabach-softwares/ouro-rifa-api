const Joi = require('joi');
const ResponseFormatter = require('../utils/responseFormatter');
const { DEFAULT_PAGINATION } = require('../config/constants');

class ValidationMiddleware {
  // Validação genérica
  static validate(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        return ResponseFormatter.validationError(res, errors);
      }

      req.body = value;
      next();
    };
  }

  // Validação de parâmetros da URL
  static validateParams(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return ResponseFormatter.validationError(res, errors);
      }

      req.params = value;
      next();
    };
  }

  // Validação de query parameters
  static validateQuery(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return ResponseFormatter.validationError(res, errors);
      }

      req.query = value;
      next();
    };
  }

  // Validação de paginação
  static validatePagination(req, res, next) {
    const paginationSchema = Joi.object({
      page: Joi.number().integer().min(1).default(DEFAULT_PAGINATION.PAGE),
      limit: Joi.number().integer().min(1).max(DEFAULT_PAGINATION.MAX_LIMIT).default(DEFAULT_PAGINATION.LIMIT)
    }).unknown(true);

    const { error, value } = paginationSchema.validate(req.query);

    if (error) {
      return ResponseFormatter.badRequest(res, 'Parâmetros de paginação inválidos');
    }

    req.query = { ...req.query, ...value };
    next();
  }

  // Validação de IDs UUID
  static validateUUID(paramName = 'id') {
    const uuidSchema = Joi.object({
      [paramName]: Joi.string().pattern(/^[a-f\d]{8}(-[a-f\d]{4}){4}[a-f\d]{8}$/i).required().messages({
        'string.pattern.base': `${paramName} deve ser um UUID válido`,
        'any.required': `${paramName} é obrigatório`
      })
    }).unknown(true);

    return this.validateParams(uuidSchema);
  }

  // Validação de datas
  static validateDateRange(req, res, next) {
    const dateSchema = Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
    }).unknown(true);

    const { error, value } = dateSchema.validate(req.query);

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return ResponseFormatter.validationError(res, errors);
    }

    req.query = { ...req.query, ...value };
    next();
  }

  // Validação de status
  static validateStatus(allowedStatuses) {
    return (req, res, next) => {
      const { status } = req.query;
      
      if (status && !allowedStatuses.includes(status)) {
        return ResponseFormatter.badRequest(res, 
          `Status deve ser um dos seguintes: ${allowedStatuses.join(', ')}`
        );
      }

      next();
    };
  }

  // Validação de arquivo
  static validateFile(options = {}) {
    const {
      maxSize = 5242880, // 5MB
      allowedTypes = ['jpg', 'jpeg', 'png', 'webp'],
      required = false
    } = options;

    return (req, res, next) => {
      if (!req.file && required) {
        return ResponseFormatter.badRequest(res, 'Arquivo é obrigatório');
      }

      if (req.file) {
        // Verificar tamanho
        if (req.file.size > maxSize) {
          return ResponseFormatter.badRequest(res, 
            `Arquivo muito grande. Tamanho máximo: ${maxSize / 1024 / 1024}MB`
          );
        }

        // Verificar tipo
        const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(fileExtension)) {
          return ResponseFormatter.badRequest(res, 
            `Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.join(', ')}`
          );
        }
      }

      next();
    };
  }
}

module.exports = ValidationMiddleware;