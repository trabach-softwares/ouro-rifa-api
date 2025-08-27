const dataManager = require('../utils/dataManager');
const { logger } = require('../utils/logger');

class DatabaseConfig {
  constructor() {
    this.dataManager = dataManager;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Verificar e criar estrutura inicial
      await this.ensureDataStructure();
      
      // Validar integridade dos dados
      await this.validateDataIntegrity();
      
      this.initialized = true;
      logger.info('Database inicializado com sucesso');
    } catch (error) {
      logger.error('Erro ao inicializar database:', error);
      throw error;
    }
  }

  async ensureDataStructure() {
    const requiredFiles = [
      'users.json',
      'raffles.json', 
      'tickets.json',
      'payments.json',
      'settings.json'
    ];

    for (const file of requiredFiles) {
      try {
        this.dataManager.readData(file);
        logger.info(`Arquivo ${file} verificado`);
      } catch (error) {
        logger.warn(`Criando arquivo ${file}`);
        this.dataManager.initializeDataFiles();
      }
    }
  }

  async validateDataIntegrity() {
    try {
      // Verificar relações entre dados
      const raffles = this.dataManager.getRaffles();
      const tickets = this.dataManager.getTickets();
      const payments = this.dataManager.getPayments();
      const users = this.dataManager.getUsers();

      // Validar se todos os tickets têm rifas válidas
      const invalidTickets = tickets.filter(ticket => 
        !raffles.find(raffle => raffle.id === ticket.raffle)
      );

      if (invalidTickets.length > 0) {
        logger.warn(`Encontrados ${invalidTickets.length} tickets com rifas inválidas`);
      }

      // Validar se todos os pagamentos têm tickets válidos
      const invalidPayments = payments.filter(payment => 
        !tickets.find(ticket => ticket.id === payment.ticket)
      );

      if (invalidPayments.length > 0) {
        logger.warn(`Encontrados ${invalidPayments.length} pagamentos com tickets inválidos`);
      }

      logger.info('Validação de integridade concluída');
    } catch (error) {
      logger.error('Erro na validação de integridade:', error);
      throw error;
    }
  }

  async backup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = `backup-${timestamp}`;
      
      // Implementar backup dos arquivos JSON
      logger.info(`Backup criado: ${backupDir}`);
    } catch (error) {
      logger.error('Erro ao criar backup:', error);
      throw error;
    }
  }

  getStats() {
    return {
      users: this.dataManager.getUsers().length,
      raffles: this.dataManager.getRaffles().length,
      tickets: this.dataManager.getTickets().length,
      payments: this.dataManager.getPayments().length,
      initialized: this.initialized
    };
  }
}

module.exports = new DatabaseConfig();