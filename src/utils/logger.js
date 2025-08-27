const winston = require('winston');
const path = require('path');
const config = require('../config/environment');

// Definir níveis de log customizados
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Definir cores para cada nível
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(logColors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Formato para console
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Criar transportes
const transports = [
  // Log de erros
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // Log combinado
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Adicionar console apenas em desenvolvimento
if (config.isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
}

// Criar logger
const logger = winston.createLogger({
  level: config.isDevelopment ? 'debug' : 'info',
  levels: logLevels,
  format: logFormat,
  transports,
  exitOnError: false
});

// Stream para Morgan (middleware de log HTTP)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Métodos auxiliares
logger.logRequest = (req, res, responseTime) => {
  const { method, url, ip } = req;
  const { statusCode } = res;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  logger.http(`${method} ${url}`, {
    ip,
    statusCode,
    responseTime: `${responseTime}ms`,
    userAgent
  });
};

logger.logError = (error, req = null) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  if (req) {
    errorInfo.request = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (req.user) {
      errorInfo.user = {
        id: req.user.id,
        email: req.user.email
      };
    }
  }

  logger.error('Application Error', errorInfo);
};

logger.logAuth = (action, user, ip, success = true) => {
  logger.info(`Auth ${action}`, {
    userId: user.id,
    email: user.email,
    ip,
    success,
    timestamp: new Date().toISOString()
  });
};

logger.logBusinessEvent = (event, data) => {
  logger.info(`Business Event: ${event}`, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

module.exports = { logger };