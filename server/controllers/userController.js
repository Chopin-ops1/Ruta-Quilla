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
const { getSystemConfig } = require('../models/SystemConfigModel');
const { logAdminAction } = require('../models/AdminLogModel');
const { generateVerificationCode, sendVerificationEmail, sendPasswordResetEmail, sendAdminLoginOtpEmail, verifyConnection, isEmailDeliveryReady } = require('../services/emailService');
const {
  issueFormToken,
  verifyFormToken,
  consumeFormTokenNonce,
  verifyTurnstileToken,
  validateRegistrationEmail,
} = require('../services/emailSecurityService');
const { logAuthEvent, isValidObjectId } = require('../middleware/security');

const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

// Check email delivery on startup (for diagnostic logging & warm cache)
verifyConnection();

/**
 * GET /api/users/form-token
 * Genera un token HMAC temporal anti-bots al abrir el formulario de autenticación.
 */
function getFormToken(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    formToken: issueFormToken(),
  });
}

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
 * Genera un token JWT firmado con el ID del usuario y tokenVersion para revocación.
 */
function generateToken(userOrId, tokenVersion = 0) {
  const id = typeof userOrId === 'object' && userOrId !== null ? userOrId._id : userOrId;
  const tv = typeof userOrId === 'object' && userOrId !== null ? (userOrId.tokenVersion || 0) : tokenVersion;
  return jwt.sign({ id, tv }, JWT_SECRET, {
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
    const sysConfig = await getSystemConfig();

    if (!sysConfig.registrationEnabled) {
      return res.status(403).json({
        success: false,
        code: 'REGISTRATION_DISABLED',
        message: 'El registro de nuevas cuentas está pausado temporalmente por mantenimiento.',
      });
    }

    const { name, email, password, website, formToken, turnstileToken } = req.body || {};

    if (sysConfig.botShieldEnabled && typeof website === 'string' && website.trim().length > 0) {
      logAuthEvent('BOT_HONEYPOT_BLOCKED', String(email || 'unknown'), req.ip, false);
      await logAdminAction({
        req,
        action: 'BOT_HONEYPOT_BLOCKED',
        category: 'security',
        summary: `Registro bot bloqueado por honeypot (${String(email || 'sin-email').slice(0, 60)})`,
        adminEmailOverride: 'bot-shield',
      });
      return res.status(403).json({
        success: false,
        code: 'BOT_BLOCKED',
        message: 'No se pudo procesar tu solicitud. Intenta de nuevo.',
      });
    }

    const turnstileActive = Boolean(sysConfig.turnstileEnabled && process.env.TURNSTILE_SECRET_KEY);

    if (turnstileActive) {
      const tsCheck = await verifyTurnstileToken(turnstileToken, req.ip);
      if (!tsCheck.ok) {
        return res.status(403).json({
          success: false,
          code: 'CAPTCHA_FAILED',
          message: 'Por favor completa la casilla de verificación para continuar.',
        });
      }
    } else if (sysConfig.botShieldEnabled) {
      const tokenCheck = verifyFormToken(formToken, { minAgeMs: 800, consumeNonce: false });
      if (!tokenCheck.ok) {
        logAuthEvent(`BOT_TOKEN_${tokenCheck.reason}`, String(email || 'unknown'), req.ip, false);
        await logAdminAction({
          req,
          action: 'BOT_TOKEN_BLOCKED',
          category: 'security',
          summary: `Registro bloqueado por filtro anti-bot (${tokenCheck.reason})`,
          adminEmailOverride: 'bot-shield',
        });
        return res.status(403).json({
          success: false,
          code: 'FORM_TOKEN_INVALID',
          message:
            tokenCheck.reason === 'TOO_FAST'
              ? 'Envío demasiado rápido. Espera un momento e intenta de nuevo.'
              : 'La sesión del formulario expiró. Intenta enviar nuevamente.',
        });
      }
    }

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

    if (sysConfig.strictEmailValidation) {
      const emailCheck = await validateRegistrationEmail(
        normalizedEmail,
        cleanName,
        sysConfig.blockedEmailDomains
      );
      if (!emailCheck.valid) {
        return res.status(400).json({
          success: false,
          code: emailCheck.code,
          suggestedEmail: emailCheck.suggestedEmail || null,
          message: emailCheck.message,
        });
      }
    }

    const emailReady = sysConfig.requireEmailVerification ? await isEmailDeliveryReady() : false;
    const mustVerify = Boolean(sysConfig.requireEmailVerification && emailReady);

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: normalizedEmail })
      .select('+verificationCode +verificationCodeExpiry +verificationAttempts');
    
    if (existingUser) {
      // Si existe pero NO está verificado, permitir re-registro (reenviar código o activar si SMTP está bloqueado)
      if (!existingUser.isVerified) {
        if (mustVerify) {
          const code = generateVerificationCode();
          existingUser.name = cleanName;
          existingUser.password = password; // Se re-hashea en pre-save
          existingUser.verificationCode = hashVerificationCode(code);
          existingUser.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
          existingUser.verificationAttempts = 0;
          await existingUser.save();
          if (!turnstileActive && sysConfig.botShieldEnabled) {
            consumeFormTokenNonce(formToken);
          }

          try {
            await sendVerificationEmail(normalizedEmail, cleanName, code);
          } catch (emailErr) {
            console.error('Error enviando email:', emailErr);
          }

          return res.status(200).json({
            success: true,
            message: 'Código de verificación reenviado a tu email',
            data: { requiresVerification: true, email: normalizedEmail },
          });
        }

        existingUser.name = cleanName;
        existingUser.password = password; // Se re-hashea en pre-save
        existingUser.isVerified = true;
        existingUser.verificationCode = undefined;
        existingUser.verificationCodeExpiry = undefined;
        existingUser.verificationAttempts = 0;
        await existingUser.save();
        if (!turnstileActive && sysConfig.botShieldEnabled) {
          consumeFormTokenNonce(formToken);
        }

        if (sysConfig.requireEmailVerification && !emailReady) {
          console.warn('⚠️ Verificación OTP omitida por SMTP bloqueado; cuenta activada con protección Turnstile/MX');
        }

        const token = generateToken(existingUser);
        return res.status(200).json({
          success: true,
          message: 'Cuenta activada exitosamente',
          data: {
            user: {
              id: existingUser._id,
              name: existingUser.name,
              email: existingUser.email,
              role: existingUser.role,
              isPremium: existingUser.isPremium,
              contributions: existingUser.contributions,
            },
            token,
          },
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
      isVerified: !mustVerify,
      verificationCode: mustVerify ? hashVerificationCode(code) : undefined,
      verificationCodeExpiry: mustVerify ? new Date(Date.now() + 15 * 60 * 1000) : undefined,
      verificationAttempts: 0,
    });

    await user.save();
    if (!turnstileActive && sysConfig.botShieldEnabled) {
      consumeFormTokenNonce(formToken);
    }

    // Enviar email de verificación si el envío de correos está operativo
    if (mustVerify) {
      try {
        await sendVerificationEmail(normalizedEmail, cleanName, code);
      } catch (emailErr) {
        console.error('Error enviando email:', emailErr);
        // Still return success — user can request resend
      }

      return res.status(201).json({
        success: true,
        message: 'Cuenta creada. Revisa tu email para el código de verificación.',
        data: { requiresVerification: true, email: normalizedEmail },
      });
    }

    if (sysConfig.requireEmailVerification && !emailReady) {
      console.warn('⚠️ Verificación OTP omitida por SMTP bloqueado; cuenta activada con protección Turnstile/MX');
    }

    // Activar y emitir JWT cuando la verificación por correo no está activa o SMTP no responde
    const token = generateToken(user);
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
    const token = generateToken(user);

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

    const emailReady = await isEmailDeliveryReady();
    if (!emailReady) {
      return res.status(503).json({
        success: false,
        code: 'EMAIL_DELIVERY_UNAVAILABLE',
        message: 'El envío de códigos por correo no está disponible en este momento. Intenta iniciar sesión o registrarte nuevamente.',
      });
    }

    // Generate new code
    const code = generateVerificationCode();
    user.verificationCode = hashVerificationCode(code);
    user.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    user.verificationAttempts = 0;
    await user.save();

    await sendVerificationEmail(normalizedEmail, user.name, code);

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
    const sysConfig = await getSystemConfig();
    const { email, password, website, turnstileToken } = req.body || {};

    if (sysConfig.botShieldEnabled && typeof website === 'string' && website.trim().length > 0) {
      logAuthEvent('BOT_LOGIN_HONEYPOT_BLOCKED', String(email || 'unknown'), req.ip, false);
      return res.status(403).json({
        success: false,
        code: 'BOT_BLOCKED',
        message: 'Solicitud bloqueada por el filtro anti-bots.',
      });
    }

    if (sysConfig.turnstileEnabled && process.env.TURNSTILE_SECRET_KEY) {
      const tsCheck = await verifyTurnstileToken(turnstileToken, req.ip);
      if (!tsCheck.ok) {
        return res.status(403).json({
          success: false,
          code: 'CAPTCHA_FAILED',
          message: 'Por favor completa la casilla de verificación para iniciar sesión.',
        });
      }
    }

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

    // Bloqueo temporal tras 5 intentos fallidos
    if (user.lockUntil && user.lockUntil > new Date()) {
      logAuthEvent('LOGIN_BLOCKED_LOCKOUT', normalizedEmail, req.ip, false);
      return res.status(429).json({
        success: false,
        message: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en unos minutos.',
        code: 'ACCOUNT_LOCKED',
      });
    }

    // Comparar contraseña ANTES de verificar isVerified para evitar enumeración de cuentas
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      const nextAttempts = (user.failedLoginAttempts || 0) + 1;
      if (nextAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await User.updateOne(
          { _id: user._id },
          { $set: { failedLoginAttempts: 0, lockUntil } }
        );
        logAuthEvent('LOGIN_LOCKOUT_TRIGGERED', normalizedEmail, req.ip, false);
        if (user.role === 'admin') {
          await logAdminAction({
            req,
            action: 'ADMIN_LOGIN_LOCKOUT',
            category: 'security',
            targetType: 'User',
            targetId: user._id,
            summary: `Bloqueo temporal por intentos fallidos en cuenta admin (${normalizedEmail})`,
            adminEmailOverride: normalizedEmail,
          });
        }
      } else {
        await User.updateOne(
          { _id: user._id },
          { $set: { failedLoginAttempts: nextAttempts } }
        );
      }
      logAuthEvent('LOGIN_FAIL_BAD_PASSWORD', normalizedEmail, req.ip, false);
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if ((user.failedLoginAttempts || 0) > 0 || user.lockUntil) {
      await User.updateOne(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0, lockUntil: null } }
      );
    }

    if (user.isSuspended) {
      logAuthEvent('LOGIN_FAIL_SUSPENDED', normalizedEmail, req.ip, false);
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta ha sido suspendida. Contacta al administrador.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    // Check if verified (después de validar la contraseña)
    const emailReadyForVerify = !user.isVerified && sysConfig.requireEmailVerification && user.role !== 'admin'
      ? await isEmailDeliveryReady()
      : false;
    const enforceVerified = Boolean(sysConfig.requireEmailVerification && emailReadyForVerify);
    if (!user.isVerified && enforceVerified && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Tu email no está verificado. Revisa tu bandeja de entrada.',
        code: 'NOT_VERIFIED',
        data: { email: user.email },
      });
    }

    // Si 2FA por email para Administradores está habilitado, exigir código OTP antes de emitir JWT
    if (user.role === 'admin' && sysConfig.adminLogin2FA && await isEmailDeliveryReady()) {
      const code = generateVerificationCode();
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            loginOtpCode: hashVerificationCode(code),
            loginOtpExpiry: new Date(Date.now() + 10 * 60 * 1000),
            loginOtpAttempts: 0,
          },
        }
      );

      await sendAdminLoginOtpEmail(user.email, user.name, code);
      logAuthEvent('ADMIN_2FA_CHALLENGE_SENT', normalizedEmail, req.ip, true);

      return res.json({
        success: true,
        message: 'Código de seguridad 2FA enviado a tu correo',
        data: {
          requiresTwoFactor: true,
          email: user.email,
        },
      });
    }

    // Generar token JWT
    const token = generateToken(user);
    
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

    await logAdminAction({
      req,
      action: 'USER_ROLE_CHANGE',
      category: 'user',
      targetType: 'User',
      targetId: targetUser._id,
      summary: `Plan de ${targetUser.email} cambiado a ${role}`,
      metadata: { role },
    });

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

      if (await isEmailDeliveryReady()) {
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
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
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

/**
 * POST /api/users/verify-2fa
 * Verifica el código OTP 2FA para inicio de sesión de administrador.
 */
async function verifyLogin2FA(req, res) {
  try {
    const { email, code } = req.body || {};

    if (typeof email !== 'string' || typeof code !== 'string' || !email.trim() || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email y código 2FA son requeridos',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select('+loginOtpCode +loginOtpExpiry +loginOtpAttempts');

    if (!user || user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Código inválido o expirado',
        code: 'INVALID_2FA_CODE',
      });
    }

    if ((user.loginOtpAttempts || 0) >= 5) {
      user.loginOtpCode = undefined;
      user.loginOtpExpiry = undefined;
      await user.save();
      return res.status(429).json({
        success: false,
        message: 'Demasiados intentos fallidos. Inicia sesión nuevamente.',
        code: 'TOO_MANY_ATTEMPTS',
      });
    }

    if (!user.loginOtpCode || !user.loginOtpExpiry || user.loginOtpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'El código 2FA ha expirado. Inicia sesión nuevamente.',
        code: 'CODE_EXPIRED',
      });
    }

    if (!compareVerificationCode(code.trim(), user.loginOtpCode)) {
      user.loginOtpAttempts = (user.loginOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Código 2FA incorrecto',
        code: 'INVALID_2FA_CODE',
      });
    }

    user.loginOtpCode = undefined;
    user.loginOtpExpiry = undefined;
    user.loginOtpAttempts = 0;
    await user.save();

    const token = generateToken(user);
    logAuthEvent('ADMIN_2FA_LOGIN_SUCCESS', normalizedEmail, req.ip, true);
    await logAdminAction({
      req,
      action: 'ADMIN_2FA_LOGIN',
      category: 'security',
      targetType: 'User',
      targetId: user._id,
      summary: `Acceso administrativo verificado por 2FA (${normalizedEmail})`,
      adminEmailOverride: normalizedEmail,
    });

    res.json({
      success: true,
      message: 'Inicio de sesión verificado',
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
    console.error('Error en verifyLogin2FA:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al validar código 2FA',
    });
  }
}

module.exports = {
  getFormToken,
  register,
  verifyEmail,
  verifyLogin2FA,
  resendCode,
  login,
  getProfile,
  upgradeToPremium,
  forgotPassword,
  resetPassword,
};
