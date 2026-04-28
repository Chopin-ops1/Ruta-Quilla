/**
 * RutaQuilla - Report Routes
 *
 * Rutas para reportes en tiempo real.
 * - GET /active, /types, /affected/:id son públicos
 * - POST /, /:id/confirm, /:id/dismiss requieren autenticación
 * - GET /admin y DELETE /admin/:id requieren admin
 */
const express = require('express');
const router = express.Router();
const {
  createReport, getActiveReports, confirmReport, dismissReport,
  getReportTypes, getAffectedReports, adminGetReports, adminDeleteReport,
} = require('../controllers/reportController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');
const { validateObjectId } = require('../middleware/security');

// Públicos
router.get('/active', getActiveReports);
router.get('/types', getReportTypes);
router.get('/affected/:id', validateObjectId, getAffectedReports);

// Requieren autenticación
router.post('/', verifyToken, createReport);
router.post('/:id/confirm', validateObjectId, verifyToken, confirmReport);
router.post('/:id/dismiss', validateObjectId, verifyToken, dismissReport);

// Admin
router.get('/admin', verifyToken, requireAdmin, adminGetReports);
router.delete('/admin/:id', validateObjectId, verifyToken, requireAdmin, adminDeleteReport);

module.exports = router;
