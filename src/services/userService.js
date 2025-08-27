const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserRepository = require('../repositories/userRepository');
const { ERROR_MESSAGES, SUCCESS_MESSAGES, VALIDATION_RULES } = require('../config/constants');
const { AppError } = require('../middleware/errorHandler');
const config = require('../config/environment');

class UserService {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.repository = new UserRepository(dataManager);
    this.loginAttempts = new Map(); // Cache em memória para tentativas de login
  }

  // Verificar e registrar tentativas de login
  checkLoginAttempts(email) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
    
    // Resetar contador se passou do tempo limite
    if (now - attempts.lastAttempt > VALIDATION_RULES.LOGIN_ATTEMPT_WINDOW) {
      attempts.count = 0;
    }
    
    if (attempts.count >= VALIDATION_RULES.MAX_LOGIN_ATTEMPTS) {
      throw new AppError(ERROR_MESSAGES.LOGIN_ATTEMPTS_EXCEEDED, 429);
    }
    
    return attempts;
  }
  
  // Registrar tentativa falha de login
  recordFailedLogin(email) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
    
    attempts.count += 1;
    attempts.lastAttempt = now;
    this.loginAttempts.set(email, attempts);
  }
  
  // Resetar tentativas de login (sucesso)
  resetLoginAttempts(email) {
    this.loginAttempts.delete(email);
  }

  async register(userData) {
    // Verificar se email já existe
    const existingUser = this.repository.findByEmail(userData.email);
    if (existingUser) {
      throw new AppError(ERROR_MESSAGES.EMAIL_IN_USE, 409);
    }

    // Hash da senha antes de salvar
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Preparar dados do usuário
    const newUserData = {
      ...userData,
      password: hashedPassword,
      role: 'user',
      isActive: true,
      paymentSettings: {
        pixKey: '',
        bankName: '',
        agency: '',
        account: '',
        accountType: 'corrente'
      },
      notificationSettings: {
        emailNewPurchase: true,
        emailRaffleComplete: true,
        smsNewPurchase: false,
        smsRaffleComplete: true,
        pushNotifications: true
      }
    };

    const user = this.repository.create(newUserData);
    
    // Remover senha da resposta
    const { password, ...userResponse } = user;

    return {
      user: userResponse,
      message: SUCCESS_MESSAGES.REGISTER_SUCCESS
    };
  }

  async login(email, password) {
    // Verificar tentativas de login
    this.checkLoginAttempts(email);

    // Buscar usuário
    const user = this.repository.findByEmail(email);
    if (!user) {
      this.recordFailedLogin(email);
      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    // Verificar se está ativo
    if (!user.isActive) {
      throw new AppError(ERROR_MESSAGES.ACCOUNT_INACTIVE, 403);
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.recordFailedLogin(email);
      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    // Login bem-sucedido - resetar tentativas
    this.resetLoginAttempts(email);

    // Atualizar último login
    this.repository.updateLastLogin(user.id);

    // Gerar token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const { password: _, ...userResponse } = user;

    return {
      token,
      user: userResponse,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS
    };
  }

  getUserByEmail(email) {
    return this.repository.findByEmail(email);
  }

  async findById(userId) {
    const user = this.repository.findById(userId);
    if (!user) {
      throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    return user;
  }

  async updateProfile(userId, updateData) {
    // Remover campos que não devem ser atualizados
    const { password, role, id, email, ...safeUpdateData } = updateData;

    const updatedUser = this.repository.update(userId, safeUpdateData);
    
    const { password: _, ...userResponse } = updatedUser;

    return {
      user: userResponse,
      message: SUCCESS_MESSAGES.PROFILE_UPDATED
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = this.repository.findById(userId);
    
    if (!user) {
      throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }
    
    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError('Senha atual incorreta', 400);
    }

    // Hash da nova senha
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    this.repository.update(userId, { 
      password: hashedNewPassword
    });

    return { message: SUCCESS_MESSAGES.PASSWORD_CHANGED };
  }
}

module.exports = UserService;