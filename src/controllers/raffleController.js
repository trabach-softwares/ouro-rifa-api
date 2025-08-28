const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dataManager = require('../utils/dataManager');
const ResponseFormatter = require('../utils/responseFormatter');
const { DEFAULT_PAGINATION, ERROR_MESSAGES } = require('../config/constants');
const { logger } = require('../utils/logger');
const { catchAsync } = require('../middleware/errorHandler');
const RaffleValidator = require('../validators/raffleValidator');
const { RAFFLE_CATEGORIES, DRAW_TYPES } = require('../config/constants');

class RaffleController {
  constructor() {
    // Bind dos métodos para manter o contexto correto
    this.getRaffles = this.getRaffles.bind(this);
    this.getRaffleById = this.getRaffleById.bind(this);
    this.getMyRaffles = this.getMyRaffles.bind(this);
    this.getAllRaffles = this.getAllRaffles.bind(this);
    this.createRaffle = this.createRaffle.bind(this);
    this.createRaffleWithImage = this.createRaffleWithImage.bind(this);
    this.updateRaffle = this.updateRaffle.bind(this);
    this.deleteRaffle = this.deleteRaffle.bind(this);
    this.drawRaffle = this.drawRaffle.bind(this);
    this.updateRaffleStatus = this.updateRaffleStatus.bind(this);
  }

