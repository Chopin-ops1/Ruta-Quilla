/**
 * ============================================
 * RutaQuilla - Controlador de Usuarios
 * ============================================
 * 
 * Maneja el registro, login y perfil de usuarios.
 * Implementa autenticación completa con JWT:
 * 
 * 1. Registro: Crea usuario con contraseña hasheada (bcrypt)
 * 2. Login: Valida credenciales y retorna JWT
 * 3. Perfil: Retorna datos del usuario autenticado
 */

const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');

const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Genera un token JWT firmado con el ID del usuario.
 * 
 * @param {string} userId - ObjectId del usuario en MongoDB
 * @returns {string} Token JWT firmado
 */
function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * POST /api/users/register
 * 
 * Registra un nuevo usuario en el sistema.
 * Por defecto, todos los usuarios inician con rol 'free'.
 * 
 * Body esperado:
 * {
 *   name: "Juan Pérez",
 *   email: "juan@example.com",
 *   password: "micontraseña123"
 * }
 */
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    // Validar campos requeridos
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos: name, email, password',
      });
    }

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta con este email',
        code: 'EMAIL_EXISTS',
      });
    }

    // Crear usuario (la contraseña se hashea automáticamente en el pre-save hook)
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'free',
      isPremium: false,
    });

    await user.save();

    // Generar token JWT
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isPremium: user.isPremium,
          contributions: user.contributions,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Error en registro:', error);

    // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno al registrar usuario',
    });
  }
}

/**
 * POST /api/users/login
 * 
 * Autentica un usuario y retorna un token JWT.
 * 
 * Body esperado:
 * {
 *   email: "juan@example.com",
 *   password: "micontraseña123"
 * }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos',
      });
    }

    // Buscar usuario incluyendo la contraseña (select: false por defecto)
    const user = await User.findByCredentials(email.toLowerCase());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Comparar contraseña con hash almacenado
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Generar token JWT
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isPremium: user.isPremium,
          contributions: user.contributions,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al iniciar sesión',
    });
  }
}

/**
 * GET /api/users/profile
 * 
 * Retorna el perfil del usuario autenticado.
 * Requiere token JWT válido (verifyToken middleware).
 */
async function getProfile(req, res) {
  try {
    res.json({
      success: true,
      data: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isPremium: req.user.isPremium,
        contributions: req.user.contributions,
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
    });
  }
}

/**
 * PATCH /api/users/upgrade
 * 
 * Actualiza el usuario a premium (Quilla-Pass).
 * En producción, esto se integraría con un sistema de pagos.
 */
async function upgradeToPremium(req, res) {
  try {
    req.user.role = 'premium';
    req.user.isPremium = true;
    await req.user.save();

    res.json({
      success: true,
      message: '¡Bienvenido a Quilla-Pass Premium! 🎉',
      data: {
        id: req.user._id,
        name: req.user.name,
        role: req.user.role,
        isPremium: req.user.isPremium,
      },
    });
  } catch (error) {
    console.error('Error al actualizar a premium:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar plan',
    });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  upgradeToPremium,
};
