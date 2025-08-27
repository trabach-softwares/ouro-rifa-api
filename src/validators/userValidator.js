const Joi = require('joi');
const { VALIDATION_RULES } = require('../config/constants');

const userSchemas = {
  register: Joi.object({
    name: Joi.string()
      .min(VALIDATION_RULES.NAME_MIN_LENGTH)
      .max(VALIDATION_RULES.NAME_MAX_LENGTH)
      .required()
      .messages({
        'string.min': `Nome deve ter pelo menos ${VALIDATION_RULES.NAME_MIN_LENGTH} caracteres`,
        'string.max': `Nome deve ter no máximo ${VALIDATION_RULES.NAME_MAX_LENGTH} caracteres`,
        'any.required': 'Nome é obrigatório'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Email deve ter um formato válido',
        'any.required': 'Email é obrigatório'
      }),
    password: Joi.string()
      .min(VALIDATION_RULES.PASSWORD_MIN_LENGTH)
      .required()
      .messages({
        'string.min': `Senha deve ter pelo menos ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} caracteres`,
        'any.required': 'Senha é obrigatória'
      }),
    company: Joi.string().max(100).optional(),
    phone: Joi.string().pattern(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).optional().messages({
      'string.pattern.base': 'Telefone deve estar no formato (xx) xxxxx-xxxx'
    }),
    document: Joi.string().pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/).optional().messages({
      'string.pattern.base': 'Documento deve ser CPF ou CNPJ válido'
    })
  }),

  login: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .trim()
      .lowercase()
      .messages({
        'string.email': 'Email deve ter um formato válido',
        'any.required': 'Email é obrigatório',
        'string.empty': 'Email não pode estar vazio'
      }),
    password: Joi.string()
      .min(1)
      .required()
      .messages({
        'any.required': 'Senha é obrigatória',
        'string.empty': 'Senha não pode estar vazia',
        'string.min': 'Senha não pode estar vazia'
      })
  }),

  updateProfile: Joi.object({
    name: Joi.string()
      .min(VALIDATION_RULES.NAME_MIN_LENGTH)
      .max(VALIDATION_RULES.NAME_MAX_LENGTH)
      .optional(),
    company: Joi.string().max(100).optional(),
    phone: Joi.string().pattern(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).optional(),
    document: Joi.string().pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/).optional(),
    paymentSettings: Joi.object({
      pixKey: Joi.string().optional(),
      bankName: Joi.string().optional(),
      agency: Joi.string().optional(),
      account: Joi.string().optional(),
      accountType: Joi.string().valid('corrente', 'poupanca').optional()
    }).optional(),
    notificationSettings: Joi.object({
      emailNewPurchase: Joi.boolean().optional(),
      emailRaffleComplete: Joi.boolean().optional(),
      smsNewPurchase: Joi.boolean().optional(),
      smsRaffleComplete: Joi.boolean().optional(),
      pushNotifications: Joi.boolean().optional()
    }).optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Senha atual é obrigatória'
    }),
    newPassword: Joi.string()
      .min(VALIDATION_RULES.PASSWORD_MIN_LENGTH)
      .required()
      .messages({
        'string.min': `Nova senha deve ter pelo menos ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} caracteres`,
        'any.required': 'Nova senha é obrigatória'
      })
  })
};

class UserValidator {
  static validate(schema, data) {
    const { error, value } = userSchemas[schema].validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      throw new Error(JSON.stringify(errors));
    }

    return value;
  }

  static validateRegister(req, res, next) {
    try {
      req.body = UserValidator.validate('register', req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: JSON.parse(error.message)
      });
    }
  }

  static validateLogin(req, res, next) {
    try {
      req.body = UserValidator.validate('login', req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: JSON.parse(error.message)
      });
    }
  }

  static validateUpdateProfile(req, res, next) {
    try {
      req.body = UserValidator.validate('updateProfile', req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: JSON.parse(error.message)
      });
    }
  }

  static validateChangePassword(req, res, next) {
    try {
      req.body = UserValidator.validate('changePassword', req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: JSON.parse(error.message)
      });
    }
  }
}

module.exports = UserValidator;