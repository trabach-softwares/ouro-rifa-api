const BaseRepository = require('./baseRepository');
const { PAYMENT_STATUS } = require('../config/constants');

class PaymentRepository extends BaseRepository {
  constructor(dataManager) {
    super(dataManager, 'payments', 'payment');
  }

  findByUser(userId) {
    return this.findBy({ user: userId });
  }

  findByTicket(ticketId) {
    return this.findOneBy({ ticket: ticketId });
  }

  findByRaffle(raffleId) {
    return this.findBy({ raffle: raffleId });
  }

  findByStatus(status) {
    return this.findBy({ status });
  }

  findCompleted() {
    return this.findByStatus(PAYMENT_STATUS.PAID);
  }

  findPending() {
    return this.findByStatus(PAYMENT_STATUS.PENDING);
  }

  findByMethod(method) {
    return this.findBy({ method });
  }

  create(paymentData) {
    const newPayment = {
      ...paymentData,
      processedAt: null,
      transactionId: null
    };
    
    return super.create(newPayment);
  }

  markAsCompleted(paymentId, transactionId) {
    return this.update(paymentId, {
      status: PAYMENT_STATUS.PAID,
      processedAt: new Date().toISOString(),
      transactionId
    });
  }

  findByDateRange(startDate, endDate) {
    const payments = this.findAll();
    return payments.filter(payment => {
      const paymentDate = new Date(payment.processedAt || payment.createdAt);
      return paymentDate >= new Date(startDate) && paymentDate <= new Date(endDate);
    });
  }
}

module.exports = PaymentRepository;