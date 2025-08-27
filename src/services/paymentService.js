const QRCode = require('qrcode');
const BaseService = require('./baseService');
const PaymentRepository = require('../repositories/paymentRepository');
const TicketService = require('./ticketService');
const RaffleService = require('./raffleService');
const helpers = require('../utils/helpers');
const { ERROR_MESSAGES, SUCCESS_MESSAGES, PAYMENT_STATUS } = require('../config/constants');
const config = require('../config/environment');

class PaymentService extends BaseService {
  constructor(dataManager) {
    const paymentRepository = new PaymentRepository(dataManager);
    super(paymentRepository);
    this.dataManager = dataManager;
    this.ticketService = new TicketService(dataManager);
    this.raffleService = new RaffleService(dataManager);
  }

  async generatePix(ticketId, userId) {
    // Verificar ticket
    const ticketDetails = this.ticketService.getTicketDetails(ticketId, userId);
    const { ticket, raffle } = ticketDetails;

    if (ticket.paymentStatus !== PAYMENT_STATUS.PENDING) {
      throw new Error('Ticket não está pendente de pagamento');
    }

    // Buscar dados do proprietário da rifa
    const raffleOwner = this.dataManager.getUserById(raffle.owner);
    
    // Configurar PIX
    const pixKey = raffleOwner.paymentSettings?.pixKey || config.pix.key;
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
      status: PAYMENT_STATUS.PENDING,
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
      message: SUCCESS_MESSAGES.PIX_GENERATED
    };
  }

  async confirmPayment(paymentId, transactionId, userId) {
    // Buscar pagamento
    const payment = this.repository.findById(paymentId);
    if (!payment) {
      throw new Error(ERROR_MESSAGES.PAYMENT_NOT_FOUND);
    }

    // Verificar permissão
    if (payment.user !== userId) {
      throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    // Verificar se já foi processado
    if (payment.status === PAYMENT_STATUS.PAID) {
      throw new Error('Pagamento já foi confirmado');
    }

    // Atualizar pagamento
    const updatedPayment = this.repository.markAsCompleted(paymentId, transactionId);

    // Confirmar ticket
    const ticket = this.ticketService.confirmTicketPayment(payment.ticket, transactionId);

    // Atualizar estatísticas da rifa
    await this.updateRaffleStats(payment.raffle, ticket.quantity, payment.amount);

    // Atualizar estatísticas do usuário
    await this.updateUserStats(payment.user, payment.amount);

    return {
      payment: updatedPayment,
      ticket,
      message: SUCCESS_MESSAGES.PAYMENT_CONFIRMED
    };
  }

  async updateRaffleStats(raffleId, quantity, amount) {
    const raffle = this.dataManager.getRaffleById(raffleId);
    const newSoldTickets = raffle.soldTickets + quantity;
    const newRevenue = raffle.revenue + amount;
    const newAvailableTickets = raffle.totalTickets - newSoldTickets;

    return this.dataManager.updateRaffle(raffleId, {
      soldTickets: newSoldTickets,
      availableTickets: newAvailableTickets,
      revenue: newRevenue
    });
  }

  async updateUserStats(userId, amount) {
    const user = this.dataManager.getUserById(userId);
    return this.dataManager.updateUser(userId, {
      totalPurchases: user.totalPurchases + amount
    });
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
    return this.repository.findCompleted();
  }

  getPendingPayments() {
    return this.repository.findPending();
  }
}

module.exports = PaymentService;