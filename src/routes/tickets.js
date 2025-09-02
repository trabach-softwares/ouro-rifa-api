const express = require('express');
const ticketController = require('../controllers/ticketController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticação para todas as rotas de tickets
router.use(auth);

// Rotas principais
router.get('/', ticketController.getTickets);
router.get('/sales/list', ticketController.getSalesTickets);  // ✅ Tela de vendas

// ✅ Rotas específicas que devem vir ANTES das rotas genéricas
router.get('/raffle/:raffleId', ticketController.getTicketsByRaffle);  // 🆕 Tickets por rifa
router.get('/raffle/:raffleId/stats', ticketController.getTicketStats);  // 🆕 Estatísticas por rifa

// Rotas específicas por ID (devem vir por último)
router.get('/:id', ticketController.getTicketById);
router.post('/', ticketController.buyTickets);
router.put('/:id/cancel', ticketController.cancelTicket);

module.exports = router;