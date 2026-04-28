/**
 * RutaQuilla - Community Routes
 * 
 * Rutas del sistema comunitario Quilla XP.
 * El leaderboard y la info de niveles son públicos.
 * El perfil propio requiere autenticación.
 */
const express = require('express');
const router = express.Router();
const { getLeaderboard, getMyProfile, getLevelsInfo } = require('../controllers/communityController');
const { verifyToken } = require('../middleware/authMiddleware');

// Públicos — no requieren token
router.get('/leaderboard', getLeaderboard);
router.get('/levels', getLevelsInfo);

// Privado — requiere token JWT
router.get('/me', verifyToken, getMyProfile);

module.exports = router;
