/**
 * RutaQuilla - Router de Usuarios
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { getFormToken, register, verifyEmail, verifyLogin2FA, resendCode, login, getProfile, upgradeToPremium, forgotPassword, resetPassword } = require('../controllers/userController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const registerLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 6 : 30,
  message: {
    success: false,
    code: 'REGISTER_RATE_LIMIT',
    message: 'Demasiados intentos de registro desde esta conexión. Intenta nuevamente en 30 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/users/form-token - Token HMAC anti-bot de un solo uso
router.get('/form-token', getFormToken);

// POST /api/users/register - Registro de nuevo usuario (público, protegido contra ráfagas)
router.post('/register', registerLimiter, register);

// POST /api/users/verify - Verificar email con código (público)
router.post('/verify', verifyEmail);

// POST /api/users/verify-2fa - Verificar OTP 2FA de acceso Admin (público)
router.post('/verify-2fa', verifyLogin2FA);

// POST /api/users/resend-code - Reenviar código de verificación (público)
router.post('/resend-code', resendCode);

// POST /api/users/forgot-password - Solicitar código de recuperación (público)
router.post('/forgot-password', forgotPassword);

// POST /api/users/reset-password - Restablecer contraseña con código OTP (público)
router.post('/reset-password', resetPassword);

// POST /api/users/login - Inicio de sesión (público)
router.post('/login', login);

// GET /api/users/profile - Perfil del usuario autenticado (protegido)
router.get('/profile', verifyToken, getProfile);

// PATCH /api/users/upgrade - Actualizar a premium (solo admin puede otorgar)
router.patch('/upgrade', verifyToken, requireAdmin, upgradeToPremium);

module.exports = router;
