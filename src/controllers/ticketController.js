const TicketService = require('../services/ticketService');
const dataManager = require('../utils/dataManager');
const ResponseFormatter = require('../utils/responseFormatter');
const PaginationHelper = require('../utils/pagination'); // ✅ ADICIONAR
const { catchAsync } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const TicketValidator = require('../validators/ticketValidator');

class TicketController {
  constructor() {
    this.ticketService = new TicketService(dataManager);
  }

  getTickets = catchAsync(async (req, res) => {
    // Verificar se req.user existe
    if (!req.user || !req.user.id) {
      return ResponseFormatter.unauthorized(res, 'Usuário não autenticado');
    }

    const { raffle, status, page, limit } = req.query;
    const { page: validPage, limit: validLimit } = PaginationHelper.validatePaginationParams(page, limit);
    
    const filters = {};
    if (raffle) filters.raffle = raffle;
    if (status) filters.status = status;

    try {
      const tickets = this.ticketService.getTicketsByUser(req.user.id, filters);
      
      const { data: paginatedTickets, pagination } = PaginationHelper.paginate(
        tickets, 
        validPage, 
        validLimit
      );

      return ResponseFormatter.paginated(res, paginatedTickets, pagination);
    } catch (error) {
      logger.error('Erro ao buscar tickets:', error);
      return ResponseFormatter.error(res, 'Erro interno ao buscar tickets');
    }
  });

  getTicketById = catchAsync(async (req, res) => {
    // Verificar se req.user existe
    if (!req.user || !req.user.id) {
      return ResponseFormatter.unauthorized(res, 'Usuário não autenticado');
    }

    const { id } = req.params;
    
    try {
      const ticketDetails = this.ticketService.getTicketDetails(id, req.user.id);
      return ResponseFormatter.success(res, ticketDetails);
    } catch (error) {
      logger.error('Erro ao buscar ticket:', error);
      if (error.message.includes('não encontrado')) {
        return ResponseFormatter.notFound(res, error.message);
      }
      if (error.message.includes('Acesso negado')) {
        return ResponseFormatter.forbidden(res, error.message);
      }
      return ResponseFormatter.error(res, 'Erro interno ao buscar ticket');
    }
  });

  buyTickets = catchAsync(async (req, res) => {
    // Verificar se req.user existe
    if (!req.user || !req.user.id) {
      return ResponseFormatter.unauthorized(res, 'Usuário não autenticado');
    }

    try {
      const validatedData = TicketValidator.validateBuyTickets(req.body);
      const result = await this.ticketService.buyTickets(validatedData, req.user.id);

      logger.info(`Tickets comprados: ${validatedData.quantity} para rifa ${validatedData.raffle} por ${req.user.email}`);

      return ResponseFormatter.created(res, {
        ticket: result.ticket,
        nextStep: result.nextStep
      }, result.message);
    } catch (error) {
      logger.error('Erro ao comprar tickets:', error);
      if (error.message.includes('não encontrada')) {
        return ResponseFormatter.notFound(res, error.message);
      }
      if (error.message.includes('não está ativa')) {
        return ResponseFormatter.badRequest(res, error.message);
      }
      return ResponseFormatter.error(res, 'Erro interno ao comprar tickets');
    }
  });

  cancelTicket = catchAsync(async (req, res) => {
    // Verificar se req.user existe
    if (!req.user || !req.user.id) {
      return ResponseFormatter.unauthorized(res, 'Usuário não autenticado');
    }

    const { id } = req.params;
    
    try {
      const result = await this.ticketService.cancelTicket(id, req.user.id);

      logger.info(`Ticket cancelado: ${id} por ${req.user.email}`);

      return ResponseFormatter.success(res, result.ticket, result.message);
    } catch (error) {
      logger.error('Erro ao cancelar ticket:', error);
      if (error.message.includes('não encontrado')) {
        return ResponseFormatter.notFound(res, error.message);
      }
      if (error.message.includes('Acesso negado')) {
        return ResponseFormatter.forbidden(res, error.message);
      }
      if (error.message.includes('não é possível cancelar')) {
        return ResponseFormatter.badRequest(res, error.message);
      }
      return ResponseFormatter.error(res, 'Erro interno ao cancelar ticket');
    }
  });

  // Métodos administrativos
  getTicketsByRaffle = catchAsync(async (req, res) => {
    const { raffleId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const { page: validPage, limit: validLimit } = PaginationHelper.validatePaginationParams(page, limit);

    // Verificar se o usuário está autenticado
    if (!req.user || !req.user.id) {
      return ResponseFormatter.unauthorized(res, 'Usuário não autenticado');
    }

    try {
      // Verificar se a rifa existe
      const raffle = dataManager.getRaffleById(raffleId);
      if (!raffle) {
        return ResponseFormatter.notFound(res, 'Rifa não encontrada');
      }

      // Verificar permissões - só o dono da rifa ou admin podem ver todos os tickets
      if (raffle.owner !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return ResponseFormatter.forbidden(res, 'Sem permissão para visualizar tickets desta rifa');
      }

      // Buscar tickets da rifa usando dataManager diretamente
      const allTickets = dataManager.getTicketsByRaffle(raffleId);
      
      // Enriquecer dados dos tickets com informações do comprador
      const enrichedTickets = allTickets.map(ticket => {
        const buyer = dataManager.getUserById(ticket.user);
        const payment = dataManager.getPayments().find(p => p.ticket === ticket.id);
        
        return {
          ...ticket,
          buyer: buyer ? {
            id: buyer.id,
            name: buyer.name,
            email: buyer.email,
            phone: buyer.phone
          } : null,
          payment: payment ? {
            id: payment.id,
            status: payment.status,
            method: payment.method,
            processedAt: payment.processedAt
          } : null
        };
      });

      // Ordenar por data de criação (mais recente primeiro)
      enrichedTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Aplicar paginação
      const { data: paginatedTickets, pagination } = PaginationHelper.paginate(
        enrichedTickets, 
        validPage, 
        validLimit
      );

      return ResponseFormatter.paginated(res, paginatedTickets, pagination, 'Tickets da rifa obtidos com sucesso');
    } catch (error) {
      logger.error('Erro ao buscar tickets da rifa:', error);
      return ResponseFormatter.error(res, 'Erro interno ao buscar tickets da rifa');
    }
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

  getSalesTickets = catchAsync(async (req, res) => {
    // Verificar se req.user existe
    if (!req.user || !req.user.id) {
      return ResponseFormatter.unauthorized(res, 'Usuário não autenticado');
    }

    const { status, page = 1, limit = 10 } = req.query;
    const { page: validPage, limit: validLimit } = PaginationHelper.validatePaginationParams(page, limit);
    
    const filters = {};
    if (status) filters.status = status;

    try {
      // Usar o método correto do service
      const salesTickets = this.ticketService.getSalesTicketsByOwner(req.user.id, filters);
      
      const { data: paginatedTickets, pagination } = PaginationHelper.paginate(
        salesTickets, 
        validPage, 
        validLimit
      );

      return ResponseFormatter.paginated(res, paginatedTickets, pagination, 'Vendas de tickets obtidas com sucesso');
    } catch (error) {
      logger.error('Erro ao buscar vendas de tickets:', error);
      return ResponseFormatter.error(res, 'Erro interno ao buscar vendas de tickets');
    }
  });
}

module.exports = new TicketController();