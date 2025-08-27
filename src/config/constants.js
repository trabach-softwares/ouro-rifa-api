const ERROR_MESSAGES = {
  // Autenticação
  TOKEN_REQUIRED: 'Token de acesso requerido',
  INVALID_TOKEN: 'Token inválido',
  USER_NOT_FOUND: 'Usuário não encontrado',
  ACCOUNT_INACTIVE: 'Conta inativa. Entre em contato com o suporte.',
  ACCESS_DENIED: 'Acesso negado',
  INVALID_CREDENTIALS: 'Email ou senha incorretos',
  LOGIN_ATTEMPTS_EXCEEDED: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
  EMAIL_IN_USE: 'Este email já está em uso',
  
  // Rifas
  RAFFLE_NOT_FOUND: 'Rifa não encontrada',
  
  // Tickets
  TICKET_NOT_FOUND: 'Ticket não encontrado',
  
  // Pagamentos
  PAYMENT_NOT_FOUND: 'Pagamento não encontrado',
  
  // Geral
  INTERNAL_ERROR: 'Erro interno do servidor'
};

const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login realizado com sucesso',
  REGISTER_SUCCESS: 'Usuário registrado com sucesso',
  PROFILE_UPDATED: 'Perfil atualizado com sucesso',
  PASSWORD_CHANGED: 'Senha alterada com sucesso',
  RAFFLE_CREATED: 'Rifa criada com sucesso',
  RAFFLE_UPDATED: 'Rifa atualizada com sucesso',
  RAFFLE_DELETED: 'Rifa excluída com sucesso',
  DRAW_COMPLETED: 'Sorteio realizado com sucesso',
  TICKETS_RESERVED: 'Tickets reservados com sucesso'
};

const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100
};

const RAFFLE_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

const VALIDATION_RULES = {
  // Usuário
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  PASSWORD_MIN_LENGTH: 6,
  
  // Rifa
  TITLE_MIN_LENGTH: 5,
  TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 1000,
  MIN_TICKETS: 10,
  MAX_TICKETS: 100000,
  
  // Tickets
  MAX_TICKETS_PER_PURCHASE: 100,
  MAX_TICKETS_PER_PERSON: 1000,
  
  // Segurança
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_ATTEMPT_WINDOW: 15 * 60 * 1000 // 15 minutos
};

module.exports = {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DEFAULT_PAGINATION,
  RAFFLE_STATUS,
  PAYMENT_STATUS,
  VALIDATION_RULES
};