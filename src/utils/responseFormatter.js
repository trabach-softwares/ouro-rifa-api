const config = require('../config/environment');
const logger = require('./logger');

class ResponseFormatter {
  static success(res, data = null, message = 'Sucesso', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static created(res, data, message = 'Criado com sucesso') {
    return this.success(res, data, message, 201);
  }

  static paginated(res, data, pagination, message = 'Dados recuperados com sucesso') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message = 'Erro interno', statusCode = 500, errors = null) {
    logger.error(`Error ${statusCode}: ${message}`);
    
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  static badRequest(res, message = 'Requisição inválida', errors = null) {
    return res.status(400).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  static unauthorized(res, message = 'Não autorizado') {
    return res.status(401).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  static forbidden(res, message = 'Acesso negado') {
    return res.status(403).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  static notFound(res, message = 'Recurso não encontrado') {
    return res.status(404).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  static conflict(res, message = 'Conflito de dados') {
    return res.status(409).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  static validationError(res, errors, message = 'Dados inválidos') {
    return res.status(400).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ResponseFormatter;