/**
 * RutaQuilla - Router de Mapas
 */
const express = require('express');
const router = express.Router();
const { downloadOfflineMap, getSponsoredLocations } = require('../controllers/mapController');
const { verifyToken, requirePremium } = require('../middleware/authMiddleware');

// GET /api/maps/download - Descarga de mapa offline (SOLO PREMIUM)
// El middleware requirePremium bloquea usuarios free
router.get('/download', verifyToken, requirePremium, downloadOfflineMap);

// GET /api/maps/sponsored - Ubicaciones patrocinadas (público)
router.get('/sponsored', getSponsoredLocations);

module.exports = router;
