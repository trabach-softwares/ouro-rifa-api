const BaseService = require('./baseService');
const TicketRepository = require('../repositories/ticketRepository');
const RaffleRepository = require('../repositories/raffleRepository');
const { ERROR_MESSAGES, SUCCESS_MESSAGES, PAYMENT_STATUS } = require('../config/constants');
const { logger } = require('../utils/logger');
const helpers = require('../utils/helpers');

class TicketService extends BaseService {
  constructor(dataManager) {
    super();
    this.dataManager = dataManager;
    this.repository = new TicketRepository(dataManager);
    this.raffleRepository = new RaffleRepository(dataManager);
  }

  async buyTickets(ticketData, userId) {
    const { raffle: raffleId, quantity, paymentMethod } = ticketData;

    // Verificar se a rifa existe
    const raffle = this.raffleRepository.findById(raffleId);
    if (!raffle) {
      throw new Error(ERROR_MESSAGES.RAFFLE_NOT_FOUND);
    }

    // Verificar se a rifa está ativa
    if (raffle.status !== 'active') {
      throw new Error('Rifa não está ativa para vendas');
    }

    // Verificar disponibilidade
    const availableNumbers = helpers.getAvailableTicketNumbers(raffleId, raffle.totalTickets, this.dataManager);
    if (availableNumbers.length < quantity) {
      throw new Error(`Apenas ${availableNumbers.length} tickets disponíveis`);
    }

    // Verificar limite por pessoa
    if (raffle.settings?.maxTicketsPerPerson) {
      const userTickets = this.repository.findByUserAndRaffle(userId, raffleId)
        .filter(ticket => ticket.paymentStatus === PAYMENT_STATUS.PAID);
      const userTicketCount = userTickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
      
      if (userTicketCount + quantity > raffle.settings.maxTicketsPerPerson) {
        throw new Error(`Limite de ${raffle.settings.maxTicketsPerPerson} tickets por pessoa`);
      }
    }

    // Gerar números dos tickets
    const ticketNumbers = helpers.generateTicketNumbers(quantity, raffle.totalTickets);
    
    // Verificar se os números ainda estão disponíveis
    const unavailableNumbers = ticketNumbers.filter(num => !availableNumbers.includes(num));
    if (unavailableNumbers.length > 0) {
      throw new Error('Alguns números não estão mais disponíveis');
    }

    // Calcular valor total
    const totalAmount = quantity * raffle.ticketPrice;

    // Criar ticket
    const newTicketData = {
      raffle: raffleId,
      user: userId,
      ticketNumbers,
      quantity,
      totalAmount,
      paymentStatus: PAYMENT_STATUS.PENDING,
      paymentMethod
    };

    const ticket = this.repository.create(newTicketData);

    return {
      ticket,
      message: SUCCESS_MESSAGES.TICKETS_RESERVED,
      nextStep: 'payment'
    };
  }

