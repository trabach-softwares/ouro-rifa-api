const { ERROR_MESSAGES } = require('../config/constants');

class BaseService {
  constructor(dataManager, entityName) {
    this.dataManager = dataManager;
    this.entityName = entityName;
  }

  async findAll() {
    return this.dataManager[`get${this.entityName.charAt(0).toUpperCase()}${this.entityName.slice(1)}`]();
  }

  async findById(id) {
    const entity = this.dataManager[`get${this.entityName.charAt(0).toUpperCase()}${this.entityName.slice(1)}ById`](id);
    if (!entity) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND || 'Recurso não encontrado');
    }
    return entity;
  }

  async create(data) {
    return this.dataManager[`create${this.entityName.charAt(0).toUpperCase()}${this.entityName.slice(1)}`](data);
  }

  async update(id, data) {
    return this.dataManager[`update${this.entityName.charAt(0).toUpperCase()}${this.entityName.slice(1)}`](id, data);
  }

  async delete(id) {
    return this.dataManager[`delete${this.entityName.charAt(0).toUpperCase()}${this.entityName.slice(1)}`](id);
  }

  async exists(id) {
    const entity = this.dataManager[`get${this.entityName.charAt(0).toUpperCase()}${this.entityName.slice(1)}ById`](id);
    return !!entity;
  }
}

module.exports = BaseService;