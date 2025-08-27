require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { globalErrorHandler, handleNotFound } = require('./src/middleware/errorHandler');
const { logger } = require('./src/utils/logger');

const app = express();

// Configuração básica
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/raffles', express.static(path.join(__dirname, 'uploads/raffles')));

// Log das requisições em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - ${req.ip}`);
    console.log(`${req.method} ${req.path} - ${req.ip}`, {
      headers: req.headers.authorization ? 'Token presente' : 'Sem token',
      user: req.user?.id || 'Não autenticado'
    });
    next();
  });
}

// Importar rotas com tratamento de erro
try {
  const authRoutes = require('./src/routes/auth');
  const raffleRoutes = require('./src/routes/raffles');
  const ticketRoutes = require('./src/routes/tickets');
  const paymentRoutes = require('./src/routes/payments');
  const reportRoutes = require('./src/routes/reports');
  const uploadRoutes = require('./src/routes/upload');

  // Registrar rotas
  app.use('/api/auth', authRoutes);
  app.use('/api/raffles', raffleRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/upload', uploadRoutes);
} catch (error) {
  logger.error('Erro ao carregar rotas:', error);
}

// Rota básica
app.get('/', (req, res) => {
  res.json({ 
    message: 'Ouro Rifa API',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', handleNotFound);

// Usar o middleware de erro global
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido. Fazendo shutdown graceful...');
  server.close(() => {
    logger.info('Processo finalizado.');
  });
});

module.exports = app;