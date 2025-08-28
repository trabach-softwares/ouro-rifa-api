const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const raffleController = require('../controllers/raffleController');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Configuração do multer para rifas
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/raffles/';
    
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `raffle_${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Use: JPG, JPEG, PNG ou WEBP'), false);
  }
};

const uploadRaffleImage = multer({ 
  storage: storage,
  limits: { 
    fileSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// Rotas públicas (sem autenticação)
router.get('/', raffleController.getRaffles);
router.get('/categories', raffleController.getCategories);
router.get('/draw-types', raffleController.getDrawTypes);
router.get('/calculate-fee', raffleController.calculateFee);
router.get('/:id', raffleController.getRaffleById);

// Rotas autenticadas
router.use(auth);

// Rotas do usuário
router.get('/user/my-raffles', raffleController.getMyRaffles);
router.post('/', raffleController.createRaffle);
router.post('/with-image', uploadRaffleImage.single('image'), raffleController.createRaffleWithImage);
router.put('/:id', raffleController.updateRaffle);
router.delete('/:id', raffleController.deleteRaffle);
router.post('/:id/draw', raffleController.drawRaffle);
router.put('/:id/status', raffleController.updateRaffleStatus);

// Rotas administrativas
router.get('/admin/all', adminAuth, raffleController.getAllRaffles);

module.exports = router;