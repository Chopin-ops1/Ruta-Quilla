/**
 * RutaQuilla - Router de Usuarios
 */
const express = require('express');
const router = express.Router();
const { register, verifyEmail, resendCode, login, getProfile, upgradeToPremium } = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /api/users/register - Registro de nuevo usuario (público)
router.post('/register', register);

// POST /api/users/verify - Verificar email con código (público)
router.post('/verify', verifyEmail);

// POST /api/users/resend-code - Reenviar código de verificación (público)
router.post('/resend-code', resendCode);

// POST /api/users/login - Inicio de sesión (público)
router.post('/login', login);

// GET /api/users/profile - Perfil del usuario autenticado (protegido)
router.get('/profile', verifyToken, getProfile);

// PATCH /api/users/upgrade - Actualizar a premium (protegido)
router.patch('/upgrade', verifyToken, upgradeToPremium);

module.exports = router;
