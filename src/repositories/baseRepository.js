const { v4: uuidv4 } = require('uuid');

class BaseRepository {
  constructor(dataManager, dataKey, itemType) {
    this.dataManager = dataManager;
    this.dataKey = dataKey; // 'tickets', 'raffles', etc.
    this.itemType = itemType; // 'ticket', 'raffle', etc.
  }

  findAll() {
    return this.dataManager.getData(this.dataKey) || [];
  }

  findById(id) {
    const items = this.findAll();
    return items.find(item => item.id === id);
  }

  findBy(criteria) {
    const items = this.findAll();
    return items.filter(item => {
      return Object.keys(criteria).every(key => {
        return item[key] === criteria[key];
      });
    });
  }

  create(itemData) {
    const items = this.findAll();
    const newItem = {
      id: itemData.id || `${this.itemType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...itemData,
      createdAt: itemData.createdAt || new Date().toISOString()
    };
    
    items.push(newItem);
    this.dataManager.saveData(this.dataKey, items);
    return newItem;
  }

  update(id, updateData) {
    const items = this.findAll();
    const itemIndex = items.findIndex(item => item.id === id);
    
    if (itemIndex !== -1) {
      items[itemIndex] = { 
        ...items[itemIndex], 
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      this.dataManager.saveData(this.dataKey, items);
      return items[itemIndex];
    }
    return null;
  }

  delete(id) {
    const items = this.findAll();
    const itemIndex = items.findIndex(item => item.id === id);
    
    if (itemIndex !== -1) {
      items.splice(itemIndex, 1);
      this.dataManager.saveData(this.dataKey, items);
      return true;
    }
    return false;
  }
}

module.exports = BaseRepository;