/**
 * ============================================
 * RutaQuilla - Configuración JWT Centralizada
 * ============================================
 * 
 * Módulo único para el secreto JWT. Tanto el controlador
 * de usuarios como el middleware de autenticación importan
 * de aquí para garantizar que usen EL MISMO secreto.
 * 
 * En producción, JWT_SECRET DEBE estar definido como
 * variable de entorno. El fallback con crypto.randomBytes
 * solo sirve para desarrollo local (cambia cada reinicio).
 */

const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('❌ FATAL: En producción, JWT_SECRET debe estar definido y tener al menos 32 caracteres.');
  process.exit(1);
}

// Generar un fallback ÚNICO para desarrollo local
// (se genera UNA sola vez al cargar este módulo)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET no definido en variables de entorno.');
  console.warn('   Usando secreto aleatorio (válido solo para esta sesión de desarrollo).');
}

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };
