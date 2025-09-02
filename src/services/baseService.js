const { ERROR_MESSAGES } = require('../config/constants');

class BaseService {
  constructor(dataManager, entityName) {
    this.dataManager = dataManager;
    this.entityName = entityName;
    // Não inicializar repository aqui, deixar para as classes filhas
  }

  async findAll() {
    if (!this.dataManager) {
      throw new Error('DataManager não inicializado');
    }
    
    const methodName = `get${this.entityName.charAt(0).toUpperCase()}${this.entityName.slice(1)}s`;
    
    if (typeof this.dataManager[methodName] === 'function') {
      return this.dataManager[methodName]();
    }
    
    // Fallback para métodos genéricos
    return this.dataManager.getData(this.entityName + 's');
  }

  async findById(id) {
    if (!this.repository) {
      throw new Error('Repository não inicializado na classe filha');
    }
    
    const entity = this.repository.findById(id);
    if (!entity) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND || `${this.entityName} não encontrado`);
    }
    return entity;
  }

  async create(data) {
    if (!this.repository) {
      throw new Error('Repository não inicializado na classe filha');
    }
    
    return this.repository.create(data);
  }

  async update(id, data) {
    if (!this.repository) {
      throw new Error('Repository não inicializado na classe filha');
    }
    
    return this.repository.update(id, data);
  }

  async delete(id) {
    if (!this.repository) {
      throw new Error('Repository não inicializado na classe filha');
    }
    
    return this.repository.delete(id);
  }

  async exists(id) {
    try {
      await this.findById(id);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = BaseService;