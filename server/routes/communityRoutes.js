/**
 * RutaQuilla - Community Routes
 * 
 * Rutas del sistema comunitario Quilla XP.
 * El leaderboard, feed y perfiles públicos no requieren auth.
 * El perfil propio requiere autenticación.
 */
const express = require('express');
const router = express.Router();
const { getLeaderboard, getMyProfile, getLevelsInfo, getPublicProfile, getActivityFeed } = require('../controllers/communityController');
const { verifyToken } = require('../middleware/authMiddleware');
const { validateObjectId } = require('../middleware/security');

// Públicos — no requieren token
router.get('/leaderboard', getLeaderboard);
router.get('/levels', getLevelsInfo);
router.get('/feed', getActivityFeed);
router.get('/user/:id', validateObjectId, getPublicProfile);

// Privado — requiere token JWT
router.get('/me', verifyToken, getMyProfile);

module.exports = router;
