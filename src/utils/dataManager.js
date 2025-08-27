// filepath: src/utils/dataManager.js
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class DataManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.initializeDataFiles();
  }

  initializeDataFiles() {
    const files = {
      'users.json': { users: [] },
      'raffles.json': { raffles: [] },
      'tickets.json': { tickets: [] },
      'payments.json': { payments: [] },
      'settings.json': {
        settings: {
          platform: {
            name: "Ouro Rifa",
            version: "1.0.0",
            maintenanceMode: false,
            defaultCommission: 10,
            maxFileSize: 5242880,
            allowedImageTypes: ["jpg", "jpeg", "png", "webp"]
          },
          notifications: {
            emailEnabled: true,
            smsEnabled: true,
            pushEnabled: true
          },
          payment: {
            pixEnabled: true,
            creditCardEnabled: false,
            bankTransferEnabled: true,
            autoApprove: false
          }
        }
      },
      'uploads.json': { uploads: [] },
    };

    // Criar diretório se não existir
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    Object.entries(files).forEach(([filename, defaultData]) => {
      const filePath = path.join(this.dataDir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      }
    });
  }

  readData(filename) {
    try {
      const filePath = path.join(this.dataDir, filename);
      
      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        console.warn(`Arquivo ${filename} não encontrado. Criando novo...`);
        const defaultData = this.getDefaultData(filename);
        this.writeData(filename, defaultData);
        return defaultData;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      
      // Verificar se arquivo não está vazio
      if (!data.trim()) {
        console.warn(`Arquivo ${filename} está vazio. Recriando...`);
        const defaultData = this.getDefaultData(filename);
        this.writeData(filename, defaultData);
        return defaultData;
      }

      return JSON.parse(data);
    } catch (error) {
      console.error(`Erro ao ler ${filename}:`, error.message);
      
      // Tentar recuperar criando arquivo novo
      const defaultData = this.getDefaultData(filename);
      this.writeData(filename, defaultData);
      return defaultData;
    }
  }

  getDefaultData(filename) {
    const defaults = {
      'users.json': { users: [] },
      'raffles.json': { raffles: [] },
      'tickets.json': { tickets: [] },
      'payments.json': { payments: [] },
      'settings.json': {
        settings: {
          platform: {
            name: "Ouro Rifa",
            version: "1.0.0",
            maintenanceMode: false,
            defaultCommission: 10,
            maxFileSize: 5242880,
            allowedImageTypes: ["jpg", "jpeg", "png", "webp"]
          },
          notifications: {
            emailEnabled: true,
            smsEnabled: true,
            pushEnabled: true
          },
          payment: {
            pixEnabled: true,
            creditCardEnabled: false,
            bankTransferEnabled: true,
            autoApprove: false
          }
        }
      },
      'uploads.json': { uploads: [] },
    };

    return defaults[filename] || {};
  }

  writeData(filename, data) {
    try {
      const filePath = path.join(this.dataDir, filename);
      
      // Fazer backup antes de escrever
      if (fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Erro ao escrever ${filename}:`, error.message);
      return false;
    }
  }

  // CRUD para usuários
  getUsers() {
    const data = this.readData('users.json');
    return data ? data.users : [];
  }

  getUserById(id) {
    const users = this.getUsers();
    return users.find(user => user.id === id);
  }

  getUserByEmail(email) {
    const users = this.getUsers();
    return users.find(user => user.email === email);
  }

  createUser(userData) {
    try {
      const data = this.readData('users.json');
      if (!data.users) {
        data.users = [];
      }
      
      data.users.push(userData);
      this.writeData('users.json', data);
      return userData;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  updateUser(id, updateData) {
    try {
      const data = this.readData('users.json');
      const userIndex = data.users.findIndex(user => user.id === id);
      
      if (userIndex === -1) {
        throw new Error('Usuário não encontrado');
      }

      data.users[userIndex] = { ...data.users[userIndex], ...updateData };
      this.writeData('users.json', data);
      return data.users[userIndex];
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  deleteUser(id) {
    try {
      const data = this.readData('users.json');
      const userIndex = data.users.findIndex(user => user.id === id);
      
      if (userIndex !== -1) {
        data.users.splice(userIndex, 1);
        this.writeData('users.json', data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error;
    }
  }

  // CRUD para rifas
  getRaffles() {
    try {
      const data = this.readData('raffles.json');
      return data ? data.raffles : [];
    } catch (error) {
      console.error('Erro ao ler raffles:', error);
      return [];
    }
  }

  getRaffleById(id) {
    try {
      const raffles = this.getRaffles();
      return raffles.find(raffle => raffle.id === id);
    } catch (error) {
      console.error('Erro ao buscar raffle por ID:', error);
      return null;
    }
  }

  createRaffle(raffleData) {
    try {
      const data = this.readData('raffles.json');
      if (!data.raffles) {
        data.raffles = [];
      }
      data.raffles.push(raffleData);
      this.writeData('raffles.json', data);
      return raffleData;
    } catch (error) {
      console.error('Erro ao criar raffle:', error);
      throw error;
    }
  }

  updateRaffle(id, raffleData) {
    try {
      const data = this.readData('raffles.json');
      const raffleIndex = data.raffles.findIndex(raffle => raffle.id === id);
      if (raffleIndex !== -1) {
        data.raffles[raffleIndex] = { ...data.raffles[raffleIndex], ...raffleData };
        this.writeData('raffles.json', data);
        return data.raffles[raffleIndex];
      }
      return null;
    } catch (error) {
      console.error('Erro ao atualizar raffle:', error);
      throw error;
    }
  }

  deleteRaffle(id) {
    try {
      const data = this.readData('raffles.json');
      const raffleIndex = data.raffles.findIndex(raffle => raffle.id === id);
      if (raffleIndex !== -1) {
        data.raffles.splice(raffleIndex, 1);
        this.writeData('raffles.json', data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao deletar raffle:', error);
      throw error;
    }
  }

  // CRUD para tickets
  getTickets() {
    try {
      const data = this.readData('tickets.json');
      return data ? data.tickets : [];
    } catch (error) {
      console.error('Erro ao ler tickets:', error);
      return [];
    }
  }

  getTicketById(id) {
    const tickets = this.getTickets();
    return tickets.find(ticket => ticket.id === id);
  }

  getTicketsByUser(userId) {
    const tickets = this.getTickets();
    return tickets.filter(ticket => ticket.user === userId);
  }

  getTicketsByRaffle(raffleId) {
    const tickets = this.getTickets();
    return tickets.filter(ticket => ticket.raffle === raffleId);
  }

  createTicket(ticketData) {
    const tickets = this.getTickets();
    const newTicket = {
      id: `ticket_${uuidv4()}`,
      ...ticketData,
      isWinner: false,
      createdAt: new Date().toISOString()
    };
    tickets.push(newTicket);
    this.writeData('tickets.json', { tickets });
    return newTicket;
  }

  updateTicket(id, ticketData) {
    const data = this.readData('tickets.json');
    const ticketIndex = data.tickets.findIndex(ticket => ticket.id === id);
    if (ticketIndex !== -1) {
      data.tickets[ticketIndex] = { ...data.tickets[ticketIndex], ...ticketData };
      this.writeData('tickets.json', data);
      return data.tickets[ticketIndex];
    }
    return null;
  }

  // CRUD para pagamentos
  getPayments() {
    const data = this.readData('payments.json');
    return data ? data.payments : [];
  }

  getPaymentById(id) {
    const payments = this.getPayments();
    return payments.find(payment => payment.id === id);
  }

  createPayment(paymentData) {
    const payments = this.getPayments();
    const newPayment = {
      id: `payment_${uuidv4()}`,
      ...paymentData,
      createdAt: new Date().toISOString()
    };
    payments.push(newPayment);
    this.writeData('payments.json', { payments });
    return newPayment;
  }

  updatePayment(id, paymentData) {
    const data = this.readData('payments.json');
    const paymentIndex = data.payments.findIndex(payment => payment.id === id);
    if (paymentIndex !== -1) {
      data.payments[paymentIndex] = { ...data.payments[paymentIndex], ...paymentData };
      this.writeData('payments.json', data);
      return data.payments[paymentIndex];
    }
    return null;
  }

  // Configurações
  getSettings() {
    const data = this.readData('settings.json');
    return data ? data.settings : null;
  }

  updateSettings(newSettings) {
    const data = this.readData('settings.json');
    data.settings = { ...data.settings, ...newSettings };
    this.writeData('settings.json', data);
    return data.settings;
  }

  // CRUD para uploads
  getUploads() {
    try {
      const data = this.readData('uploads.json');
      return data ? data.uploads : [];
    } catch (error) {
      console.error('Erro ao ler uploads:', error);
      return [];
    }
  }

  getUploadById(id) {
    const uploads = this.getUploads();
    return uploads.find(upload => upload.id === id);
  }

  createUpload(uploadData) {
    try {
      const data = this.readData('uploads.json');
      if (!data.uploads) {
        data.uploads = [];
      }
      
      data.uploads.push(uploadData);
      this.writeData('uploads.json', data);
      return uploadData;
    } catch (error) {
      console.error('Erro ao criar upload:', error);
      throw error;
    }
  }

  updateUpload(id, uploadData) {
    try {
      const data = this.readData('uploads.json');
      const uploadIndex = data.uploads.findIndex(upload => upload.id === id);
      if (uploadIndex !== -1) {
        data.uploads[uploadIndex] = { ...data.uploads[uploadIndex], ...uploadData };
        this.writeData('uploads.json', data);
        return data.uploads[uploadIndex];
      }
      return null;
    } catch (error) {
      console.error('Erro ao atualizar upload:', error);
      throw error;
    }
  }

  deleteUpload(id) {
    try {
      const data = this.readData('uploads.json');
      const uploadIndex = data.uploads.findIndex(upload => upload.id === id);
      
      if (uploadIndex !== -1) {
        data.uploads.splice(uploadIndex, 1);
        this.writeData('uploads.json', data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao deletar upload:', error);
      throw error;
    }
  }

  getUploadsByUser(userId) {
    const uploads = this.getUploads();
    return uploads.filter(upload => upload.uploadedBy === userId);
  }

  getUploadsByCategory(category) {
    const uploads = this.getUploads();
    return uploads.filter(upload => upload.category === category);
  }
}

module.exports = new DataManager();