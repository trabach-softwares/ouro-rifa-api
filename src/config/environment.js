// Carregar variáveis de ambiente ANTES de qualquer validação
require('dotenv').config();

const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  
  // URLs
  FRONTEND_URL: Joi.string().uri().optional(),
  
  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  
  // Email
  EMAIL_HOST: Joi.string().optional(),
  EMAIL_PORT: Joi.number().port().optional(),
  EMAIL_USER: Joi.string().email().optional(),
  EMAIL_PASS: Joi.string().optional(),
  EMAIL_FROM: Joi.string().email().optional(),
  
  // PIX
  PIX_KEY: Joi.string().optional(),
  PIX_BANK_NAME: Joi.string().optional(),
  PIX_ACCOUNT_NAME: Joi.string().optional(),
  
  // Upload
  MAX_FILE_SIZE: Joi.number().positive().default(5242880),
  ALLOWED_FILE_TYPES: Joi.string().default('jpg,jpeg,png,webp'),
  
  // CORS
  CORS_DEBUG: Joi.boolean().default(false)
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  frontend: {
    url: envVars.FRONTEND_URL
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN
  },
  
  email: {
    host: envVars.EMAIL_HOST,
    port: envVars.EMAIL_PORT,
    user: envVars.EMAIL_USER,
    pass: envVars.EMAIL_PASS,
    from: envVars.EMAIL_FROM
  },
  
  pix: {
    key: envVars.PIX_KEY,
    bankName: envVars.PIX_BANK_NAME,
    accountName: envVars.PIX_ACCOUNT_NAME
  },
  
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedTypes: envVars.ALLOWED_FILE_TYPES.split(',')
  },
  
  cors: {
    debug: envVars.CORS_DEBUG
  },
  
  isDevelopment: envVars.NODE_ENV === 'development',
  isProduction: envVars.NODE_ENV === 'production',
  isTest: envVars.NODE_ENV === 'test'
};

module.exports = config;