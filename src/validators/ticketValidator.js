const Joi = require('joi');
const { VALIDATION_RULES } = require('../config/constants');

const ticketSchemas = {
  buyTickets: Joi.object({
    raffle: Joi.string().required().messages({
      'string.empty': 'ID da rifa é obrigatório',
      'any.required': 'ID da rifa é obrigatório'
    }),
    quantity: Joi.number()
      .integer()
      .min(1)
      .max(VALIDATION_RULES.MAX_TICKETS_PER_PURCHASE)
      .required()
      .messages({
        'number.base': 'Quantidade deve ser um número',
        'number.integer': 'Quantidade deve ser um número inteiro',
        'number.min': 'Quantidade mínima é 1',
        'number.max': `Quantidade máxima é ${VALIDATION_RULES.MAX_TICKETS_PER_PURCHASE}`,
        'any.required': 'Quantidade é obrigatória'
      }),
    paymentMethod: Joi.string()
      .valid('pix', 'credit_card', 'bank_transfer')
      .required()
      .messages({
        'any.only': 'Método de pagamento deve ser: pix, credit_card ou bank_transfer',
        'any.required': 'Método de pagamento é obrigatório'
      })
  })
};

class TicketValidator {
  static validate(schema, data) {
    const { error, value } = ticketSchemas[schema].validate(data, {
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

  static validateBuyTickets(data) {
    return this.validate('buyTickets', data);
  }
}

module.exports = TicketValidator;