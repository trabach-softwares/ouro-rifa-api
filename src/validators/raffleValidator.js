const Joi = require('joi');
const { VALIDATION_RULES } = require('../config/constants');

const raffleSchemas = {
  createRaffle: Joi.object({
    title: Joi.string()
      .min(VALIDATION_RULES.TITLE_MIN_LENGTH)
      .max(VALIDATION_RULES.TITLE_MAX_LENGTH)
      .required()
      .messages({
        'string.min': `Título deve ter pelo menos ${VALIDATION_RULES.TITLE_MIN_LENGTH} caracteres`,
        'string.max': `Título deve ter no máximo ${VALIDATION_RULES.TITLE_MAX_LENGTH} caracteres`,
        'any.required': 'Título é obrigatório'
      }),
    description: Joi.string()
      .min(VALIDATION_RULES.DESCRIPTION_MIN_LENGTH)
      .max(VALIDATION_RULES.DESCRIPTION_MAX_LENGTH)
      .required()
      .messages({
        'string.min': `Descrição deve ter pelo menos ${VALIDATION_RULES.DESCRIPTION_MIN_LENGTH} caracteres`,
        'string.max': `Descrição deve ter no máximo ${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH} caracteres`,
        'any.required': 'Descrição é obrigatória'
      }),
    ticketPrice: Joi.number()
      .positive()
      .precision(2)
      .required()
      .messages({
        'number.positive': 'Preço do ticket deve ser positivo',
        'any.required': 'Preço do ticket é obrigatório'
      }),
    totalTickets: Joi.number()
      .integer()
      .min(VALIDATION_RULES.MIN_TICKETS)
      .max(VALIDATION_RULES.MAX_TICKETS)
      .required()
      .messages({
        'number.integer': 'Total de tickets deve ser um número inteiro',
        'number.min': `Mínimo de ${VALIDATION_RULES.MIN_TICKETS} tickets`,
        'number.max': `Máximo de ${VALIDATION_RULES.MAX_TICKETS} tickets`,
        'any.required': 'Total de tickets é obrigatório'
      }),
    endDate: Joi.date()
      .iso()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'Data de fim deve ser futura',
        'any.required': 'Data de fim é obrigatória'
      }),
    image: Joi.string().uri().optional(),
    settings: Joi.object({
      maxTicketsPerPerson: Joi.number().integer().min(1).optional(),
      allowComments: Joi.boolean().optional(),
      autoApprovePayments: Joi.boolean().optional()
    }).optional()
  }),

  updateRaffle: Joi.object({
    title: Joi.string()
      .min(VALIDATION_RULES.TITLE_MIN_LENGTH)
      .max(VALIDATION_RULES.TITLE_MAX_LENGTH)
      .optional(),
    description: Joi.string()
      .min(VALIDATION_RULES.DESCRIPTION_MIN_LENGTH)
      .max(VALIDATION_RULES.DESCRIPTION_MAX_LENGTH)
      .optional(),
    ticketPrice: Joi.number().positive().precision(2).optional(),
    totalTickets: Joi.number()
      .integer()
      .min(VALIDATION_RULES.MIN_TICKETS)
      .max(VALIDATION_RULES.MAX_TICKETS)
      .optional(),
    endDate: Joi.date().iso().greater('now').optional(),
    image: Joi.string().uri().optional(),
    settings: Joi.object({
      maxTicketsPerPerson: Joi.number().integer().min(1).optional(),
      allowComments: Joi.boolean().optional(),
      autoApprovePayments: Joi.boolean().optional()
    }).optional()
  }),

  updateStatus: Joi.object({
    status: Joi.string()
      .valid('pending', 'active', 'paused', 'completed', 'cancelled')
      .required()
      .messages({
        'any.only': 'Status deve ser: pending, active, paused, completed ou cancelled',
        'any.required': 'Status é obrigatório'
      })
  })
};

class RaffleValidator {
  static validate(schema, data) {
    const { error, value } = raffleSchemas[schema].validate(data, {
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

  static validateCreate(data) {
    return this.validate('createRaffle', data);
  }

  static validateUpdate(data) {
    return this.validate('updateRaffle', data);
  }

  static validateStatusUpdate(data) {
    return this.validate('updateStatus', data);
  }
}

module.exports = RaffleValidator;