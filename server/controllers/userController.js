/**
 * ============================================
 * RutaQuilla - Controlador de Usuarios
 * ============================================
 * 
 * Maneja el registro, login y perfil de usuarios.
 * Implementa autenticación completa con JWT + verificación por email:
 * 
 * 1. Registro: Crea usuario no verificado + envía código por email
 * 2. Verificar: Valida el código y activa la cuenta
 * 3. Reenviar: Genera nuevo código si el anterior expiró
 * 4. Login: Valida credenciales (solo usuarios verificados)
 * 5. Perfil: Retorna datos del usuario autenticado
 */

const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const { generateVerificationCode, sendVerificationEmail, verifyConnection } = require('../services/emailService');

const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

// Check SMTP on startup
let emailEnabled = false;
verifyConnection().then(ok => { emailEnabled = ok; });

/**
 * Genera un token JWT firmado con el ID del usuario.
 */
function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * POST /api/users/register
 * 
 * Registra un nuevo usuario y envía código de verificación por email.
 * El usuario NO puede hacer login hasta verificar su email.
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
    const existingUser = await User.findOne({ email: email.toLowerCase() }).select('+verificationCode +verificationCodeExpiry');
    
    if (existingUser) {
      // Si existe pero NO está verificado, permitir re-registro (reenviar código)
      if (!existingUser.isVerified) {
        const code = generateVerificationCode();
        existingUser.name = name;
        existingUser.password = password; // Se re-hashea en pre-save
        existingUser.verificationCode = code;
        existingUser.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        await existingUser.save();

        // Enviar email
        if (emailEnabled) {
          try {
            await sendVerificationEmail(email.toLowerCase(), name, code);
          } catch (emailErr) {
            console.error('Error enviando email:', emailErr);
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Código de verificación reenviado a tu email',
          data: { requiresVerification: true, email: email.toLowerCase() },
        });
      }

      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta verificada con este email',
        code: 'EMAIL_EXISTS',
      });
    }

    // Generar código de verificación
    const code = generateVerificationCode();

    // Crear usuario no verificado
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'free',
      isPremium: false,
      isVerified: !emailEnabled, // Auto-verify if email is not configured
      verificationCode: code,
      verificationCodeExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    });

    await user.save();

    // Enviar email de verificación
    if (emailEnabled) {
      try {
        await sendVerificationEmail(email.toLowerCase(), name, code);
      } catch (emailErr) {
        console.error('Error enviando email:', emailErr);
        // Still return success — user can request resend
      }

      return res.status(201).json({
        success: true,
        message: 'Cuenta creada. Revisa tu email para el código de verificación.',
        data: { requiresVerification: true, email: email.toLowerCase() },
      });
    }

    // If email not configured, auto-verify and return token
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
 * POST /api/users/verify
 * 
 * Verifica el email con el código de 6 dígitos.
 * Si es correcto, activa la cuenta y devuelve un JWT.
 */
async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email y código son requeridos',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+verificationCode +verificationCodeExpiry +password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró una cuenta con este email',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Esta cuenta ya está verificada. Puedes iniciar sesión.',
        code: 'ALREADY_VERIFIED',
      });
    }

    // Check if code expired
    if (!user.verificationCodeExpiry || user.verificationCodeExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'El código ha expirado. Solicita uno nuevo.',
        code: 'CODE_EXPIRED',
      });
    }

    // Check code
    if (user.verificationCode !== code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Código incorrecto. Verifica e intenta de nuevo.',
        code: 'INVALID_CODE',
      });
    }

    // Verify the user
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    // Generate JWT
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: '¡Email verificado! Tu cuenta está activa.',
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
    console.error('Error en verificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al verificar email',
    });
  }
}

/**
 * POST /api/users/resend-code
 * 
 * Reenvía el código de verificación.
 */
async function resendCode(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email es requerido',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+verificationCode +verificationCodeExpiry');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró una cuenta con este email',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Esta cuenta ya está verificada',
      });
    }

    // Generate new code
    const code = generateVerificationCode();
    user.verificationCode = code;
    user.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    if (emailEnabled) {
      await sendVerificationEmail(email.toLowerCase(), user.name, code);
    }

    res.json({
      success: true,
      message: 'Nuevo código enviado a tu email',
    });
  } catch (error) {
    console.error('Error reenviando código:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reenviar código',
    });
  }
}

/**
 * POST /api/users/login
 * 
 * Autentica un usuario verificado y retorna un token JWT.
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

    // Buscar usuario incluyendo la contraseña
    const user = await User.findByCredentials(email.toLowerCase());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Check if verified
    if (!user.isVerified && emailEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Tu email no está verificado. Revisa tu bandeja de entrada.',
        code: 'NOT_VERIFIED',
        data: { email: user.email },
      });
    }

    // Comparar contraseña
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
  verifyEmail,
  resendCode,
  login,
  getProfile,
  upgradeToPremium,
};
