const BaseService = require('./baseService');
const RaffleRepository = require('../repositories/raffleRepository');
const { RAFFLE_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../config/constants');

class RaffleService extends BaseService {
  constructor(dataManager) {
    const raffleRepository = new RaffleRepository(dataManager);
    super(raffleRepository);
    this.dataManager = dataManager;
  }

  async createRaffle(raffleData, ownerId) {
    const newRaffleData = {
      ...raffleData,
      owner: ownerId,
      status: RAFFLE_STATUS.PENDING,
      startDate: new Date().toISOString(),
      commission: 10 // Comissão padrão
    };

    const raffle = this.repository.create(newRaffleData);
    
    return {
      raffle,
      message: SUCCESS_MESSAGES.RAFFLE_CREATED
    };
  }

  async updateRaffle(raffleId, updateData, userId) {
    const raffle = await this.findById(raffleId);
    
    // Verificar propriedade
    if (raffle.owner !== userId) {
      throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    // Verificar se pode atualizar campos sensíveis
    const restrictedFields = ['totalTickets', 'ticketPrice'];
    if (raffle.status === RAFFLE_STATUS.ACTIVE && raffle.soldTickets > 0) {
      for (const field of restrictedFields) {
        if (updateData[field] !== undefined) {
          throw new Error(`Não é possível alterar ${field} em rifa ativa com tickets vendidos`);
        }
      }
    }

    const updatedRaffle = this.repository.update(raffleId, updateData);
    
    return {
      raffle: updatedRaffle,
      message: SUCCESS_MESSAGES.RAFFLE_UPDATED
    };
  }

  async deleteRaffle(raffleId, userId) {
    const raffle = await this.findById(raffleId);
    
    // Verificar propriedade
    if (raffle.owner !== userId) {
      throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    // Não permitir exclusão se houver tickets vendidos
    if (raffle.soldTickets > 0) {
      throw new Error('Não é possível excluir rifa com tickets vendidos');
    }

    const deleted = this.repository.delete(raffleId);
    
    return {
      success: deleted,
      message: SUCCESS_MESSAGES.RAFFLE_DELETED
    };
  }

  async updateStatus(raffleId, newStatus, userId) {
    const raffle = await this.findById(raffleId);
    
    // Verificar propriedade
    if (raffle.owner !== userId) {
      throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    // Validar transição de status
    this.validateStatusTransition(raffle.status, newStatus, raffle);

    const updatedRaffle = this.repository.update(raffleId, { status: newStatus });
    
    return {
      raffle: updatedRaffle,
      message: `Status da rifa atualizado para ${newStatus}`
    };
  }

  async drawRaffle(raffleId, userId) {
    const raffle = await this.findById(raffleId);
    
    // Verificar propriedade
    if (raffle.owner !== userId) {
      throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    // Verificações para sorteio
    if (raffle.status !== RAFFLE_STATUS.ACTIVE) {
      throw new Error('Rifa deve estar ativa para ser sorteada');
    }

    if (raffle.winner) {
      throw new Error('Rifa já foi sorteada');
    }

    // Buscar tickets pagos
    const tickets = this.dataManager.getTicketsByRaffle(raffleId);
    const paidTickets = tickets.filter(ticket => ticket.paymentStatus === 'paid');
    
    if (paidTickets.length === 0) {
      throw new Error('Não há tickets pagos para o sorteio');
    }

    // Realizar sorteio
    const winnerData = this.performDraw(paidTickets);
    
    // Atualizar rifa
    const updatedRaffle = this.repository.update(raffleId, {
      status: RAFFLE_STATUS.COMPLETED,
      winner: winnerData.winnerUserId,
      winnerTicket: winnerData.winnerTicketNumber,
      drawDate: new Date().toISOString()
    });

    // Marcar ticket como vencedor
    this.dataManager.updateTicket(winnerData.winnerTicketId, { isWinner: true });

    // Buscar dados do vencedor
    const winner = this.dataManager.getUserById(winnerData.winnerUserId);

    return {
      raffle: updatedRaffle,
      winner: {
        id: winner.id,
        name: winner.name,
        email: winner.email,
        ticketNumber: winnerData.winnerTicketNumber
      },
      message: SUCCESS_MESSAGES.DRAW_COMPLETED
    };
  }

  getRafflesByOwner(ownerId) {
    return this.repository.findByOwner(ownerId);
  }

  getActiveRaffles() {
    return this.repository.findActive();
  }

  searchRaffles(searchTerm) {
    return this.repository.search(searchTerm);
  }

  getRaffleStats(raffleId) {
    const raffle = this.repository.findById(raffleId);
    if (!raffle) return null;

    const tickets = this.dataManager.getTicketsByRaffle(raffleId);
    const paidTickets = tickets.filter(t => t.paymentStatus === 'paid');
    const soldTicketsCount = paidTickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
    const revenue = paidTickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
    
    return {
      soldTickets: soldTicketsCount,
      availableTickets: raffle.totalTickets - soldTicketsCount,
      revenue,
      completionPercentage: (soldTicketsCount / raffle.totalTickets) * 100
    };
  }

  // Métodos privados
  validateStatusTransition(currentStatus, newStatus, raffle) {
    const validTransitions = {
      [RAFFLE_STATUS.PENDING]: [RAFFLE_STATUS.ACTIVE, RAFFLE_STATUS.CANCELLED],
      [RAFFLE_STATUS.ACTIVE]: [RAFFLE_STATUS.PAUSED, RAFFLE_STATUS.COMPLETED, RAFFLE_STATUS.CANCELLED],
      [RAFFLE_STATUS.PAUSED]: [RAFFLE_STATUS.ACTIVE, RAFFLE_STATUS.CANCELLED],
      [RAFFLE_STATUS.COMPLETED]: [], // Não pode sair de completed
      [RAFFLE_STATUS.CANCELLED]: [] // Não pode sair de cancelled
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Transição de status inválida: ${currentStatus} -> ${newStatus}`);
    }

    // Regras específicas
    if (newStatus === RAFFLE_STATUS.ACTIVE && !raffle.endDate) {
      throw new Error('Rifa deve ter data de fim definida para ser ativada');
    }
  }

  performDraw(paidTickets) {
    const allTicketNumbers = [];
    
    paidTickets.forEach(ticket => {
      ticket.ticketNumbers.forEach(number => {
        allTicketNumbers.push({
          number,
          ticketId: ticket.id,
          userId: ticket.user
        });
      });
    });

    const randomIndex = Math.floor(Math.random() * allTicketNumbers.length);
    const winnerTicket = allTicketNumbers[randomIndex];

    return {
      winnerTicketNumber: winnerTicket.number,
      winnerTicketId: winnerTicket.ticketId,
      winnerUserId: winnerTicket.userId
    };
  }
}

module.exports = RaffleService;