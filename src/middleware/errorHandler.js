const { logger } = require('../utils/logger');
const { ERROR_MESSAGES } = require('../config/constants');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Função auxiliar para criar respostas de erro seguras
const createSafeErrorResponse = (res, message, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

const globalErrorHandler = (err, req, res, next) => {
  // Prevenir crash da aplicação
  try {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log do erro
    logger.error('Global Error Handler:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });

    // Não vazar detalhes em produção
    if (process.env.NODE_ENV === 'production') {
      // Erros operacionais conhecidos
      if (err.isOperational) {
        return createSafeErrorResponse(res, err.message, err.statusCode);
      }
      
      // Erros específicos
      if (err.name === 'JsonWebTokenError') {
        return createSafeErrorResponse(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
      }
      
      if (err.name === 'TokenExpiredError') {
        return createSafeErrorResponse(res, 'Token expirado. Faça login novamente.', 401);
      }
      
      if (err.name === 'ValidationError') {
        return createSafeErrorResponse(res, 'Dados de entrada inválidos', 400);
      }

      // Erro genérico para produção
      return createSafeErrorResponse(res, ERROR_MESSAGES.INTERNAL_ERROR, 500);
    } else {
      // Desenvolvimento: mostrar detalhes
      return res.status(err.statusCode).json({
        success: false,
        status: 'error',
        error: err,
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
    }
  } catch (handlerError) {
    // Se até o handler de erro falhar, resposta mínima
    logger.error('Error Handler falhou:', handlerError);
    
    try {
      return res.status(500).json({
        success: false,
        message: 'Erro interno crítico do servidor',
        timestamp: new Date().toISOString()
      });
    } catch (finalError) {
      // Último recurso
      logger.error('Erro crítico final:', finalError);
      res.end();
    }
  }
};

// Middleware para capturar erros assíncronos
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Handler para rotas não encontradas
const handleNotFound = (req, res, next) => {
  const err = new AppError(`Rota ${req.originalUrl} não encontrada`, 404);
  next(err);
};

// Handler para erros não capturados
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', err);
  process.exit(1);
});

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  handleNotFound
};