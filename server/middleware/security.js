/**
 * RutaQuilla - Security Helpers
 * Input validation and sanitization utilities.
 */

const mongoose = require('mongoose');

/**
 * Validate that a string is a valid MongoDB ObjectId.
 * Returns true if valid, false otherwise.
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

/**
 * Express middleware: validate :id param is a valid ObjectId.
 * Returns 400 if invalid, preventing CastError crashes.
 */
function validateObjectId(req, res, next) {
  if (req.params.id && !isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'ID inválido',
      code: 'INVALID_ID',
    });
  }
  next();
}

/**
 * Escape special regex characters from user input
 * to prevent ReDoS attacks and regex injection.
 */
function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape HTML special characters to prevent HTML/XSS injection
 * in email templates or rendered HTML strings.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate geographic coordinates.
 * When metroAreaOnly is true, enforces Barranquilla / Atlántico metro bounds.
 */
function isValidCoord(lat, lng, metroAreaOnly = false) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (metroAreaOnly) {
    return lat >= 10.3 && lat <= 11.3 && lng >= -75.3 && lng <= -74.5;
  }
  return true;
}

/**
 * Log auth-related events for security monitoring.
 */
function logAuthEvent(event, email, ip, success = true) {
  const timestamp = new Date().toISOString();
  const status = success ? '✅' : '❌';
  console.log(`[AUTH] ${status} ${event} | email=${email} | ip=${ip} | time=${timestamp}`);
}

module.exports = {
  isValidObjectId,
  validateObjectId,
  escapeRegex,
  escapeHtml,
  isValidCoord,
  logAuthEvent,
};
