const crypto = require('crypto');

class Helpers {
  // Gerar números de tickets únicos
  generateTicketNumbers(quantity, totalTickets) {
    const numbers = [];
    const usedNumbers = new Set();
    
    while (numbers.length < quantity) {
      const num = Math.floor(Math.random() * totalTickets) + 1;
      const formattedNum = num.toString().padStart(4, '0');
      
      if (!usedNumbers.has(formattedNum)) {
        usedNumbers.add(formattedNum);
        numbers.push(formattedNum);
      }
    }
    
    return numbers.sort();
  }

  // Verificar números disponíveis
  getAvailableTicketNumbers(raffleId, totalTickets, dataManager) {
    const allTickets = dataManager.getTicketsByRaffle(raffleId);
    const usedNumbers = new Set();
    
    allTickets.forEach(ticket => {
      if (ticket.paymentStatus === 'paid') {
        ticket.ticketNumbers.forEach(num => usedNumbers.add(num));
      }
    });

    const available = [];
    for (let i = 1; i <= totalTickets; i++) {
      const formattedNum = i.toString().padStart(4, '0');
      if (!usedNumbers.has(formattedNum)) {
        available.push(formattedNum);
      }
    }
    
    return available;
  }

  // Realizar sorteio
  drawWinner(raffleId, dataManager) {
    const tickets = dataManager.getTicketsByRaffle(raffleId);
    const paidTickets = tickets.filter(ticket => ticket.paymentStatus === 'paid');
    
    if (paidTickets.length === 0) {
      throw new Error('Não há tickets pagos para o sorteio');
    }

    const allTicketNumbers = [];
    paidTickets.forEach(ticket => {
      ticket.ticketNumbers.forEach(number => {
        allTicketNumbers.push({
          number,
          ticketId: ticket.id,
          userId: ticket.user
        });
      });
    });

    const randomIndex = Math.floor(Math.random() * allTicketNumbers.length);
    const winnerTicket = allTicketNumbers[randomIndex];

    return {
      winnerTicketNumber: winnerTicket.number,
      winnerTicketId: winnerTicket.ticketId,
      winnerUserId: winnerTicket.userId
    };
  }

  // Validar formato de email
  isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // Validar formato de telefone brasileiro
  isValidPhone(phone) {
    const regex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
    return regex.test(phone);
  }

  // Gerar ID único
  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}${timestamp}${random}`;
  }

  // Formatar valor para moeda brasileira
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  // Calcular estatísticas de rifa
  calculateRaffleStats(raffle, tickets) {
    const paidTickets = tickets.filter(t => t.paymentStatus === 'paid');
    const soldTicketsCount = paidTickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
    const revenue = paidTickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);
    
    return {
      soldTickets: soldTicketsCount,
      availableTickets: raffle.totalTickets - soldTicketsCount,
      revenue,
      completionPercentage: (soldTicketsCount / raffle.totalTickets) * 100
    };
  }
}

module.exports = new Helpers();