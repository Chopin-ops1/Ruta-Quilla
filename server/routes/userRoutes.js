/**
 * RutaQuilla - Router de Usuarios
 */
const express = require('express');
const router = express.Router();
const { register, login, getProfile, upgradeToPremium } = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /api/users/register - Registro de nuevo usuario (público)
router.post('/register', register);

// POST /api/users/login - Inicio de sesión (público)
router.post('/login', login);

// GET /api/users/profile - Perfil del usuario autenticado (protegido)
router.get('/profile', verifyToken, getProfile);

// PATCH /api/users/upgrade - Actualizar a premium (protegido)
router.patch('/upgrade', verifyToken, upgradeToPremium);

module.exports = router;
