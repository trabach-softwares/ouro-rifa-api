const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/pix', paymentController.generatePix);
router.post('/confirm', paymentController.confirmPayment);
router.get('/', paymentController.getAllPayments);
router.get('/:id', paymentController.getPaymentStatus);

module.exports = router;