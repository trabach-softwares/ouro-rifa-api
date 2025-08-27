const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const { ValidationMiddleware } = require('../middleware/validation');
const ResponseFormatter = require('../utils/responseFormatter');
const dataManager = require('../utils/dataManager');
const { logger } = require('../utils/logger');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// Filtro para tipos de arquivo
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Use: JPG, JPEG, PNG ou WEBP'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// Middleware de validação customizado para upload
const validateUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return ResponseFormatter.badRequest(res, 'Arquivo muito grande. Tamanho máximo: 5MB');
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return ResponseFormatter.badRequest(res, 'Campo de arquivo inválido. Use "image"');
      }
      return ResponseFormatter.badRequest(res, `Erro no upload: ${err.message}`);
    } else if (err) {
      return ResponseFormatter.badRequest(res, err.message);
    }
    
    if (!req.file) {
      return ResponseFormatter.badRequest(res, 'Nenhuma imagem foi enviada');
    }
    
    next();
  });
};

// Upload de imagem
router.post('/image', auth, validateUpload, catchAsync(async (req, res) => {
  try {
    const { file, user } = req;
    const { description, category = 'general' } = req.body;
    
    // Informações do arquivo
    const fileInfo = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      url: `/uploads/${file.filename}`,
      uploadedBy: user.id,
      description: description || null,
      category: category,
      createdAt: new Date().toISOString()
    };
    
    // Salvar informações do arquivo no dataManager
    const savedFile = dataManager.createUpload(fileInfo);
    
    logger.info(`Imagem enviada por ${user.email}: ${file.filename} (${file.size} bytes)`);
    
    return ResponseFormatter.created(res, {
      file: {
        id: savedFile.id,
        url: savedFile.url,
        originalName: savedFile.originalName,
        size: savedFile.size,
        mimetype: savedFile.mimetype,
        description: savedFile.description,
        category: savedFile.category,
        createdAt: savedFile.createdAt
      }
    }, 'Upload realizado com sucesso');
    
  } catch (error) {
    logger.error('Erro no upload de imagem:', error);
    
    // Remover arquivo em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return ResponseFormatter.error(res, 'Erro interno no upload');
  }
}));

// Listar uploads do usuário
router.get('/my-uploads', auth, catchAsync(async (req, res) => {
  const { page = 1, limit = 10, category } = req.query;
  
  let uploads = dataManager.getUploads().filter(upload => upload.uploadedBy === req.user.id);
  
  // Filtrar por categoria se especificada
  if (category) {
    uploads = uploads.filter(upload => upload.category === category);
  }
  
  // Ordenar por data (mais recentes primeiro)
  uploads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Paginação
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedUploads = uploads.slice(startIndex, endIndex);
  
  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(uploads.length / limit),
    totalItems: uploads.length,
    limit: parseInt(limit),
    hasNext: endIndex < uploads.length,
    hasPrev: startIndex > 0
  };
  
  return ResponseFormatter.paginated(res, paginatedUploads, pagination);
}));

// Obter informações de um upload específico
router.get('/:id', auth, catchAsync(async (req, res) => {
  const { id } = req.params;
  const upload = dataManager.getUploadById(id);
  
  if (!upload) {
    return ResponseFormatter.notFound(res, 'Arquivo não encontrado');
  }
  
  // Verificar se o usuário tem permissão (dono ou admin)
  if (upload.uploadedBy !== req.user.id && req.user.role !== 'super_admin') {
    return ResponseFormatter.forbidden(res, 'Acesso negado a este arquivo');
  }
  
  return ResponseFormatter.success(res, upload);
}));

// Deletar upload
router.delete('/:id', auth, catchAsync(async (req, res) => {
  const { id } = req.params;
  const upload = dataManager.getUploadById(id);
  
  if (!upload) {
    return ResponseFormatter.notFound(res, 'Arquivo não encontrado');
  }
  
  // Verificar se o usuário tem permissão (dono ou admin)
  if (upload.uploadedBy !== req.user.id && req.user.role !== 'super_admin') {
    return ResponseFormatter.forbidden(res, 'Acesso negado para deletar este arquivo');
  }
  
  try {
    // Remover arquivo físico
    const filePath = path.join(__dirname, '../../', upload.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remover do banco de dados
    const deleted = dataManager.deleteUpload(id);
    
    if (deleted) {
      logger.info(`Arquivo deletado por ${req.user.email}: ${upload.filename}`);
      return ResponseFormatter.success(res, null, 'Arquivo deletado com sucesso');
    } else {
      return ResponseFormatter.error(res, 'Erro ao deletar arquivo do banco de dados');
    }
    
  } catch (error) {
    logger.error('Erro ao deletar arquivo:', error);
    return ResponseFormatter.error(res, 'Erro interno ao deletar arquivo');
  }
}));

// Listar todos os uploads (apenas admin)
router.get('/admin/all', auth, catchAsync(async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return ResponseFormatter.forbidden(res, 'Acesso negado');
  }
  
  const { page = 1, limit = 10, category, userId } = req.query;
  
  let uploads = dataManager.getUploads();
  
  // Filtros
  if (category) {
    uploads = uploads.filter(upload => upload.category === category);
  }
  
  if (userId) {
    uploads = uploads.filter(upload => upload.uploadedBy === userId);
  }
  
  // Adicionar informações do usuário
  uploads = uploads.map(upload => {
    const user = dataManager.getUserById(upload.uploadedBy);
    return {
      ...upload,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email
      } : null
    };
  });
  
  // Ordenar por data (mais recentes primeiro)
  uploads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Paginação
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedUploads = uploads.slice(startIndex, endIndex);
  
  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(uploads.length / limit),
    totalItems: uploads.length,
    limit: parseInt(limit),
    hasNext: endIndex < uploads.length,
    hasPrev: startIndex > 0
  };
  
  return ResponseFormatter.paginated(res, paginatedUploads, pagination);
}));

module.exports = router;