  // Rifas públicas (não autenticadas) - apenas rifas ativas
  getRaffles = catchAsync(async (req, res) => {
    const { 
      page = DEFAULT_PAGINATION.PAGE, 
      limit = DEFAULT_PAGINATION.LIMIT, 
      search 
    } = req.query;
    
    let raffles = dataManager.getRaffles().filter(raffle => raffle.status === 'active');
    
    if (search) {
      raffles = raffles.filter(raffle => 
        raffle.title.toLowerCase().includes(search.toLowerCase()) ||
        raffle.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Calcular estatísticas para cada rifa
    raffles = raffles.map(raffle => {
      const stats = this.calculateRaffleStats(raffle.id);
      return { ...raffle, ...stats };
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

  // Obter rifa por ID (pública se ativa, restrita se não ativa)
  getRaffleById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const raffle = dataManager.getRaffleById(id);
    
    if (!raffle) {
      return ResponseFormatter.notFound(res, ERROR_MESSAGES.RAFFLE_NOT_FOUND);
    }

    // Se a rifa está ativa, qualquer um pode ver
    // Se não está ativa, verificar se o usuário está autenticado e é dono ou admin
    if (raffle.status !== 'active') {
      if (!req.user || (req.user.role !== 'super_admin' && raffle.owner !== req.user.id)) {
        return ResponseFormatter.forbidden(res, 'Esta rifa não está disponível para visualização.');
      }
    }
    
    // Calcular estatísticas
    const stats = this.calculateRaffleStats(id);
    
    // Buscar informações do proprietário
    const owner = dataManager.getUserById(raffle.owner);
    const ownerInfo = owner ? {
      id: owner.id,
      name: owner.name,
      company: owner.company
    } : null;

    // Buscar informações da imagem se existir
    let imageInfo = null;
    if (raffle.imageId) {
      const upload = dataManager.getUploadById(raffle.imageId);
      if (upload) {
        imageInfo = {
          id: upload.id,
          url: upload.url,
          filename: upload.filename,
          originalName: upload.originalName,
          size: upload.size
        };
      }
    }

    return ResponseFormatter.success(res, {
      raffle: { ...raffle, ...stats },
      owner: ownerInfo,
      image: imageInfo
    });
  });

  // Rifas do usuário logado (rota: GET /api/raffles/user/my-raffles)
  getMyRaffles = catchAsync(async (req, res) => {
    const { 
      status, 
      page = DEFAULT_PAGINATION.PAGE, 
      limit = DEFAULT_PAGINATION.LIMIT, 
      search 
    } = req.query;
    
    // Filtrar apenas rifas do usuário logado
    let raffles = dataManager.getRaffles().filter(raffle => raffle.owner === req.user.id);
    
    // Aplicar filtros
    if (status) {
      raffles = raffles.filter(raffle => raffle.status === status);
    }
    
    if (search) {
      raffles = raffles.filter(raffle => 
        raffle.title.toLowerCase().includes(search.toLowerCase()) ||
        raffle.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Calcular estatísticas para cada rifa
    raffles = raffles.map(raffle => {
      const stats = this.calculateRaffleStats(raffle.id);
      return { ...raffle, ...stats };
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

  // Todas as rifas (apenas super admin) - rota: GET /api/raffles/admin/all
  getAllRaffles = catchAsync(async (req, res) => {
    const { 
      status, 
      owner,
      page = DEFAULT_PAGINATION.PAGE, 
      limit = DEFAULT_PAGINATION.LIMIT, 
      search 
    } = req.query;
    
    let raffles = dataManager.getRaffles();
    
    // Aplicar filtros
    if (status) {
      raffles = raffles.filter(raffle => raffle.status === status);
    }
    
    if (owner) {
      raffles = raffles.filter(raffle => raffle.owner === owner);
    }
    
    if (search) {
      raffles = raffles.filter(raffle => 
        raffle.title.toLowerCase().includes(search.toLowerCase()) ||
        raffle.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Adicionar informações do proprietário
    raffles = raffles.map(raffle => {
      const ownerInfo = dataManager.getUserById(raffle.owner);
      const stats = this.calculateRaffleStats(raffle.id);
      
      return { 
        ...raffle, 
        ...stats,
        ownerInfo: ownerInfo ? {
          id: ownerInfo.id,
          name: ownerInfo.name,
          email: ownerInfo.email,
          company: ownerInfo.company
        } : null
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

  // Criar rifa
  createRaffle = catchAsync(async (req, res) => {
    try {
      // Validar dados usando o novo validador
      const validatedData = RaffleValidator.validateCreate(req.body);

      const newRaffle = {
        id: `raffle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...validatedData,
        owner: req.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const createdRaffle = dataManager.createRaffle(newRaffle);

      logger.info(`Nova rifa criada: ${createdRaffle.id} por usuário ${req.user.id}`);

      return ResponseFormatter.created(res, createdRaffle, 'Rifa criada com sucesso');
    } catch (error) {
      if (error.message.startsWith('[') || error.message.startsWith('{')) {
        // Erros de validação
        const validationErrors = JSON.parse(error.message);
        return ResponseFormatter.badRequest(res, 'Dados inválidos', validationErrors);
      }
      
      logger.error('Erro ao criar rifa:', error);
      return ResponseFormatter.error(res, 'Erro interno ao criar rifa');
    }
  });

  // Criar rifa com imagem
  createRaffleWithImage = catchAsync(async (req, res) => {
    try {
      // Validar dados básicos primeiro
      const validatedData = RaffleValidator.validateCreate(req.body);

      let uploadInfo = null;

      // Processar imagem se foi enviada
      if (req.file) {
        try {
          const fileInfo = {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            originalName: req.file.originalname,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            url: `/uploads/raffles/${req.file.filename}`,
            uploadedBy: req.user.id,
            description: `Imagem da rifa: ${validatedData.title}`,
            category: 'raffle_images',
            createdAt: new Date().toISOString()
          };

          uploadInfo = dataManager.createUpload(fileInfo);

          // Adicionar a imagem às imagens da campanha
          if (!validatedData.campaignImages) {
            validatedData.campaignImages = [];
          }
          validatedData.campaignImages.unshift(uploadInfo.url);

          logger.info(`Imagem da rifa enviada por ${req.user.email}: ${req.file.filename} (${req.file.size} bytes)`);
        } catch (error) {
          logger.error('Erro ao processar upload da imagem:', error);
          
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          
          return ResponseFormatter.error(res, 'Erro ao processar upload da imagem');
        }
      }

      // Criar a rifa
      const newRaffle = {
        id: `raffle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...validatedData,
        owner: req.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const createdRaffle = dataManager.createRaffle(newRaffle);

      logger.info(`Nova rifa criada com imagem: ${createdRaffle.id} por usuário ${req.user.id}`);

      const response = {
        raffle: createdRaffle,
        image: uploadInfo ? {
          id: uploadInfo.id,
          url: uploadInfo.url,
          filename: uploadInfo.filename,
          size: uploadInfo.size,
          originalName: uploadInfo.originalName
        } : null
      };

      return ResponseFormatter.created(res, response, 'Rifa criada com sucesso');

    } catch (error) {
      logger.error('Erro ao criar rifa:', error);
      
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      if (uploadInfo?.id) {
        dataManager.deleteUpload(uploadInfo.id);
      }

      if (error.message.startsWith('[') || error.message.startsWith('{')) {
        const validationErrors = JSON.parse(error.message);
        return ResponseFormatter.badRequest(res, 'Dados inválidos', validationErrors);
      }
      
      return ResponseFormatter.error(res, 'Erro interno ao criar rifa');
    }
  });

  // Endpoint para obter categorias disponíveis
  getCategories = catchAsync(async (req, res) => {
    return ResponseFormatter.success(res, RAFFLE_CATEGORIES, 'Categorias obtidas com sucesso');
  });

  // Endpoint para obter tipos de sorteio disponíveis
  getDrawTypes = catchAsync(async (req, res) => {
    const drawTypes = {
      [DRAW_TYPES.SORTEADOR_COM_BR]: {
        id: DRAW_TYPES.SORTEADOR_COM_BR,
        name: 'Sorteador.com.br',
        description: 'Sorteio através da plataforma Sorteador.com.br'
      },
      [DRAW_TYPES.LOTERIA_FEDERAL]: {
        id: DRAW_TYPES.LOTERIA_FEDERAL,
        name: 'Loteria Federal',
        description: 'Sorteio baseado na Loteria Federal'
      },
      [DRAW_TYPES.ORGANIZADOR]: {
        id: DRAW_TYPES.ORGANIZADOR,
        name: 'Diretamente com o organizador',
        description: 'Sorteio realizado diretamente pelo organizador'
      },
      [DRAW_TYPES.SORTEADOR_RIFAUP]: {
        id: DRAW_TYPES.SORTEADOR_RIFAUP,
        name: 'Sorteador Rifaup',
        description: 'Sorteio através do sistema interno Rifaup'
      }
    };

    return ResponseFormatter.success(res, drawTypes, 'Tipos de sorteio obtidos com sucesso');
  });

  // Endpoint para calcular taxa da plataforma
  calculateFee = catchAsync(async (req, res) => {
    const { totalTickets, ticketPrice } = req.query;
    
    if (!totalTickets || !ticketPrice) {
      return ResponseFormatter.badRequest(res, 'totalTickets e ticketPrice são obrigatórios');
    }

    const totalValue = parseFloat(totalTickets) * parseFloat(ticketPrice);
    const platformFee = dataManager.calculatePlatformFee(totalValue);
    const estimatedRevenue = totalValue - platformFee;

    return ResponseFormatter.success(res, {
      totalValue,
      platformFee,
      estimatedRevenue,
      feePercentage: ((platformFee / totalValue) * 100).toFixed(2)
    }, 'Taxa calculada com sucesso');
  });

  // Métodos temporários (implementar depois)
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

  // Método auxiliar para calcular estatísticas
  calculateRaffleStats(raffleId) {
    try {
      const tickets = dataManager.getTickets().filter(ticket => ticket.raffle === raffleId);
      const paidTickets = tickets.filter(ticket => ticket.paymentStatus === 'paid');
      
      const soldTickets = paidTickets.reduce((total, ticket) => total + (ticket.quantity || 0), 0);
      const raffle = dataManager.getRaffleById(raffleId);
      const totalTickets = raffle ? raffle.totalTickets : 0;
      const availableTickets = totalTickets - soldTickets;
      const progress = totalTickets > 0 ? (soldTickets / totalTickets) * 100 : 0;
      const revenue = paidTickets.reduce((total, ticket) => total + (ticket.totalAmount || 0), 0);

      return {
        soldTickets,
        availableTickets,
        progress: Math.round(progress * 100) / 100,
        revenue
      };
    } catch (error) {
      logger.error('Erro ao calcular estatísticas da rifa:', error);
      return {
        soldTickets: 0,
        availableTickets: 0,
        progress: 0,
        revenue: 0
      };
    }
  }
}

module.exports = new RaffleController();