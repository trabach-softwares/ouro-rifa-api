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
    const payments = this.findBy({ ticket: ticketId });
    return payments.length > 0 ? payments[0] : null; // Retornar apenas um
  }

  findByRaffle(raffleId) {
    return this.findBy({ raffle: raffleId });
  }

  findByStatus(status) {
    return this.findBy({ status });
  }

  findCompleted() {
    return this.findByStatus('completed');
  }

  findPending() {
    return this.findByStatus('pending');
  }

  findByMethod(method) {
    return this.findBy({ method });
  }

  create(paymentData) {
    const newPayment = {
      id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...paymentData,
      processedAt: null,
      transactionId: null,
      createdAt: new Date().toISOString()
    };
    
    return super.create(newPayment);
  }

  markAsCompleted(paymentId, transactionId) {
    return this.update(paymentId, {
      status: 'completed',
      processedAt: new Date().toISOString(),
      transactionId
    });
  }

  findByDateRange(startDate, endDate) {
    const payments = this.findAll();
    return payments.filter(payment => {
      const paymentDate = payment.processedAt || payment.createdAt;
      return paymentDate && 
             new Date(paymentDate) >= new Date(startDate) && 
             new Date(paymentDate) <= new Date(endDate);
    });
  }
}

module.exports = PaymentRepository;