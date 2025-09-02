const express = require('express');
const paymentController = require('../controllers/paymentController');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticação para todas as rotas de pagamentos
router.use(auth);

// Rotas do usuário (vendedor)
router.post('/pix', paymentController.generatePix);
router.post('/confirm', paymentController.confirmPayment);
router.get('/sales/list', paymentController.getSalesPayments);  // ✅ TELA DE VENDAS
router.get('/:id', paymentController.getPaymentStatus);

// Rotas administrativas
router.get('/admin/stats', adminAuth, paymentController.getPaymentStats);
router.get('/admin/all', adminAuth, paymentController.getAllPayments);

// Rota geral para admin (deve vir por último)
router.get('/', adminAuth, paymentController.getAllPayments);

module.exports = router;