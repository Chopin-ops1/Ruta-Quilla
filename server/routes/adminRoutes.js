/**
 * RutaQuilla - Admin Routes
 * All endpoints require admin authentication.
 */
const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getCapturedRoutes,
  getCaptureById,
  reviewCapture,
  compareCaptures,
  getTrafficStats,
  getUsers,
} = require('../controllers/adminController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// All admin routes require authentication + admin role
router.use(verifyToken, requireAdmin);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Traffic
router.get('/traffic', getTrafficStats);

// Users
router.get('/users', getUsers);

// Captures — compare must come before :id to avoid route collision
router.get('/captures/compare', compareCaptures);
router.get('/captures', getCapturedRoutes);
router.get('/captures/:id', getCaptureById);
router.put('/captures/:id/review', reviewCapture);

module.exports = router;
