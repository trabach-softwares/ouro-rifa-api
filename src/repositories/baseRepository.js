const { v4: uuidv4 } = require('uuid');

class BaseRepository {
  constructor(dataManager, entityName, idPrefix) {
    this.dataManager = dataManager;
    this.entityName = entityName;
    this.idPrefix = idPrefix;
  }

  generateId() {
    return `${this.idPrefix}_${uuidv4()}`;
  }

  findAll() {
    const data = this.dataManager.readData(`${this.entityName}.json`);
    return data[this.entityName] || [];
  }

  findById(id) {
    const entities = this.findAll();
    return entities.find(entity => entity.id === id);
  }

  create(entityData) {
    const entities = this.findAll();
    const newEntity = {
      id: this.generateId(),
      ...entityData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    entities.push(newEntity);
    this.dataManager.writeData(`${this.entityName}.json`, { [this.entityName]: entities });
    return newEntity;
  }

  update(id, updateData) {
    const data = this.dataManager.readData(`${this.entityName}.json`);
    const entities = data[this.entityName] || [];
    const entityIndex = entities.findIndex(entity => entity.id === id);
    
    if (entityIndex === -1) {
      return null;
    }

    entities[entityIndex] = {
      ...entities[entityIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.dataManager.writeData(`${this.entityName}.json`, { [this.entityName]: entities });
    return entities[entityIndex];
  }

  delete(id) {
    const data = this.dataManager.readData(`${this.entityName}.json`);
    const entities = data[this.entityName] || [];
    const entityIndex = entities.findIndex(entity => entity.id === id);
    
    if (entityIndex === -1) {
      return false;
    }

    entities.splice(entityIndex, 1);
    this.dataManager.writeData(`${this.entityName}.json`, { [this.entityName]: entities });
    return true;
  }

  findBy(criteria) {
    const entities = this.findAll();
    return entities.filter(entity => {
      return Object.keys(criteria).every(key => entity[key] === criteria[key]);
    });
  }

  findOneBy(criteria) {
    const entities = this.findAll();
    return entities.find(entity => {
      return Object.keys(criteria).every(key => entity[key] === criteria[key]);
    });
  }

  count() {
    return this.findAll().length;
  }

  exists(id) {
    return this.findById(id) !== undefined;
  }
}

module.exports = BaseRepository;