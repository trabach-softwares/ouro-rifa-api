const BaseService = require('./baseService');
const PaymentRepository = require('../repositories/paymentRepository');
const TicketService = require('./ticketService');
const { PAYMENT_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../config/constants');
const { logger } = require('../utils/logger');
const QRCode = require('qrcode');
const config = require('../config/environment');

class PaymentService extends BaseService {
  constructor(dataManager) {
    super(dataManager, 'payment'); // Passar entityName para BaseService
    this.dataManager = dataManager;
    this.repository = new PaymentRepository(dataManager); // ✅ Inicializar repository
    this.ticketService = new TicketService(dataManager);
  }

  async generatePix(ticketId, userId) {
    // Verificar ticket
    const ticketDetails = this.ticketService.getTicketDetails(ticketId, userId);
    const { ticket, raffle } = ticketDetails;

    if (ticket.paymentStatus !== 'pending') {
      throw new Error('Ticket não está pendente de pagamento');
    }

    // Buscar dados do proprietário da rifa
    const raffleOwner = this.dataManager.getUserById(raffle.owner);
    
    // Configurar PIX
    const pixKey = raffleOwner.paymentSettings?.pixKey || process.env.PIX_KEY || 'trabachjonathan@gmail.com';
    const amount = ticket.totalAmount;
    const identifier = `RIFA${raffle.id.slice(-4)}${ticket.id.slice(-4)}`;
    
    // Criar string PIX (formato simplificado)
    const pixString = `PIX|${pixKey}|${amount}|${identifier}|${raffle.title}`;
    
    // Gerar QR Code
    const qrCodeBase64 = await QRCode.toDataURL(pixString);
    
    // Criar ou atualizar pagamento
    let payment = this.repository.findByTicket(ticketId);
    
    const paymentData = {
      ticket: ticketId,
      user: userId,
      raffle: ticket.raffle,
      amount: ticket.totalAmount,
      method: 'pix',
      status: 'pending',
      pixData: {
        qrCode: qrCodeBase64,
        pixKey,
        identifier,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos
      }
    };

    if (payment) {
      payment = this.repository.update(payment.id, paymentData);
    } else {
      payment = this.repository.create(paymentData);
    }

    return {
      payment: {
        id: payment.id,
        amount: payment.amount,
        pixData: payment.pixData,
        expiresAt: payment.pixData.expiresAt
      },
      message: 'PIX gerado com sucesso'
    };
  }

  async confirmPayment(paymentId, transactionId, userId) {
    try {
      // ✅ LOG de entrada para debug
      logger.info(`confirmPayment chamado: paymentId=${paymentId}, userId=${userId}`);
      
      // Verificar se userId existe
      if (!userId) {
        throw new Error('ID do usuário é obrigatório');
      }
      
      // ✅ PRIMEIRA TENTATIVA: Buscar pagamento por ID
      let payment = this.repository.findById(paymentId);
      logger.info(`Busca por ID: ${payment ? 'encontrado' : 'não encontrado'}`);
      
      // ✅ SE NÃO ENCONTRAR: Tentar buscar por ticket ID
      if (!payment) {
        logger.warn(`Payment ${paymentId} não encontrado, tentando buscar por ticket...`);
        payment = this.repository.findByTicket(paymentId);
        logger.info(`Busca por ticket: ${payment ? 'encontrado' : 'não encontrado'}`);
      }
      
      // ✅ SE AINDA NÃO ENCONTRAR: Buscar por usuário
      if (!payment) {
        logger.warn(`Payment para ticket ${paymentId} não encontrado, buscando por usuário...`);
        const userPayments = this.repository.findByUser(userId);
        logger.info(`Pagamentos do usuário encontrados: ${userPayments.length}`);
        
        payment = userPayments.find(p => 
          ['pending', 'processing'].includes(p.status) && 
          (p.id === paymentId || p.ticket === paymentId)
        );
        logger.info(`Pagamento pendente encontrado: ${payment ? 'sim' : 'não'}`);
      }
      
      // ✅ SE AINDA NÃO ENCONTRAR: Criar payment automaticamente
      if (!payment) {
        logger.info(`Criando pagamento automaticamente para ${paymentId}...`);
        
        // Buscar ticket para criar o pagamento
        const ticket = this.dataManager.getTicketById(paymentId);
        if (!ticket) {
          throw new Error('Ticket não encontrado para criar pagamento');
        }
        
        logger.info(`Ticket encontrado: ${ticket.id}, user: ${ticket.user}, userId: ${userId}`);
        
        // ✅ VERIFICAÇÃO MAIS DETALHADA
        if (ticket.user !== userId) {
          logger.error(`Acesso negado: ticket.user=${ticket.user}, userId=${userId}`);
          throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
        }
        
        // Criar pagamento automaticamente
        const paymentData = {
          ticket: ticket.id,
          user: userId,
          raffle: ticket.raffle,
          amount: ticket.totalAmount,
          method: ticket.paymentMethod || 'pix',
          status: 'processing',
          transactionId: null
        };
        
        payment = this.repository.create(paymentData);
        logger.info(`Payment criado automaticamente: ${payment.id}`);
      }

      // Verificar permissão final
      if (payment.user !== userId) {
        logger.error(`Permissão final negada: payment.user=${payment.user}, userId=${userId}`);
        throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
      }

      // ✅ ACEITAR qualquer status (se está confirmando, já foi pago)
      if (payment.status === 'completed') {
        const ticket = this.dataManager.getTicketById(payment.ticket);
        return {
          payment,
          ticket,
          message: 'Pagamento já estava confirmado'
        };
      }

      // Atualizar pagamento para completed
      const updatedPayment = this.repository.markAsCompleted(payment.id, transactionId);

      // Confirmar ticket (mudar para paid)
      const ticket = this.ticketService.confirmTicketPayment(payment.ticket, transactionId);

      // Atualizar estatísticas
      try {
        await this.updateRaffleStats(payment.raffle, ticket.quantity, payment.amount);
        await this.updateUserStats(payment.user, payment.amount);
      } catch (error) {
        logger.warn('Erro ao atualizar estatísticas:', error);
      }

      return {
        payment: updatedPayment,
        ticket,
        message: 'Pagamento confirmado com sucesso'
      };
    } catch (error) {
      logger.error('Erro em confirmPayment:', error);
      throw error;
    }
  }

  async updateRaffleStats(raffleId, quantity, amount) {
    try {
      const raffle = this.dataManager.getRaffleById(raffleId);
      if (raffle) {
        const updatedStats = {
          soldTickets: (raffle.soldTickets || 0) + quantity,
          revenue: (raffle.revenue || 0) + amount
        };
        this.dataManager.updateRaffle(raffleId, updatedStats);
      }
    } catch (error) {
      logger.error('Erro ao atualizar stats da rifa:', error);
    }
  }

  async updateUserStats(userId, amount) {
    try {
      const user = this.dataManager.getUserById(userId);
      if (user) {
        const updatedStats = {
          totalSpent: (user.totalSpent || 0) + amount,
          lastPurchase: new Date().toISOString()
        };
        this.dataManager.updateUser(userId, updatedStats);
      }
    } catch (error) {
      logger.error('Erro ao atualizar stats do usuário:', error);
    }
  }

  getPaymentStatus(paymentId, userId) {
    const payment = this.repository.findById(paymentId);
    if (!payment) {
      throw new Error(ERROR_MESSAGES.PAYMENT_NOT_FOUND);
    }

    // Verificar permissão
    if (payment.user !== userId) {
      throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    return payment;
  }

  getPaymentsByUser(userId) {
    return this.repository.findByUser(userId);
  }

  getPaymentsByRaffle(raffleId) {
    return this.repository.findByRaffle(raffleId);
  }

  getCompletedPayments() {
    return this.repository.findByStatus('completed');
  }

  getPendingPayments() {
    return this.repository.findByStatus('pending');
  }

  // ✅ Método para tela de vendas
  getSalesPaymentsByOwner(ownerId, filters = {}) {
    try {
      // Buscar rifas do dono
      const userRaffles = this.dataManager.getRaffles().filter(r => r.owner === ownerId);
      const userRaffleIds = userRaffles.map(r => r.id);
      
      // Buscar pagamentos das rifas do dono
      let payments = this.dataManager.getPayments().filter(payment => 
        userRaffleIds.includes(payment.raffle)
      );
      
      // Aplicar filtros
      if (filters.status) {
        payments = payments.filter(p => p.status === filters.status);
      }
      
      // Enriquecer com dados do cliente pagador
      return payments.map(payment => {
        const customer = this.dataManager.getUserById(payment.user); // Quem pagou
        const raffle = this.dataManager.getRaffleById(payment.raffle);
        
        return {
          ...payment,
          customer: customer ? {
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          } : null,
          raffle: raffle ? {
            id: raffle.id,
            title: raffle.title
          } : null
        };
      });
    } catch (error) {
      logger.error('Erro em getSalesPaymentsByOwner:', error);
      return [];
    }
  }
}

module.exports = PaymentService;