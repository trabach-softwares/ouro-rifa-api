const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dataManager = require('../utils/dataManager');
const ResponseFormatter = require('../utils/responseFormatter');
const { DEFAULT_PAGINATION, ERROR_MESSAGES } = require('../config/constants');
const { logger } = require('../utils/logger');
const { catchAsync } = require('../middleware/errorHandler');

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
    const {
      title,
      description,
      ticketPrice,
      totalTickets,
      endDate,
      settings = {}
    } = req.body;

    // Validações básicas
    if (!title || !description || !ticketPrice || !totalTickets || !endDate) {
      return ResponseFormatter.badRequest(res, 'Campos obrigatórios: title, description, ticketPrice, totalTickets, endDate');
    }

    if (ticketPrice <= 0 || totalTickets <= 0) {
      return ResponseFormatter.badRequest(res, 'Preço do ticket e total de tickets devem ser maiores que zero');
    }

    if (new Date(endDate) <= new Date()) {
      return ResponseFormatter.badRequest(res, 'Data de encerramento deve ser no futuro');
    }

    const newRaffle = {
      id: `raffle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      ticketPrice: parseFloat(ticketPrice),
      totalTickets: parseInt(totalTickets),
      soldTickets: 0,
      endDate: new Date(endDate).toISOString(),
      image: null,
      status: 'pending',
      owner: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        maxTicketsPerPerson: settings.maxTicketsPerPerson || 10,
        allowComments: settings.allowComments !== false,
        autoApprovePayments: settings.autoApprovePayments === true,
        ...settings
      }
    };

    dataManager.createRaffle(newRaffle);

    logger.info(`Nova rifa criada: ${newRaffle.id} por usuário ${req.user.id}`);

    return ResponseFormatter.created(res, newRaffle, 'Rifa criada com sucesso');
  });

  // Criar rifa com imagem
  createRaffleWithImage = catchAsync(async (req, res) => {
    const {
      title,
      description,
      ticketPrice,
      totalTickets,
      endDate,
      settings = {}
    } = req.body;

    // Validações básicas
    if (!title || !description || !ticketPrice || !totalTickets || !endDate) {
      // Se há erro e foi enviado arquivo, remover o arquivo
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return ResponseFormatter.badRequest(res, 'Campos obrigatórios: title, description, ticketPrice, totalTickets, endDate');
    }

    if (ticketPrice <= 0 || totalTickets <= 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return ResponseFormatter.badRequest(res, 'Preço do ticket e total de tickets devem ser maiores que zero');
    }

    if (new Date(endDate) <= new Date()) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return ResponseFormatter.badRequest(res, 'Data de encerramento deve ser no futuro');
    }

    let uploadInfo = null;

    // Processar imagem se foi enviada
    if (req.file) {
      try {
        // Salvar informações do upload no dataManager
        const fileInfo = {
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          originalName: req.file.originalname,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
          url: `/uploads/raffles/${req.file.filename}`,
          uploadedBy: req.user.id,
          description: `Imagem da rifa: ${title}`,
          category: 'raffle_images',
          createdAt: new Date().toISOString()
        };

        uploadInfo = dataManager.createUpload(fileInfo);

        logger.info(`Imagem da rifa enviada por ${req.user.email}: ${req.file.filename} (${req.file.size} bytes)`);
      } catch (error) {
        logger.error('Erro ao processar upload da imagem:', error);
        
        // Remover arquivo em caso de erro
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return ResponseFormatter.error(res, 'Erro ao processar upload da imagem');
      }
    }

    // Criar a rifa
    try {
      const newRaffle = {
        id: `raffle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description,
        ticketPrice: parseFloat(ticketPrice),
        totalTickets: parseInt(totalTickets),
        soldTickets: 0,
        endDate: new Date(endDate).toISOString(),
        imageId: uploadInfo?.id || null, // Referência ao upload
        status: 'pending',
        owner: req.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
          maxTicketsPerPerson: parseInt(settings.maxTicketsPerPerson) || 10,
          allowComments: settings.allowComments !== 'false',
          autoApprovePayments: settings.autoApprovePayments === 'true',
          ...settings
        }
      };

      dataManager.createRaffle(newRaffle);

      logger.info(`Nova rifa criada com imagem: ${newRaffle.id} por usuário ${req.user.id}`);

      // Preparar resposta com informações completas
      const response = {
        raffle: newRaffle,
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
      
      // Se erro na criação da rifa, remover arquivo e upload do banco
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      if (uploadInfo?.id) {
        dataManager.deleteUpload(uploadInfo.id);
      }
      
      return ResponseFormatter.error(res, 'Erro interno ao criar rifa');
    }
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