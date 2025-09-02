const BaseRepository = require('./baseRepository');

class RaffleRepository extends BaseRepository {
  constructor(dataManager) {
    super(dataManager, 'raffles', 'raffle');
  }

  findByOwner(ownerId) {
    return this.findBy({ owner: ownerId });
  }

  findByStatus(status) {
    return this.findBy({ status: status });
  }

  findActiveRaffles() {
    return this.findByStatus('active');
  }
}

module.exports = RaffleRepository;