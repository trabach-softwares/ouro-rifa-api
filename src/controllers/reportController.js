const dataManager = require('../utils/dataManager');
const { DEFAULT_PAGINATION } = require('../config/constants');
const { logger } = require('../utils/logger');

// Função auxiliar para criar respostas de erro seguras
const createErrorResponse = (res, message, statusCode = 500) => {
  logger.error(`Controller Error: ${message}`);
  return res.status(statusCode).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

// Função auxiliar para criar respostas de sucesso
const createSuccessResponse = (res, data, message = 'Sucesso') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

class ReportController {
  // Dashboard - adaptado conforme o usuário
  async getDashboard(req, res) {
    try {
      // Verificar se o usuário existe e tem role definido
      if (!req.user || typeof req.user.role === 'undefined') {
        logger.warn('Tentativa de acesso ao dashboard sem usuário válido ou role indefinido');
        return createErrorResponse(res, 'Usuário não autorizado', 401);
      }

      let raffles, tickets, payments;
      
      if (req.user.role === 'super_admin') {
        // Super admin vê todos os dados
        raffles = dataManager.getRaffles();
        tickets = dataManager.getTickets();
        payments = dataManager.getPayments();
      } else {
        // Usuários normais veem apenas seus dados
        raffles = dataManager.getRaffles().filter(r => r.owner === req.user.id);
        tickets = dataManager.getTickets().filter(ticket => 
          raffles.some(raffle => raffle.id === ticket.raffle)
        );
        payments = dataManager.getPayments().filter(payment => 
          raffles.some(raffle => raffle.id === payment.raffle)
        );
      }

      const users = req.user.role === 'super_admin' ? dataManager.getUsers() : [];

      // Estatísticas gerais
      const totalRaffles = raffles.length;
      const activeRaffles = raffles.filter(r => r.status === 'active').length;
      const completedRaffles = raffles.filter(r => r.status === 'completed').length;
      
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.isActive).length;
      
      const paidTickets = tickets.filter(t => t.paymentStatus === 'paid');
      const totalTicketsSold = paidTickets.reduce((sum, ticket) => sum + (ticket.quantity || 0), 0);
      
      const completedPayments = payments.filter(p => p.status === 'completed');
      const totalRevenue = completedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

      // Vendas dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentPayments = completedPayments.filter(p => 
        p.processedAt && new Date(p.processedAt) >= sevenDaysAgo
      );
      const weeklyRevenue = recentPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

      // Top 5 rifas por receita
      const raffleRevenue = raffles.map(raffle => {
        const rafflePayments = completedPayments.filter(p => p.raffle === raffle.id);
        const revenue = rafflePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        return {
          id: raffle.id,
          title: raffle.title,
          revenue,
          soldTickets: raffle.soldTickets || 0,
          totalTickets: raffle.totalTickets || 0,
          completionRate: raffle.totalTickets > 0 ? ((raffle.soldTickets || 0) / raffle.totalTickets) * 100 : 0
        };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      // Vendas por dia (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dailySales = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        dailySales[dateStr] = 0;
      }

      completedPayments
        .filter(p => p.processedAt && new Date(p.processedAt) >= thirtyDaysAgo)
        .forEach(payment => {
          const dateStr = payment.processedAt.split('T')[0];
          if (dailySales[dateStr] !== undefined) {
            dailySales[dateStr] += payment.amount || 0;
          }
        });

      const salesChart = Object.entries(dailySales).map(([date, amount]) => ({
        date,
        amount
      }));

      const dashboardData = {
        summary: {
          totalRaffles,
          activeRaffles,
          completedRaffles,
          totalTicketsSold,
          totalRevenue,
          weeklyRevenue
        },
        topRaffles: raffleRevenue,
        salesChart
      };

      // Adicionar dados de usuários apenas para super admin
      if (req.user.role === 'super_admin') {
        dashboardData.summary.totalUsers = totalUsers;
        dashboardData.summary.activeUsers = activeUsers;
      }

      return createSuccessResponse(res, dashboardData, 'Dashboard gerado com sucesso');
    } catch (error) {
      logger.error('Erro ao gerar dashboard:', error);
      return createErrorResponse(res, 'Erro interno do servidor ao gerar dashboard');
    }
  }

  // Relatório de vendas
  async getSalesReport(req, res) {
    try {
      if (!req.user) {
        return createErrorResponse(res, 'Usuário não autorizado', 401);
      }

      const { 
        startDate, 
        endDate, 
        raffleId, 
        status = 'completed',
        page = 1, 
        limit = 20,
        sortBy = 'processedAt',
        sortOrder = 'desc'
      } = req.query;
      
      let payments = dataManager.getPayments();
      
      // Filtrar por status
      if (status !== 'all') {
        payments = payments.filter(p => p.status === status);
      }
      
      // Se não for super admin, filtrar apenas dados do usuário
      if (req.user.role !== 'super_admin') {
        const userRaffles = dataManager.getRaffles().filter(r => r.owner === req.user.id);
        payments = payments.filter(p => userRaffles.some(raffle => raffle.id === p.raffle));
      }
      
      // Filtrar por data
      if (startDate) {
        payments = payments.filter(p => {
          const paymentDate = p.processedAt || p.createdAt;
          return paymentDate && new Date(paymentDate) >= new Date(startDate);
        });
      }
      if (endDate) {
        payments = payments.filter(p => {
          const paymentDate = p.processedAt || p.createdAt;
          return paymentDate && new Date(paymentDate) <= new Date(endDate);
        });
      }
      
      // Filtrar por rifa
      if (raffleId) {
        payments = payments.filter(p => p.raffle === raffleId);
      }

      // Buscar informações adicionais
      const detailedPayments = payments.map(payment => {
        const raffle = dataManager.getRaffleById(payment.raffle);
        const user = dataManager.getUserById(payment.user);
        const ticket = dataManager.getTicketById(payment.ticket);
        
        return {
          id: payment.id,
          amount: payment.amount || 0,
          method: payment.method || 'unknown',
          status: payment.status,
          createdAt: payment.createdAt,
          processedAt: payment.processedAt,
          transactionId: payment.transactionId,
          raffle: raffle ? {
            id: raffle.id,
            title: raffle.title,
            category: raffle.category,
            ticketPrice: raffle.ticketPrice
          } : null,
          customer: user ? {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone
          } : null,
          ticket: ticket ? {
            id: ticket.id,
            quantity: ticket.quantity,
            ticketNumbers: ticket.ticketNumbers,
            totalAmount: ticket.totalAmount
          } : null
        };
      });

      // Ordenação
      detailedPayments.sort((a, b) => {
        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';
        
        if (sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });

      // Paginação
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedPayments = detailedPayments.slice(startIndex, endIndex);

      // Estatísticas do período
      const completedPayments = payments.filter(p => p.status === 'completed');
      const pendingPayments = payments.filter(p => p.status === 'pending');
      const failedPayments = payments.filter(p => p.status === 'failed');
      
      const totalSales = completedPayments.length;
      const totalRevenue = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const pendingRevenue = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const averageTicketValue = totalSales > 0 ? totalRevenue / totalSales : 0;
      
      // Vendas por método de pagamento
      const paymentMethods = completedPayments.reduce((acc, p) => {
        const method = p.method || 'unknown';
        acc[method] = {
          count: (acc[method]?.count || 0) + 1,
          revenue: (acc[method]?.revenue || 0) + (p.amount || 0)
        };
        return acc;
      }, {});

      // Vendas por rifa (top 10)
      const salesByRaffle = {};
      completedPayments.forEach(payment => {
        const raffleId = payment.raffle;
        const raffle = dataManager.getRaffleById(raffleId);
        
        if (raffle) {
          if (!salesByRaffle[raffleId]) {
            salesByRaffle[raffleId] = {
              id: raffle.id,
              title: raffle.title,
              count: 0,
              revenue: 0,
              tickets: 0
            };
          }
          
          salesByRaffle[raffleId].count += 1;
          salesByRaffle[raffleId].revenue += payment.amount || 0;
          
          const ticket = dataManager.getTicketById(payment.ticket);
          if (ticket) {
            salesByRaffle[raffleId].tickets += ticket.quantity || 0;
          }
        }
      });

      const topRaffles = Object.values(salesByRaffle)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Vendas por dia (últimos 30 dias para gráfico)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dailySales = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        dailySales[dateStr] = {
          date: dateStr,
          sales: 0,
          revenue: 0,
          tickets: 0
        };
      }

      completedPayments
        .filter(p => {
          const paymentDate = p.processedAt || p.createdAt;
          return paymentDate && new Date(paymentDate) >= thirtyDaysAgo;
        })
        .forEach(payment => {
          const paymentDate = payment.processedAt || payment.createdAt;
          const dateStr = paymentDate.split('T')[0];
          
          if (dailySales[dateStr]) {
            dailySales[dateStr].sales += 1;
            dailySales[dateStr].revenue += payment.amount || 0;
            
            const ticket = dataManager.getTicketById(payment.ticket);
            if (ticket) {
              dailySales[dateStr].tickets += ticket.quantity || 0;
            }
          }
        });

      const salesChart = Object.values(dailySales);

      // Clientes que mais compraram
      const customerStats = {};
      completedPayments.forEach(payment => {
        const userId = payment.user;
        const user = dataManager.getUserById(userId);
        
        if (user) {
          if (!customerStats[userId]) {
            customerStats[userId] = {
              id: user.id,
              name: user.name,
              email: user.email,
              purchases: 0,
              totalSpent: 0,
              tickets: 0
            };
          }
          
          customerStats[userId].purchases += 1;
          customerStats[userId].totalSpent += payment.amount || 0;
          
          const ticket = dataManager.getTicketById(payment.ticket);
          if (ticket) {
            customerStats[userId].tickets += ticket.quantity || 0;
          }
        }
      });

      const topCustomers = Object.values(customerStats)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      return createSuccessResponse(res, {
        summary: {
          totalSales,
          totalRevenue,
          pendingRevenue,
          averageTicketValue,
          pendingCount: pendingPayments.length,
          failedCount: failedPayments.length,
          conversionRate: payments.length > 0 ? (totalSales / payments.length) * 100 : 0
        },
        paymentMethods,
        topRaffles,
        topCustomers,
        salesChart,
        sales: paginatedPayments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(detailedPayments.length / parseInt(limit)),
          totalItems: detailedPayments.length,
          limit: parseInt(limit),
          hasNext: endIndex < detailedPayments.length,
          hasPrev: startIndex > 0
        }
      }, 'Relatório de vendas gerado com sucesso');
    } catch (error) {
      logger.error('Erro ao gerar relatório de vendas:', error);
      return createErrorResponse(res, 'Erro interno do servidor ao gerar relatório de vendas');
    }
  }

  // Relatório de receita
  async getRevenueReport(req, res) {
    try {
      // Implementação similar com tratamento de erro
      return createSuccessResponse(res, {}, 'Relatório de receita - a implementar');
    } catch (error) {
      logger.error('Erro ao gerar relatório de receita:', error);
      return createErrorResponse(res, 'Erro interno do servidor');
    }
  }

  // Dashboard do usuário (não-admin)
  async getMyDashboard(req, res) {
    try {
      // Redirecionar para getDashboard que já tem tratamento adequado
      return this.getDashboard(req, res);
    } catch (error) {
      logger.error('Erro ao gerar dashboard do usuário:', error);
      return createErrorResponse(res, 'Erro interno do servidor');
    }
  }

  // Relatório de vendas do usuário
  async getMySalesReport(req, res) {
    try {
      // Redirecionar para getSalesReport que já filtra por usuário
      return this.getSalesReport(req, res);
    } catch (error) {
      logger.error('Erro ao gerar relatório de vendas do usuário:', error);
      return createErrorResponse(res, 'Erro interno do servidor');
    }
  }

  // Relatório de receita do usuário
  async getMyRevenueReport(req, res) {
    try {
      return createSuccessResponse(res, {}, 'Relatório de receita do usuário - a implementar');
    } catch (error) {
      logger.error('Erro ao gerar relatório de receita do usuário:', error);
      return createErrorResponse(res, 'Erro interno do servidor');
    }
  }

  // Clientes do usuário
  async getMyCustomers(req, res) {
    try {
      return createSuccessResponse(res, {}, 'Relatório de clientes - a implementar');
    } catch (error) {
      logger.error('Erro ao gerar relatório de clientes:', error);
      return createErrorResponse(res, 'Erro interno do servidor');
    }
  }

  // Relatório de usuários (super admin)
  async getUsersReport(req, res) {
    try {
      return createSuccessResponse(res, {}, 'Relatório de usuários - a implementar');
    } catch (error) {
      logger.error('Erro ao gerar relatório de usuários:', error);
      return createErrorResponse(res, 'Erro interno do servidor');
    }
  }
}

module.exports = new ReportController();