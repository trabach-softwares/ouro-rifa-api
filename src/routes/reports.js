const express = require('express');
const reportController = require('../controllers/reportController');
const { auth, adminAuth, superAdminAuth } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticação para todas as rotas
router.use(auth);

// Rotas para usuários autenticados
router.get('/dashboard', reportController.getDashboard);
router.get('/sales', reportController.getSalesReport);
router.get('/revenue', reportController.getRevenueReport);

// Rotas específicas do usuário
router.get('/my/dashboard', reportController.getMyDashboard);
router.get('/my/sales', reportController.getMySalesReport);
router.get('/my/revenue', reportController.getMyRevenueReport);
router.get('/my/customers', reportController.getMyCustomers);

// Rotas administrativas (apenas super admin)
router.get('/admin/users', superAdminAuth, reportController.getUsersReport);

module.exports = router;