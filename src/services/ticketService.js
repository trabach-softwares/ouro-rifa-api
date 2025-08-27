const BaseService = require('./baseService');
const TicketRepository = require('../repositories/ticketRepository');
const RaffleRepository = require('../repositories/raffleRepository');
const helpers = require('../utils/helpers');
const { ERROR_MESSAGES, SUCCESS_MESSAGES, PAYMENT_STATUS } = require('../config/constants');

class TicketService extends BaseService {
  constructor(dataManager) {
    const ticketRepository = new TicketRepository(dataManager);
    super(ticketRepository);
    this.dataManager = dataManager;
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
    let tickets = this.repository.findByUser(userId);
    
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
    return this.repository.findByRaffle(raffleId);
  }

  markTicketAsWinner(ticketId) {
    return this.repository.markAsWinner(ticketId);
  }

  confirmTicketPayment(ticketId, transactionId) {
    return this.repository.update(ticketId, {
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentDate: new Date().toISOString(),
      transactionId
    });
  }
}

module.exports = TicketService;