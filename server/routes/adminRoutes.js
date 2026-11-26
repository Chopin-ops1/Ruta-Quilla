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
  deleteCapture,
  compareCaptures,
  getTrafficStats,
  getUsers,
  getUsersAudit,
  updateUserAdmin,
  resendUserVerificationAdmin,
  deleteUserAdmin,
  getCompositeRoutes,
  getCompositeById,
  deleteComposite,
  promoteComposite,
  getSystemHealth,
  clearSystemCaches,
  getAuditLogs,
  getSecurityConfigAdmin,
  updateSecurityConfigAdmin,
  purgeUnverifiedUsersAdmin,
  revokeAllUserSessionsAdmin,
  unlockAllAccountsAdmin,
} = require('../controllers/adminController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');
const { validateObjectId } = require('../middleware/security');

// All admin routes require authentication + admin role
router.use(verifyToken, requireAdmin);

// Dashboard & System Monitoring
router.get('/dashboard', getDashboardStats);
router.get('/traffic', getTrafficStats);
router.get('/system-health', getSystemHealth);
router.post('/cache/clear', clearSystemCaches);
router.get('/audit-logs', getAuditLogs);
router.get('/security-config', getSecurityConfigAdmin);
router.put('/security-config', updateSecurityConfigAdmin);
router.post('/security-actions/purge-unverified', purgeUnverifiedUsersAdmin);
router.post('/security-actions/revoke-all-sessions', revokeAllUserSessionsAdmin);
router.post('/security-actions/unlock-accounts', unlockAllAccountsAdmin);

// Users & Authenticity Audit
router.get('/users/audit', getUsersAudit);
router.get('/users', getUsers);
router.patch('/users/:id', validateObjectId, updateUserAdmin);
router.post('/users/:id/resend-verification', validateObjectId, resendUserVerificationAdmin);
router.delete('/users/:id', validateObjectId, deleteUserAdmin);

// Captures — compare must come before :id to avoid route collision
router.get('/captures/compare', compareCaptures);
router.get('/captures', getCapturedRoutes);
router.get('/captures/:id', validateObjectId, getCaptureById);
router.put('/captures/:id/review', validateObjectId, reviewCapture);
router.delete('/captures/:id', validateObjectId, deleteCapture);

// Composite routes (collaborative captures)
router.get('/composites', getCompositeRoutes);
router.get('/composites/:id', validateObjectId, getCompositeById);
router.delete('/composites/:id', validateObjectId, deleteComposite);
router.post('/composites/:id/promote', validateObjectId, promoteComposite);

module.exports = router;
