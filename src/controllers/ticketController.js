const TicketService = require('../services/ticketService');
const TicketValidator = require('../validators/ticketValidator');
const ResponseFormatter = require('../utils/responseFormatter');
const PaginationHelper = require('../utils/pagination');
const { catchAsync } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const dataManager = require('../utils/dataManager');

class TicketController {
  constructor() {
    this.ticketService = new TicketService(dataManager);
  }

  getTickets = catchAsync(async (req, res) => {
    const { raffle, status, page, limit } = req.query;
    const { page: validPage, limit: validLimit } = PaginationHelper.validatePaginationParams(page, limit);
    
    const filters = {};
    if (raffle) filters.raffle = raffle;
    if (status) filters.status = status;

    const tickets = this.ticketService.getTicketsByUser(req.user.id, filters);
    
    const { data: paginatedTickets, pagination } = PaginationHelper.paginate(
      tickets, 
      validPage, 
      validLimit
    );

    return ResponseFormatter.paginated(res, paginatedTickets, pagination);
  });

  getTicketById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const ticketDetails = this.ticketService.getTicketDetails(id, req.user.id);

    return ResponseFormatter.success(res, ticketDetails);
  });

  buyTickets = catchAsync(async (req, res) => {
    const validatedData = TicketValidator.validateBuyTickets(req.body);
    const result = await this.ticketService.buyTickets(validatedData, req.user.id);

    logger.info(`Tickets comprados: ${validatedData.quantity} para rifa ${validatedData.raffle} por ${req.user.email}`);

    return ResponseFormatter.created(res, {
      ticket: result.ticket,
      nextStep: result.nextStep
    }, result.message);
  });

  cancelTicket = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await this.ticketService.cancelTicket(id, req.user.id);

    logger.info(`Ticket cancelado: ${id} por ${req.user.email}`);

    return ResponseFormatter.success(res, result.ticket, result.message);
  });

  // Métodos administrativos
  getTicketsByRaffle = catchAsync(async (req, res) => {
    const { raffleId } = req.params;
    const { page, limit } = req.query;
    const { page: validPage, limit: validLimit } = PaginationHelper.validatePaginationParams(page, limit);

    // Verificar se o usuário é dono da rifa ou admin
    const raffle = dataManager.getRaffleById(raffleId);
    if (!raffle) {
      return ResponseFormatter.notFound(res, 'Rifa não encontrada');
    }

    if (raffle.owner !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return ResponseFormatter.forbidden(res, 'Sem permissão para visualizar tickets desta rifa');
    }

    const tickets = this.ticketService.getTicketsByRaffle(raffleId);
    
    const { data: paginatedTickets, pagination } = PaginationHelper.paginate(
      tickets, 
      validPage, 
      validLimit
    );

    return ResponseFormatter.paginated(res, paginatedTickets, pagination);
  });

  getTicketStats = catchAsync(async (req, res) => {
    const { raffleId } = req.params;
    
    // Verificar permissões
    const raffle = dataManager.getRaffleById(raffleId);
    if (!raffle) {
      return ResponseFormatter.notFound(res, 'Rifa não encontrada');
    }

    if (raffle.owner !== req.user.id && req.user.role !== 'admin') {
      return ResponseFormatter.forbidden(res, 'Sem permissão para visualizar estatísticas desta rifa');
    }

    const tickets = this.ticketService.getTicketsByRaffle(raffleId);
    
    const stats = {
      totalTickets: tickets.length,
      paidTickets: tickets.filter(t => t.paymentStatus === 'paid').length,
      pendingTickets: tickets.filter(t => t.paymentStatus === 'pending').length,
      cancelledTickets: tickets.filter(t => t.paymentStatus === 'cancelled').length,
      totalRevenue: tickets
        .filter(t => t.paymentStatus === 'paid')
        .reduce((sum, t) => sum + t.totalAmount, 0),
      totalTicketsSold: tickets
        .filter(t => t.paymentStatus === 'paid')
        .reduce((sum, t) => sum + t.quantity, 0)
    };

    return ResponseFormatter.success(res, stats);
  });
}

module.exports = new TicketController();