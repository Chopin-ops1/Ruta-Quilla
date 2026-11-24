/**
 * RutaQuilla - Router de Mapas
 */
const express = require('express');
const router = express.Router();
const {
  downloadOfflineMap,
  getSponsoredLocations,
  geocodePlaces,
  reverseGeocodePoint,
  getMapPOIs,
} = require('../controllers/mapController');
const { verifyToken, requirePremium } = require('../middleware/authMiddleware');

// GET /api/maps/geocode?q=... - Búsqueda y autocompletado geocodificado (público, con caché)
router.get('/geocode', geocodePlaces);

// GET /api/maps/reverse?lat=...&lng=... - Geocodificación inversa (público, con caché)
router.get('/reverse', reverseGeocodePoint);

// GET /api/maps/pois?south=...&west=...&north=...&east=... - POIs OSM en vivo con caché
router.get('/pois', getMapPOIs);

// GET /api/maps/download - Descarga de mapa offline (SOLO PREMIUM)
// El middleware requirePremium bloquea usuarios free
router.get('/download', verifyToken, requirePremium, downloadOfflineMap);

// GET /api/maps/sponsored - Ubicaciones patrocinadas (público)
router.get('/sponsored', getSponsoredLocations);

module.exports = router;
