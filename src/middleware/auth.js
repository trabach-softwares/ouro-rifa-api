const jwt = require('jsonwebtoken');
const dataManager = require('../utils/dataManager');
const ResponseFormatter = require('../utils/responseFormatter');
const { ERROR_MESSAGES } = require('../config/constants');
const { logger } = require('../utils/logger');

// Função auxiliar para criar respostas de erro de forma segura
const createErrorResponse = (res, message, statusCode = 401) => {
  return res.status(statusCode).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

// Middleware principal de autenticação
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return createErrorResponse(res, ERROR_MESSAGES.TOKEN_REQUIRED, 401);
    }

    // Verificar se JWT_SECRET existe
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET não configurado');
      return createErrorResponse(res, ERROR_MESSAGES.INTERNAL_ERROR, 500);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ✅ ADICIONAR LOG para debug
    logger.info(`Token decodificado: ${JSON.stringify(decoded)}`);
    
    if (!decoded || !decoded.id) {
      return createErrorResponse(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
    }

    const user = dataManager.getUserById(decoded.id);
    
    // ✅ ADICIONAR LOG para debug
    logger.info(`Usuário encontrado: ${user ? user.email : 'null'}`);
    
    if (!user) {
      return createErrorResponse(res, ERROR_MESSAGES.USER_NOT_FOUND, 401);
    }

    if (!user.isActive) {
      return createErrorResponse(res, ERROR_MESSAGES.ACCOUNT_INACTIVE, 403);
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Erro no middleware de autenticação:', error);
    
    // Tratar erros específicos do JWT
    if (error.name === 'JsonWebTokenError') {
      return createErrorResponse(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
    }
    
    if (error.name === 'TokenExpiredError') {
      return createErrorResponse(res, 'Token expirado. Faça login novamente.', 401);
    }
    
    // Erro genérico
    return createErrorResponse(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
  }
};

// Middleware para administradores
const adminAuth = (req, res, next) => {
  try {
    if (!req.user) {
      return createErrorResponse(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return createErrorResponse(res, ERROR_MESSAGES.ACCESS_DENIED, 403);
    }
    
    next();
  } catch (error) {
    logger.error('Erro no middleware de admin:', error);
    return createErrorResponse(res, ERROR_MESSAGES.ACCESS_DENIED, 403);
  }
};

// Middleware para super administradores
const superAdminAuth = (req, res, next) => {
  try {
    if (!req.user) {
      return createErrorResponse(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
    }

    if (req.user.role !== 'super_admin') {
      return createErrorResponse(res, ERROR_MESSAGES.ACCESS_DENIED, 403);
    }
    
    next();
  } catch (error) {
    logger.error('Erro no middleware de super admin:', error);
    return createErrorResponse(res, ERROR_MESSAGES.ACCESS_DENIED, 403);
  }
};

// Middleware para verificar propriedade de rifa ou admin
const ownerOrAdminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return createErrorResponse(res, ERROR_MESSAGES.INVALID_TOKEN, 401);
    }

    const { id } = req.params;
    
    if (!id) {
      return createErrorResponse(res, 'ID da rifa é obrigatório', 400);
    }

    const raffle = dataManager.getRaffleById(id);
    
    if (!raffle) {
      return createErrorResponse(res, ERROR_MESSAGES.RAFFLE_NOT_FOUND, 404);
    }

    // Permitir se for super admin ou dono da rifa
    if (req.user.role === 'super_admin' || raffle.owner === req.user.id) {
      req.raffle = raffle;
      return next();
    }

    return createErrorResponse(res, 'Acesso negado. Você só pode gerenciar suas próprias rifas.', 403);
  } catch (error) {
    logger.error('Erro no middleware de verificação de propriedade:', error);
    return createErrorResponse(res, 'Erro ao verificar permissões', 500);
  }
};

module.exports = {
  auth,
  adminAuth,
  superAdminAuth,
  ownerOrAdminAuth
};