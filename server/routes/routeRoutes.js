/**
 * RutaQuilla - Router de Rutas de Transporte
 */
const express = require('express');
const router = express.Router();
const { captureRoute, getNearbyRoutes, getAllRoutes, getRouteAudit, getRouteById, navigateRoute } = require('../controllers/routeController');
const { verifyToken, optionalAuth } = require('../middleware/authMiddleware');

// GET /api/routes - Listar todas las rutas (público)
router.get('/', getAllRoutes);

// GET /api/routes/auditoria - Auditoría de rutas (público para db seeding check)
router.get('/auditoria', getRouteAudit);

// GET /api/routes/nearby - Búsqueda radial geoespacial (público)
router.get('/nearby', getNearbyRoutes);

// POST /api/routes/navigate - Buscar ruta entre dos puntos (público)
router.post('/navigate', navigateRoute);

// GET /api/routes/:id - Detalle de una ruta (público)
router.get('/:id', getRouteById);

// POST /api/routes/capture - Capturar nueva ruta GPS (autenticación opcional)
router.post('/capture', optionalAuth, captureRoute);

module.exports = router;

