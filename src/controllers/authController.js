const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserService = require('../services/userService');
const ResponseFormatter = require('../utils/responseFormatter');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const dataManager = require('../utils/dataManager');
const RaffleService = require('../services/raffleService');
const { DEFAULT_PAGINATION, ERROR_MESSAGES } = require('../config/constants');

class AuthController {
  constructor() {
    this.userService = new UserService(dataManager);
    this.raffleService = new RaffleService(dataManager);
  }

  register = catchAsync(async (req, res) => {
    try {
      const result = await this.userService.register(req.body);

      logger.info(`Novo usuário registrado: ${req.body.email}`);

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user
        }
      });
    } catch (error) {
      // Deixar o middleware de erro tratar
      throw error;
    }
  });

  login = catchAsync(async (req, res) => {
    try {
      const { email, password } = req.body;

      // Usar o método login do service (que já inclui todas as validações)
      const result = await this.userService.login(email, password);

      logger.info(`Login realizado com sucesso: ${email}`);

      res.json({
        success: true,
        message: result.message,
        data: {
          token: result.token,
          user: result.user
        }
      });
    } catch (error) {
      // Deixar o middleware de erro tratar
      throw error;
    }
  });

  getProfile = catchAsync(async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new AppError(ERROR_MESSAGES.INVALID_TOKEN, 401);
    }

    try {
      const user = await this.userService.findById(userId);
      
      // Remover dados sensíveis
      const { password, ...userResponse } = user;

      res.json({
        success: true,
        data: {
          user: userResponse
        }
      });
    } catch (error) {
      throw error;
    }
  });

  updateProfile = catchAsync(async (req, res) => {
    try {
      const result = await this.userService.updateProfile(req.user.id, req.body);
      
      logger.info(`Perfil atualizado para usuário: ${req.user.email}`);
      
      return ResponseFormatter.success(res, result.user, result.message);
    } catch (error) {
      throw error;
    }
  });

  changePassword = catchAsync(async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await this.userService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );
      
      logger.info(`Senha alterada para usuário: ${req.user.email}`);
      
      return ResponseFormatter.success(res, null, result.message);
    } catch (error) {
      throw error;
    }
  });

  getRaffles = catchAsync(async (req, res) => {
    const { 
      status, 
      page = DEFAULT_PAGINATION.PAGE, 
      limit = DEFAULT_PAGINATION.LIMIT, 
      search 
    } = req.query;
    
    // Buscar rifas ativas do dataManager
    let raffles = dataManager.getRaffles().filter(raffle => raffle.status === 'active');
    
    // Aplicar filtros
    if (status && status !== 'active') {
      raffles = dataManager.getRaffles().filter(raffle => raffle.status === status);
    }
    
    if (search) {
      raffles = raffles.filter(raffle => 
        raffle.title.toLowerCase().includes(search.toLowerCase()) ||
        raffle.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Calcular estatísticas para cada rifa
    raffles = raffles.map(raffle => {
      const tickets = dataManager.getTickets().filter(ticket => ticket.raffle === raffle.id);
      const soldTickets = tickets.filter(ticket => ticket.paymentStatus === 'paid')
                                 .reduce((sum, ticket) => sum + ticket.quantity, 0);
      
      return { 
        ...raffle, 
        soldTickets,
        availableTickets: raffle.totalTickets - soldTickets,
        progress: (soldTickets / raffle.totalTickets) * 100
      };
    });

    // Paginação
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedRaffles = raffles.slice(startIndex, endIndex);

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(raffles.length / limit),
      totalItems: raffles.length,
      limit: parseInt(limit),
      hasNext: endIndex < raffles.length,
      hasPrev: startIndex > 0
    };

    return ResponseFormatter.paginated(res, paginatedRaffles, pagination);
  });

  getRaffleById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const raffle = dataManager.getRaffleById(id);
    
    if (!raffle) {
      return ResponseFormatter.notFound(res, 'Rifa não encontrada');
    }
    
    // Calcular estatísticas
    const tickets = dataManager.getTickets().filter(ticket => ticket.raffle === id);
    const soldTickets = tickets.filter(ticket => ticket.paymentStatus === 'paid')
                               .reduce((sum, ticket) => sum + ticket.quantity, 0);
    
    const stats = {
      soldTickets,
      availableTickets: raffle.totalTickets - soldTickets,
      progress: (soldTickets / raffle.totalTickets) * 100
    };
    
    // Buscar informações do proprietário
    const owner = dataManager.getUserById(raffle.owner);
    const ownerInfo = owner ? {
      id: owner.id,
      name: owner.name,
      company: owner.company
    } : null;

    return ResponseFormatter.success(res, {
      raffle: { ...raffle, ...stats },
      owner: ownerInfo
    });
  });

  createRaffle = catchAsync(async (req, res) => {
    // Implementação básica sem validador por enquanto
    const {
      title,
      description,
      ticketPrice,
      totalTickets,
      endDate,
      image,
      settings = {}
    } = req.body;

    // Validações básicas
    if (!title || !description || !ticketPrice || !totalTickets || !endDate) {
      return ResponseFormatter.badRequest(res, 'Campos obrigatórios: title, description, ticketPrice, totalTickets, endDate');
    }

    const newRaffle = {
      id: `raffle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      ticketPrice: parseFloat(ticketPrice),
      totalTickets: parseInt(totalTickets),
      soldTickets: 0,
      endDate: new Date(endDate).toISOString(),
      image: image || null,
      status: 'pending',
      owner: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        maxTicketsPerPerson: settings.maxTicketsPerPerson || 10,
        allowComments: settings.allowComments !== false,
        ...settings
      }
    };

    dataManager.createRaffle(newRaffle);

    logger.info(`Nova rifa criada: ${newRaffle.id} por usuário ${req.user.id}`);

    return ResponseFormatter.created(res, newRaffle, 'Rifa criada com sucesso');
  });

  updateRaffle = catchAsync(async (req, res) => {
    return ResponseFormatter.success(res, null, 'Atualizar rifa - a implementar');
  });

  deleteRaffle = catchAsync(async (req, res) => {
    return ResponseFormatter.success(res, null, 'Excluir rifa - a implementar');
  });

  drawRaffle = catchAsync(async (req, res) => {
    return ResponseFormatter.success(res, null, 'Sorteio - a implementar');
  });

  updateRaffleStatus = catchAsync(async (req, res) => {
    return ResponseFormatter.success(res, null, 'Atualizar status - a implementar');
  });

  // Rotas específicas para donos de rifa
  getMyRaffles = catchAsync(async (req, res) => {
    const raffles = dataManager.getRaffles().filter(raffle => raffle.owner === req.user.id);
    
    // Calcular estatísticas
    const rafflesWithStats = raffles.map(raffle => {
      const tickets = dataManager.getTickets().filter(ticket => ticket.raffle === raffle.id);
      const soldTickets = tickets.filter(ticket => ticket.paymentStatus === 'paid')
                                 .reduce((sum, ticket) => sum + ticket.quantity, 0);
      
      return { 
        ...raffle, 
        soldTickets,
        availableTickets: raffle.totalTickets - soldTickets,
        progress: (soldTickets / raffle.totalTickets) * 100
      };
    });

    return ResponseFormatter.success(res, rafflesWithStats);
  });
}

module.exports = new AuthController();