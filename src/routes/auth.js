const express = require('express');
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const UserValidator = require('../validators/userValidator');

const router = express.Router();

router.post('/register', UserValidator.validateRegister, authController.register);
router.post('/login', UserValidator.validateLogin, authController.login);
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, UserValidator.validateUpdateProfile, authController.updateProfile);
router.put('/change-password', auth, UserValidator.validateChangePassword, authController.changePassword);

module.exports = router;