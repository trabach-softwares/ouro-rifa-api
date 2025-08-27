const BaseRepository = require('./baseRepository');
const { RAFFLE_STATUS } = require('../config/constants');

class RaffleRepository extends BaseRepository {
  constructor(dataManager) {
    super(dataManager, 'raffles', 'raffle');
  }

  findByOwner(ownerId) {
    return this.findBy({ owner: ownerId });
  }

  findByStatus(status) {
    return this.findBy({ status });
  }

  findActive() {
    return this.findByStatus(RAFFLE_STATUS.ACTIVE);
  }

  findCompleted() {
    return this.findByStatus(RAFFLE_STATUS.COMPLETED);
  }

  create(raffleData) {
    const newRaffle = {
      ...raffleData,
      soldTickets: 0,
      availableTickets: raffleData.totalTickets,
      revenue: 0,
      winner: null,
      winnerTicket: null,
      drawDate: null
    };
    
    return super.create(newRaffle);
  }

  search(searchTerm) {
    const raffles = this.findAll();
    const term = searchTerm.toLowerCase();
    
    return raffles.filter(raffle => 
      raffle.title.toLowerCase().includes(term) ||
      raffle.description.toLowerCase().includes(term)
    );
  }
}

module.exports = RaffleRepository;