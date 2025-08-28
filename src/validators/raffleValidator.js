const Joi = require('joi');
const { VALIDATION_RULES, RAFFLE_CATEGORIES, DRAW_TYPES } = require('../config/constants');

const raffleSchemas = {
  createRaffle: Joi.object({
    title: Joi.string()
      .min(VALIDATION_RULES.TITLE_MIN_LENGTH)
      .max(VALIDATION_RULES.TITLE_MAX_LENGTH)
      .required()
      .messages({
        'string.min': `Nome da campanha deve ter pelo menos ${VALIDATION_RULES.TITLE_MIN_LENGTH} caracteres`,
        'string.max': `Nome da campanha deve ter no máximo ${VALIDATION_RULES.TITLE_MAX_LENGTH} caracteres`,
        'any.required': 'Nome da campanha é obrigatório'
      }),
    
    description: Joi.string()
      .min(VALIDATION_RULES.DESCRIPTION_MIN_LENGTH)
      .max(VALIDATION_RULES.DESCRIPTION_MAX_LENGTH)
      .optional()
      .messages({
        'string.min': `Descrição deve ter pelo menos ${VALIDATION_RULES.DESCRIPTION_MIN_LENGTH} caracteres`,
        'string.max': `Descrição deve ter no máximo ${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH} caracteres`
      }),

    // Imagens da campanha
    campaignImages: Joi.array()
      .items(Joi.string().uri())
      .max(5)
      .optional(),

    // Telefone público para contato
    publicContactPhone: Joi.string()
      .pattern(/^\(\d{2}\)\s\d{4,5}-\d{4}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Telefone deve estar no formato (11) 99999-9999'
      }),

    // Categoria da rifa
    category: Joi.string()
      .valid(...Object.keys(RAFFLE_CATEGORIES))
      .optional()
      .messages({
        'any.only': 'Categoria inválida'
      }),

    // Quantidade de bilhetes
    totalTickets: Joi.number()
      .integer()
      .min(VALIDATION_RULES.MIN_TICKETS)
      .max(VALIDATION_RULES.MAX_TICKETS)
      .required()
      .messages({
        'number.integer': 'Quantidade de bilhetes deve ser um número inteiro',
        'number.min': `Mínimo de ${VALIDATION_RULES.MIN_TICKETS} bilhetes`,
        'number.max': `Máximo de ${VALIDATION_RULES.MAX_TICKETS} bilhetes`,
        'any.required': 'Quantidade de bilhetes é obrigatória'
      }),

    // Valor por bilhete
    ticketPrice: Joi.number()
      .positive()
      .min(VALIDATION_RULES.MIN_TICKET_PRICE)
      .max(VALIDATION_RULES.MAX_TICKET_PRICE)
      .precision(2)
      .required()
      .messages({
        'number.positive': 'Valor do bilhete deve ser positivo',
        'number.min': `Valor mínimo: R$ ${VALIDATION_RULES.MIN_TICKET_PRICE}`,
        'number.max': `Valor máximo: R$ ${VALIDATION_RULES.MAX_TICKET_PRICE}`,
        'any.required': 'Valor do bilhete é obrigatório'
      }),

    // Tipo de sorteio
    drawType: Joi.string()
      .valid(...Object.values(DRAW_TYPES))
      .default(DRAW_TYPES.SORTEADOR_COM_BR)
      .messages({
        'any.only': 'Tipo de sorteio inválido'
      }),

    // Data e hora do sorteio (opcional)
    drawDate: Joi.date()
      .iso()
      .greater('now')
      .optional()
      .messages({
        'date.greater': 'Data do sorteio deve ser no futuro'
      }),

    // Prêmios
    prizes: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          name: Joi.string().required().messages({
            'any.required': 'Nome do prêmio é obrigatório'
          }),
          description: Joi.string().optional(),
          position: Joi.number().integer().min(1).required(),
          image: Joi.string().uri().optional()
        })
      )
      .min(1)
      .optional(),

    // Configurações da rifa
    settings: Joi.object({
      minTicketsPerPurchase: Joi.number()
        .integer()
        .min(VALIDATION_RULES.MIN_TICKETS_PER_PURCHASE)
        .default(1),
      maxTicketsPerPurchase: Joi.number()
        .integer()
        .max(VALIDATION_RULES.MAX_TICKETS_PER_PURCHASE)
        .default(199),
      maxTicketsPerPerson: Joi.number()
        .integer()
        .max(VALIDATION_RULES.MAX_TICKETS_PER_PERSON)
        .default(199),
      showBuyersList: Joi.boolean().default(true),
      autoApprovePayments: Joi.boolean().default(false)
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

    campaignImages: Joi.array()
      .items(Joi.string().uri())
      .max(5)
      .optional(),

    publicContactPhone: Joi.string()
      .pattern(/^\(\d{2}\)\s\d{4,5}-\d{4}$/)
      .optional(),

    category: Joi.string()
      .valid(...Object.keys(RAFFLE_CATEGORIES))
      .optional(),

    drawDate: Joi.date()
      .iso()
      .greater('now')
      .optional(),

    prizes: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          name: Joi.string().required(),
          description: Joi.string().optional(),
          position: Joi.number().integer().min(1).required(),
          image: Joi.string().uri().optional()
        })
      )
      .optional(),

    settings: Joi.object({
      minTicketsPerPurchase: Joi.number().integer().min(1).optional(),
      maxTicketsPerPurchase: Joi.number().integer().max(199).optional(),
      maxTicketsPerPerson: Joi.number().integer().max(199).optional(),
      showBuyersList: Joi.boolean().optional(),
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