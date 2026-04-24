/**
 * RutaQuilla - Router de Usuarios
 */
const express = require('express');
const router = express.Router();
const { register, verifyEmail, resendCode, login, getProfile, upgradeToPremium } = require('../controllers/userController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

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

// PATCH /api/users/upgrade - Actualizar a premium (solo admin puede otorgar)
router.patch('/upgrade', verifyToken, requireAdmin, upgradeToPremium);

module.exports = router;