  async cancelTicket(ticketId, userId) {
    const ticket = await this.findById(ticketId);
    
    // Verificar propriedade
    if (ticket.user !== userId) {
      throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    // Só pode cancelar se ainda estiver pendente
    if (ticket.paymentStatus !== PAYMENT_STATUS.PENDING) {
      throw new Error('Não é possível cancelar ticket já pago');
    }

    // Atualizar status
    const updatedTicket = this.repository.update(ticketId, { 
      paymentStatus: PAYMENT_STATUS.CANCELLED 
    });

    return {
      ticket: updatedTicket,
      message: SUCCESS_MESSAGES.TICKET_CANCELLED
    };
  }

  getTicketsByUser(userId, filters = {}) {
    try {
      // Verificar se o repository existe e tem o método findByUser
      if (!this.repository || typeof this.repository.findByUser !== 'function') {
        logger.error('Repository não inicializado corretamente ou método findByUser não existe');
        return [];
      }

      let tickets = this.repository.findByUser(userId);
      
      // Verificar se tickets é um array
      if (!Array.isArray(tickets)) {
        logger.warn('Método findByUser não retornou um array');
        return [];
      }
      
      // Aplicar filtros
      if (filters.raffle) {
        tickets = tickets.filter(ticket => ticket.raffle === filters.raffle);
      }
      
      if (filters.status) {
        tickets = tickets.filter(ticket => ticket.paymentStatus === filters.status);
      }

      // Buscar informações das rifas
      return tickets.map(ticket => {
        const raffleInfo = this.raffleRepository.findById(ticket.raffle);
        return {
          ...ticket,
          raffleInfo: raffleInfo ? {
            id: raffleInfo.id,
            title: raffleInfo.title,
            image: raffleInfo.image,
            status: raffleInfo.status
          } : null
        };
      });
    } catch (error) {
      logger.error('Erro em getTicketsByUser:', error);
      return [];
    }
  }

  getTicketDetails(ticketId, userId) {
    const ticket = this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
    }

    // Verificar permissão
    if (ticket.user !== userId) {
      throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    // Buscar informações da rifa
    const raffle = this.raffleRepository.findById(ticket.raffle);
    
    return {
      ticket,
      raffle: raffle ? {
        id: raffle.id,
        title: raffle.title,
        description: raffle.description,
        image: raffle.image,
        status: raffle.status
      } : null
    };
  }

  getTicketsByRaffle(raffleId) {
    try {
      // Usar dataManager diretamente já que é mais confiável
      return this.dataManager.getTicketsByRaffle(raffleId);
    } catch (error) {
      logger.error('Erro em getTicketsByRaffle:', error);
      return [];
    }
  }

  markTicketAsWinner(ticketId) {
    return this.repository.markAsWinner(ticketId);
  }

  confirmTicketPayment(ticketId, transactionId) {
    try {
      const ticket = this.repository.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket não encontrado');
      }

      // ✅ ACEITAR qualquer status (se está confirmando, forçar para paid)
      if (ticket.paymentStatus === 'paid') {
        // Se já está paid, apenas retornar
        logger.info(`Ticket ${ticketId} já estava pago`);
        return ticket;
      }

      // Atualizar ticket para paid (independente do status anterior)
      const updatedTicket = this.repository.update(ticketId, {
        paymentStatus: 'paid',
        paymentDate: new Date().toISOString(),
        transactionId
      });

      logger.info(`Ticket ${ticketId} confirmado como pago`);
      return updatedTicket;
    } catch (error) {
      logger.error('Erro ao confirmar pagamento do ticket:', error);
      throw error;
    }
  }

  // ✅ MÉTODO CORRETO para service (sem req, res)
  getSalesTicketsByOwner(ownerId, filters = {}) {
    try {
      // Buscar rifas do dono
      const userRaffles = this.dataManager.getRaffles().filter(r => r.owner === ownerId);
      const userRaffleIds = userRaffles.map(r => r.id);
      
      // Buscar tickets vendidos nas rifas do usuário
      let tickets = this.dataManager.getTickets().filter(ticket => 
        userRaffleIds.includes(ticket.raffle)
      );
      
      // Aplicar filtros
      if (filters.status) {
        tickets = tickets.filter(t => t.paymentStatus === filters.status);
      }
      
      // Enriquecer com dados do cliente e pagamento
      return tickets.map(ticket => {
        const customer = this.dataManager.getUserById(ticket.user); // Cliente que comprou
        const raffle = this.dataManager.getRaffleById(ticket.raffle); // Rifa do dono
        const payment = this.dataManager.getPayments().find(p => p.ticket === ticket.id);
        
        return {
          // Dados do pedido
          orderId: ticket.id,
          ticketNumbers: ticket.ticketNumbers,
          quantity: ticket.quantity,
          totalAmount: ticket.totalAmount,
          createdAt: ticket.createdAt,
          
          // Cliente que comprou (não o dono)
          customer: customer ? {
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          } : null,
          
          // Rifa do dono
          raffle: raffle ? {
            title: raffle.title,
            id: raffle.id
          } : null,
          
          // Pagamento do cliente
          payment: {
            status: payment?.status || 'pending',
            method: payment?.method,
            paidAt: payment?.processedAt
          }
        };
      });
    } catch (error) {
      logger.error('Erro em getSalesTicketsByOwner:', error);
      return [];
    }
  }
}

module.exports = TicketService;