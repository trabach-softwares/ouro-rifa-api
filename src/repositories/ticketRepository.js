const BaseRepository = require('./baseRepository');
const { PAYMENT_STATUS } = require('../config/constants');

class TicketRepository extends BaseRepository {
  constructor(dataManager) {
    super(dataManager, 'tickets', 'ticket');
  }

  findByUser(userId) {
    return this.findBy({ user: userId });
  }

  findByRaffle(raffleId) {
    return this.findBy({ raffle: raffleId });
  }

  findByPaymentStatus(status) {
    return this.findBy({ paymentStatus: status });
  }

  findPaidTickets() {
    return this.findByPaymentStatus(PAYMENT_STATUS.PAID);
  }

  findPendingTickets() {
    return this.findByPaymentStatus(PAYMENT_STATUS.PENDING);
  }

  create(ticketData) {
    const newTicket = {
      ...ticketData,
      isWinner: false,
      paymentDate: null,
      transactionId: null
    };
    
    return super.create(newTicket);
  }

  findByUserAndRaffle(userId, raffleId) {
    return this.findBy({ user: userId, raffle: raffleId });
  }

  getTicketsByStatus(status) {
    return this.findBy({ paymentStatus: status });
  }

  markAsWinner(ticketId) {
    return this.update(ticketId, { isWinner: true });
  }
}

module.exports = TicketRepository;