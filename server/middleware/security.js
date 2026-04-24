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
 * Log auth-related events for security monitoring.
 */
function logAuthEvent(event, email, ip, success = true) {
  const timestamp = new Date().toISOString();
  const status = success ? '✅' : '❌';
  console.log(`[AUTH] ${status} ${event} | email=${email} | ip=${ip} | time=${timestamp}`);
}

module.exports = { isValidObjectId, validateObjectId, escapeRegex, logAuthEvent };
