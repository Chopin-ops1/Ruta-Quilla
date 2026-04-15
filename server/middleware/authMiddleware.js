/**
 * ============================================
 * RutaQuilla - Middleware de Autenticación
 * ============================================
 * 
 * Middlewares para proteger endpoints de la API:
 * 
 * 1. verifyToken: Verifica que el request incluya un JWT válido
 *    en el header Authorization (formato: "Bearer <token>")
 * 
 * 2. requirePremium: Verifica que el usuario autenticado
 *    tenga el rol premium (Quilla-Pass) para acceder a
 *    funcionalidades restringidas como descarga offline
 * 
 * 3. optionalAuth: Intenta autenticar sin bloquear si no hay token
 *    (útil para endpoints que muestran contenido diferente
 *    según si el usuario es free o premium)
 */

const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');

// Cargar secreto JWT desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'rutaquilla_secret_key_barranquilla_2024';

/**
 * Middleware: Verificar Token JWT
 * 
 * Extrae el token del header Authorization, lo verifica
 * con el secreto JWT, y adjunta el usuario al request.
 * 
 * Si el token es inválido o expirado, retorna 401.
 */
async function verifyToken(req, res, next) {
  try {
    // Extraer token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Token no proporcionado.',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido. Usuario no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    // Adjuntar usuario al request para uso en controladores
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido.',
        code: 'INVALID_TOKEN',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado. Por favor inicia sesión de nuevo.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error interno de autenticación.',
    });
  }
}

/**
 * Middleware: Requerir Premium (Quilla-Pass)
 * 
 * Debe usarse DESPUÉS de verifyToken.
 * Verifica que el usuario tenga isPremium: true.
 * 
 * Uso: router.get('/api/maps/download', verifyToken, requirePremium, handler)
 */
function requirePremium(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autenticación requerida.',
      code: 'NOT_AUTHENTICATED',
    });
  }

  if (!req.user.isPremium && req.user.role !== 'premium') {
    return res.status(403).json({
      success: false,
      message: 'Funcionalidad exclusiva para usuarios Quilla-Pass (Premium). Actualiza tu plan para acceder.',
      code: 'PREMIUM_REQUIRED',
    });
  }

  next();
}

/**
 * Middleware: Autenticación Opcional
 * 
 * Intenta autenticar al usuario si hay un token presente,
 * pero no bloquea el acceso si no hay token.
 * 
 * Útil para endpoints que muestran contenido diferente
 * según el rol del usuario (ej: mostrar/ocultar publicidad).
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silenciar errores de token - el usuario simplemente no estará autenticado
  }
  
  next();
}

module.exports = { verifyToken, requirePremium, optionalAuth };
