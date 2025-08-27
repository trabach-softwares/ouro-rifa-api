const PaymentService = require('../services/paymentService');
const ResponseFormatter = require('../utils/responseFormatter');
const PaginationHelper = require('../utils/pagination');
const { catchAsync } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const dataManager = require('../utils/dataManager');

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService(dataManager);
  }

  generatePix = catchAsync(async (req, res) => {
    const { ticketId } = req.body;
    
    if (!ticketId) {
      return ResponseFormatter.badRequest(res, 'ID do ticket é obrigatório');
    }

    const result = await this.paymentService.generatePix(ticketId, req.user.id);

    logger.info(`PIX gerado para ticket ${ticketId} por ${req.user.email}`);

    return ResponseFormatter.success(res, result.payment, result.message);
  });

  confirmPayment = catchAsync(async (req, res) => {
    const { paymentId, transactionId } = req.body;
    
    if (!paymentId || !transactionId) {
      return ResponseFormatter.badRequest(res, 'ID do pagamento e ID da transação são obrigatórios');
    }

    const result = await this.paymentService.confirmPayment(paymentId, transactionId, req.user.id);

    logger.info(`Pagamento confirmado: ${paymentId} - ${result.payment.amount} por ${req.user.email}`);

    return ResponseFormatter.success(res, {
      payment: result.payment,
      ticket: result.ticket
    }, result.message);
  });

  getPaymentStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const payment = this.paymentService.getPaymentStatus(id, req.user.id);

    return ResponseFormatter.success(res, payment);
  });

  getMyPayments = catchAsync(async (req, res) => {
    const { page, limit, status } = req.query;
    const { page: validPage, limit: validLimit } = PaginationHelper.validatePaginationParams(page, limit);

    let payments = this.paymentService.getPaymentsByUser(req.user.id);
    
    // Filtrar por status se fornecido
    if (status) {
      payments = payments.filter(payment => payment.status === status);
    }

    // Enriquecer com informações adicionais
    payments = payments.map(payment => {
      const ticket = dataManager.getTicketById(payment.ticket);
      const raffle = dataManager.getRaffleById(payment.raffle);
      
      return {
        ...payment,
        ticket: ticket ? {
          id: ticket.id,
          quantity: ticket.quantity,
          ticketNumbers: ticket.ticketNumbers
        } : null,
        raffle: raffle ? {
          id: raffle.id,
          title: raffle.title,
          image: raffle.image
        } : null
      };
    });

    const { data: paginatedPayments, pagination } = PaginationHelper.paginate(
      payments, 
      validPage, 
      validLimit
    );

    return ResponseFormatter.paginated(res, paginatedPayments, pagination);
  });

  // Métodos administrativos
  getPaymentsByRaffle = catchAsync(async (req, res) => {
    const { raffleId } = req.params;
    const { page, limit } = req.query;
    const { page: validPage, limit: validLimit } = PaginationHelper.validatePaginationParams(page, limit);

    // Verificar permissões
    const raffle = dataManager.getRaffleById(raffleId);
    if (!raffle) {
      return ResponseFormatter.notFound(res, 'Rifa não encontrada');
    }

    if (raffle.owner !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return ResponseFormatter.forbidden(res, 'Sem permissão para visualizar pagamentos desta rifa');
    }

    const payments = this.paymentService.getPaymentsByRaffle(raffleId);
    
    const { data: paginatedPayments, pagination } = PaginationHelper.paginate(
      payments, 
      validPage, 
      validLimit
    );

    return ResponseFormatter.paginated(res, paginatedPayments, pagination);
  });

  getAllPayments = catchAsync(async (req, res) => {
    const { page, limit, status } = req.query;
    const { page: validPage, limit: validLimit } = PaginationHelper.validatePaginationParams(page, limit);

    // Apenas admins podem ver todos os pagamentos
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return ResponseFormatter.forbidden(res, 'Acesso negado');
    }

    let payments;
    if (status === 'completed') {
      payments = this.paymentService.getCompletedPayments();
    } else if (status === 'pending') {
      payments = this.paymentService.getPendingPayments();
    } else {
      payments = dataManager.getPayments();
    }

    const { data: paginatedPayments, pagination } = PaginationHelper.paginate(
      payments, 
      validPage, 
      validLimit
    );

    return ResponseFormatter.paginated(res, paginatedPayments, pagination);
  });

  getPaymentStats = catchAsync(async (req, res) => {
    // Apenas admins
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return ResponseFormatter.forbidden(res, 'Acesso negado');
    }

    const allPayments = dataManager.getPayments();
    const completedPayments = this.paymentService.getCompletedPayments();
    const pendingPayments = this.paymentService.getPendingPayments();

    const stats = {
      total: allPayments.length,
      completed: completedPayments.length,
      pending: pendingPayments.length,
      cancelled: allPayments.filter(p => p.status === 'cancelled').length,
      totalRevenue: completedPayments.reduce((sum, p) => sum + p.amount, 0),
      averagePayment: completedPayments.length > 0 
        ? completedPayments.reduce((sum, p) => sum + p.amount, 0) / completedPayments.length 
        : 0,
      methodsBreakdown: allPayments.reduce((acc, p) => {
        acc[p.method] = (acc[p.method] || 0) + 1;
        return acc;
      }, {})
    };

    return ResponseFormatter.success(res, stats);
  });
}

module.exports = new PaymentController();