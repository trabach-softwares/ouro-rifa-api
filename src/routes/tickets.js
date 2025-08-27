const express = require('express');
const ticketController = require('../controllers/ticketController');

const router = express.Router();

router.get('/', ticketController.getTickets);
router.get('/:id', ticketController.getTicketById);
router.post('/', ticketController.buyTickets);
router.put('/:id/cancel', ticketController.cancelTicket);

module.exports = router;