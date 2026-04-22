/**
 * RutaQuilla - Router de Rutas de Transporte
 */
const express = require('express');
const router = express.Router();
const {
  captureRoute, getNearbyRoutes, getAllRoutes, getRouteAudit,
  getRouteById, navigateRoute, createRoute, updateRoute,
  deleteRoute, deleteAllRoutes,
} = require('../controllers/routeController');
const { verifyToken, requireAdmin, optionalAuth } = require('../middleware/authMiddleware');

// ---- Public endpoints ----

// GET /api/routes - Listar todas las rutas (público)
router.get('/', getAllRoutes);

// GET /api/routes/auditoria - Auditoría de rutas (público para db seeding check)
router.get('/auditoria', getRouteAudit);

// GET /api/routes/nearby - Búsqueda radial geoespacial (público)
router.get('/nearby', getNearbyRoutes);

// POST /api/routes/navigate - Buscar ruta entre dos puntos (público)
router.post('/navigate', navigateRoute);

// POST /api/routes/capture - Capturar nueva ruta GPS (autenticación opcional)
router.post('/capture', optionalAuth, captureRoute);

// ---- Admin endpoints (requieren token + rol admin) ----

// POST /api/routes/admin/create - Crear ruta oficial
router.post('/admin/create', verifyToken, requireAdmin, createRoute);

// DELETE /api/routes/admin/all - Eliminar TODAS las rutas
router.delete('/admin/all', verifyToken, requireAdmin, deleteAllRoutes);

// PUT /api/routes/:id - Actualizar ruta
router.put('/:id', verifyToken, requireAdmin, updateRoute);

// DELETE /api/routes/:id - Eliminar una ruta
router.delete('/:id', verifyToken, requireAdmin, deleteRoute);

// GET /api/routes/:id - Detalle de una ruta (público) — debe ir al final para no capturar /admin/xxx
router.get('/:id', getRouteById);

module.exports = router;
