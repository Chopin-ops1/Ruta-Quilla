/**
 * RutaQuilla - Report Routes
 *
 * Rutas para reportes en tiempo real.
 * - GET /active y /types son públicos
 * - POST / y POST /:id/confirm requieren autenticación
 */
const express = require('express');
const router = express.Router();
const { createReport, getActiveReports, confirmReport, getReportTypes } = require('../controllers/reportController');
const { verifyToken } = require('../middleware/authMiddleware');

// Públicos
router.get('/active', getActiveReports);
router.get('/types', getReportTypes);

// Requieren autenticación
router.post('/', verifyToken, createReport);
router.post('/:id/confirm', verifyToken, confirmReport);

module.exports = router;
