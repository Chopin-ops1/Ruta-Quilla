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

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const { generateVerificationCode, sendVerificationEmail, sendPasswordResetEmail, verifyConnection } = require('../services/emailService');
const { logAuthEvent, isValidObjectId } = require('../middleware/security');

const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

const smtpConfigured = Boolean(process.env.ZOHO_EMAIL && process.env.ZOHO_PASSWORD);
const verificationRequired = smtpConfigured || process.env.NODE_ENV === 'production';

// Check SMTP on startup (for diagnostic logging)
verifyConnection();

/**
 * Hashea el código de verificación con SHA-256 antes de persistirlo en BD.
 */
function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

/**
 * Compara un código recibido contra el hash guardado en tiempo constante.
 */
function compareVerificationCode(inputCode, storedHash) {
  if (!inputCode || !storedHash || typeof storedHash !== 'string') return false;
  const inputHash = hashVerificationCode(inputCode);
  const inputBuf = Buffer.from(inputHash, 'utf8');
  const storedBuf = Buffer.from(storedHash, 'utf8');
  if (inputBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(inputBuf, storedBuf);
}

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
    const { name, email, password } = req.body || {};

    // Validar tipos y campos requeridos
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' ||
        !name.trim() || !email.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos: name, email, password',
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener entre 8 y 128 caracteres',
      });
    }

    const cleanName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: normalizedEmail })
      .select('+verificationCode +verificationCodeExpiry +verificationAttempts');
    
    if (existingUser) {
      // Si existe pero NO está verificado, permitir re-registro (reenviar código)
      if (!existingUser.isVerified) {
        const code = generateVerificationCode();
        existingUser.name = cleanName;
        existingUser.password = password; // Se re-hashea en pre-save
        existingUser.verificationCode = hashVerificationCode(code);
        existingUser.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        existingUser.verificationAttempts = 0;
        await existingUser.save();

        // Enviar email
        if (smtpConfigured) {
          try {
            await sendVerificationEmail(normalizedEmail, cleanName, code);
          } catch (emailErr) {
            console.error('Error enviando email:', emailErr);
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Código de verificación reenviado a tu email',
          data: { requiresVerification: true, email: normalizedEmail },
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

    // Crear usuario
    const user = new User({
      name: cleanName,
      email: normalizedEmail,
      password,
      role: 'free',
      isPremium: false,
      isVerified: !verificationRequired, // Solo auto-verifica en dev si SMTP no está configurado
      verificationCode: verificationRequired ? hashVerificationCode(code) : undefined,
      verificationCodeExpiry: verificationRequired ? new Date(Date.now() + 15 * 60 * 1000) : undefined,
      verificationAttempts: 0,
    });

    await user.save();

    // Enviar email de verificación si verificación requerida
    if (verificationRequired) {
      if (smtpConfigured) {
        try {
          await sendVerificationEmail(normalizedEmail, cleanName, code);
        } catch (emailErr) {
          console.error('Error enviando email:', emailErr);
          // Still return success — user can request resend
        }
      } else {
        console.error('⚠️ Verificación requerida pero SMTP no está configurado.');
      }

      return res.status(201).json({
        success: true,
        message: 'Cuenta creada. Revisa tu email para el código de verificación.',
        data: { requiresVerification: true, email: normalizedEmail },
      });
    }

    // Solo en desarrollo cuando SMTP no está configurado: auto-verify and return token
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
    const { email, code } = req.body || {};

    if (typeof email !== 'string' || typeof code !== 'string' || !email.trim() || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email y código son requeridos',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+verificationCode +verificationCodeExpiry +verificationAttempts +password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Código inválido o expirado',
        code: 'INVALID_CODE',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Esta cuenta ya está verificada. Puedes iniciar sesión.',
        code: 'ALREADY_VERIFIED',
      });
    }

    if ((user.verificationAttempts || 0) >= 5) {
      user.verificationCode = undefined;
      user.verificationCodeExpiry = undefined;
      await user.save();
      return res.status(429).json({
        success: false,
        message: 'Demasiados intentos fallidos. Solicita un nuevo código.',
        code: 'TOO_MANY_ATTEMPTS',
      });
    }

    // Check if code expired
    if (!user.verificationCode || !user.verificationCodeExpiry || user.verificationCodeExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'El código ha expirado. Solicita uno nuevo.',
        code: 'CODE_EXPIRED',
      });
    }

    // Check code using constant-time comparison against SHA-256 hash
    if (!compareVerificationCode(code.trim(), user.verificationCode)) {
      user.verificationAttempts = (user.verificationAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Código inválido o expirado',
        code: 'INVALID_CODE',
      });
    }

    // Verify the user
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    user.verificationAttempts = 0;
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
    const { email } = req.body || {};

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email es requerido',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+verificationCode +verificationCodeExpiry +verificationAttempts');

    if (!user || user.isVerified) {
      return res.status(200).json({
        success: true,
        message: 'Si la cuenta existe y está pendiente de verificación, enviamos un nuevo código.',
      });
    }

    // Generate new code
    const code = generateVerificationCode();
    user.verificationCode = hashVerificationCode(code);
    user.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    user.verificationAttempts = 0;
    await user.save();

    if (smtpConfigured) {
      await sendVerificationEmail(normalizedEmail, user.name, code);
    }

    res.json({
      success: true,
      message: 'Si la cuenta existe y está pendiente de verificación, enviamos un nuevo código.',
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
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Buscar usuario incluyendo la contraseña
    const user = await User.findByCredentials(normalizedEmail);

    if (!user) {
      logAuthEvent('LOGIN_FAIL_USER_NOT_FOUND', normalizedEmail, req.ip, false);
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Comparar contraseña ANTES de verificar isVerified para evitar enumeración de cuentas
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      logAuthEvent('LOGIN_FAIL_BAD_PASSWORD', normalizedEmail, req.ip, false);
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Check if verified (después de validar la contraseña)
    if (!user.isVerified && verificationRequired) {
      return res.status(403).json({
        success: false,
        message: 'Tu email no está verificado. Revisa tu bandeja de entrada.',
        code: 'NOT_VERIFIED',
        data: { email: user.email },
      });
    }

    // Generar token JWT
    const token = generateToken(user._id);
    
    logAuthEvent('LOGIN_SUCCESS', normalizedEmail, req.ip, true);

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
 * Actualiza el plan ('free' | 'premium') de un usuario objetivo (solo admin).
 */
async function upgradeToPremium(req, res) {
  try {
    const { userId, role = 'premium' } = req.body || {};

    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un userId válido',
        code: 'INVALID_USER_ID',
      });
    }

    if (!['free', 'premium'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rol inválido. Opciones permitidas: free, premium',
        code: 'INVALID_ROLE',
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      });
    }

    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No se puede modificar el rol de un administrador desde este endpoint',
        code: 'FORBIDDEN_ADMIN_MUTATION',
      });
    }

    targetUser.role = role;
    targetUser.isPremium = role === 'premium';
    await targetUser.save();

    res.json({
      success: true,
      message: role === 'premium'
        ? `Usuario ${targetUser.name} actualizado a Quilla-Pass Premium 🎉`
        : `Plan de ${targetUser.name} actualizado a Free`,
      data: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        isPremium: targetUser.isPremium,
      },
    });
  } catch (error) {
    console.error('Error al actualizar plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar plan',
    });
  }
}

