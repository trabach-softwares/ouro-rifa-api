const BaseRepository = require('./baseRepository');

class UserRepository extends BaseRepository {
  constructor(dataManager) {
    super(dataManager, 'users', 'user');
  }

  findAll() {
    return this.dataManager.getUsers();
  }

  findById(id) {
    return this.dataManager.getUserById(id);
  }

  findByEmail(email) {
    return this.dataManager.getUserByEmail(email);
  }

  create(userData) {
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...userData,
      registeredAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true,
      totalPurchases: 0
    };
    
    return this.dataManager.createUser(newUser);
  }

  update(id, updateData) {
    return this.dataManager.updateUser(id, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
  }

  updateLastLogin(id) {
    return this.dataManager.updateUser(id, { 
      lastLogin: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  delete(id) {
    return this.dataManager.deleteUser(id);
  }

  findActive() {
    return this.dataManager.getUsers().filter(user => user.isActive);
  }

  findByRole(role) {
    return this.dataManager.getUsers().filter(user => user.role === role);
  }

  exists(id) {
    return !!this.dataManager.getUserById(id);
  }
}

module.exports = UserRepository;