/**
 * POST /api/users/forgot-password
 * Envía un código de recuperación de 6 dígitos al email si la cuenta existe.
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email es requerido',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+resetCode +resetCodeExpiry +resetAttempts');

    if (user) {
      const code = generateVerificationCode();
      user.resetCode = hashVerificationCode(code);
      user.resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      user.resetAttempts = 0;
      await user.save();

      if (smtpConfigured) {
        try {
          await sendPasswordResetEmail(normalizedEmail, user.name, code);
        } catch (emailErr) {
          console.error('Error enviando código de recuperación:', emailErr);
        }
      }
    }

    res.json({
      success: true,
      message: 'Si el correo está registrado, te enviamos un código de recuperación.',
    });
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar solicitud de recuperación',
    });
  }
}

/**
 * POST /api/users/reset-password
 * Valida el código OTP y actualiza la contraseña del usuario.
 */
async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body || {};

    if (typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string' ||
        !email.trim() || !code.trim() || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, código y nueva contraseña son requeridos',
      });
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener entre 8 y 128 caracteres',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+resetCode +resetCodeExpiry +resetAttempts');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Código inválido o expirado',
        code: 'INVALID_RESET_CODE',
      });
    }

    if ((user.resetAttempts || 0) >= 5) {
      user.resetCode = undefined;
      user.resetCodeExpiry = undefined;
      await user.save();
      return res.status(429).json({
        success: false,
        message: 'Demasiados intentos fallidos. Solicita un nuevo código.',
        code: 'TOO_MANY_ATTEMPTS',
      });
    }

    if (!user.resetCode || !user.resetCodeExpiry || user.resetCodeExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'El código ha expirado. Solicita uno nuevo.',
        code: 'CODE_EXPIRED',
      });
    }

    if (!compareVerificationCode(code.trim(), user.resetCode)) {
      user.resetAttempts = (user.resetAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Código inválido o expirado',
        code: 'INVALID_RESET_CODE',
      });
    }

    user.password = newPassword;
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    user.resetAttempts = 0;
    user.isVerified = true;
    await user.save();

    logAuthEvent('PASSWORD_RESET_SUCCESS', normalizedEmail, req.ip, true);

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.',
    });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al restablecer contraseña',
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
  forgotPassword,
  resetPassword,
};
