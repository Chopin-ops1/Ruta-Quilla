/**
 * ============================================
 * RutaQuilla - Modelo de Usuario (Freemium)
 * ============================================
 * 
 * Esquema Mongoose para usuarios con sistema de roles:
 * - free: Acceso básico con publicidad inyectada en el mapa
 * - premium (Quilla-Pass): Sin publicidad + descarga offline
 * 
 * La contraseña se hashea automáticamente con bcryptjs
 * antes de guardarse en la base de datos.
 * 
 * Sistema comunitario integrado:
 * - xp: Puntos ganados por contribuciones
 * - level: Nivel calculado automáticamente (1–5)
 * - badges: Insignias desbloqueadas
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Nombre completo del usuario
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [100, 'El nombre no puede exceder 100 caracteres'],
  },
  // Email único para autenticación
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Por favor ingresa un email válido',
    ],
  },
  // Contraseña (se hashea automáticamente con pre-save hook)
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false, // No incluir en queries por defecto (seguridad)
  },
  /**
   * Rol del usuario en el sistema freemium:
   * - 'free': Acceso gratuito con limitaciones (publicidad, sin offline)
   * - 'premium': Quilla-Pass (sin publicidad, descarga offline, etc.)
   */
  role: {
    type: String,
    enum: {
      values: ['free', 'premium', 'admin'],
      message: 'Rol no válido: {VALUE}',
    },
    default: 'free',
  },
  // Flag rápido para verificar premium en middleware
  isPremium: {
    type: Boolean,
    default: false,
  },
  // Contador de rutas contribuidas por el usuario
  contributions: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Avatar o foto de perfil (URL)
  avatar: {
    type: String,
    default: '',
  },
  // ---- Email Verification ----
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationCode: {
    type: String,
    select: false, // No exponer en queries normales
  },
  verificationCodeExpiry: {
    type: Date,
    select: false,
  },

  // ============================================
  // Sistema Comunitario — Quilla XP
  // ============================================

  /**
   * Puntos de experiencia acumulados por el usuario.
   * Se ganan al contribuir con capturas de rutas y reportes.
   * Ver XP_LEVELS más abajo para los umbrales por nivel.
   */
  xp: {
    type: Number,
    default: 0,
    min: 0,
  },

  /**
   * Nivel calculado automáticamente desde el XP.
   * Se actualiza en el pre-save hook.
   * 1=Pasajero, 2=Colaborador, 3=Cartógrafo, 4=Quilla Builder, 5=Leyenda
   */
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 5,
  },

  /**
   * Insignias desbloqueadas. Cada elemento es el ID del badge.
   * Ejemplos: 'primera_captura', 'captura_x5', 'quilla_builder'
   */
  badges: {
    type: [String],
    default: [],
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret.password; // Nunca exponer la contraseña en JSON
      delete ret.__v;
      return ret;
    },
  },
});

// Virtual para XP necesario para el siguiente nivel
userSchema.virtual('nextLevelThreshold').get(function() {
  const currentLevelInfo = XP_LEVELS.find(l => l.level === this.level);
  const nextLevelInfo = XP_LEVELS.find(l => l.level === this.level + 1);
  return nextLevelInfo ? nextLevelInfo.minXP - this.xp : 0;
});

// ============================================
// Tabla de niveles XP (compartida con el frontend via API)
// ============================================
const XP_LEVELS = [
  { level: 1, name: 'Pasajero',       minXP: 0,    color: '#64748B' },
  { level: 2, name: 'Colaborador',    minXP: 100,  color: '#06B6D4' },
  { level: 3, name: 'Cartógrafo',     minXP: 300,  color: '#10B981' },
  { level: 4, name: 'Quilla Builder', minXP: 500,  color: '#F59E0B' },
  { level: 5, name: 'Leyenda',        minXP: 1000, color: '#8B5CF6' },
];

// Tabla de todas las insignias disponibles
const BADGE_DEFINITIONS = [
  { id: 'primera_captura',   label: '🗺️ Primera Captura',      desc: 'Capturaste tu primera ruta',  xpBonus: 20  },
  { id: 'captura_x5',        label: '🚌 Cartógrafo x5',        desc: '5 capturas aprobadas',        xpBonus: 30  },
  { id: 'captura_x10',       label: '🏅 Cartógrafo x10',       desc: '10 capturas aprobadas',       xpBonus: 50  },
  { id: 'captura_x25',       label: '🏆 Explorador del Caribe', desc: '25 capturas aprobadas',       xpBonus: 100 },
  { id: 'quilla_builder',    label: '⚡ Quilla Builder',        desc: '500 XP alcanzados',           xpBonus: 0   },
  { id: 'leyenda',           label: '👑 Leyenda',              desc: '1000 XP alcanzados',          xpBonus: 0   },
];

/**
 * Hook pre-save: Sincronizar isPremium y recalcular nivel desde XP.
 */
userSchema.pre('save', async function(next) {
  // Sincronizar isPremium con el rol
  this.isPremium = this.role === 'premium' || this.role === 'admin';

  // Recalcular nivel desde XP actual
  let newLevel = 1;
  for (const tier of XP_LEVELS) {
    if (this.xp >= tier.minXP) newLevel = tier.level;
  }
  this.level = newLevel;

  // Solo hashear si la contraseña fue modificada
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Método de instancia: Comparar contraseña ingresada con el hash.
 *
 * @param {string} candidatePassword - Contraseña en texto plano
 * @returns {Promise<boolean>} true si coincide, false si no
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Método de instancia: Otorgar XP y evaluar nuevas insignias automáticamente.
 * Persiste los cambios con save().
 *
 * @param {number} amount - Puntos XP a otorgar
 * @returns {Promise<{ newBadges: string[], levelUp: boolean, currentLevel: number, currentXP: number }>}
 */
userSchema.methods.awardXP = async function(amount) {
  const previousLevel = this.level;
  this.xp += amount;

  const newBadges = [];
  const earnedBadgeIds = new Set(this.badges);

  const check = (id, condition) => {
    if (condition && !earnedBadgeIds.has(id)) {
      this.badges.push(id);
      newBadges.push(id);
    }
  };

  // Evaluar insignias por cantidad de contribuciones aprobadas
  check('primera_captura', this.contributions >= 1);
  check('captura_x5',      this.contributions >= 5);
  check('captura_x10',     this.contributions >= 10);
  check('captura_x25',     this.contributions >= 25);

  // Evaluar insignias por XP total (se calculan después del incremento)
  check('quilla_builder', this.xp >= 500);
  check('leyenda',        this.xp >= 1000);

  await this.save();

  // Sprint 3: Email de incentivo al alcanzar 500 XP (Quilla Builder)
  if (newBadges.includes('quilla_builder')) {
    try {
      const { sendQuillaBuilderEmail } = require('../services/emailService');
      if (typeof sendQuillaBuilderEmail === 'function') {
        sendQuillaBuilderEmail(this.email, this.name).catch(e =>
          console.warn('Email Quilla Builder no enviado:', e.message)
        );
      }
    } catch (_) { /* emailService may not have this function yet */ }
  }

  return {
    newBadges,
    levelUp: this.level > previousLevel,
    currentLevel: this.level,
    currentXP: this.xp,
  };
};

/**
 * Método estático: Buscar usuario por email incluyendo la contraseña
 * (necesario para el login, ya que password tiene select: false).
 */
userSchema.statics.findByCredentials = async function(email) {
  return this.findOne({ email }).select('+password');
};

const User = mongoose.model('User', userSchema);

// Exportar constantes para reusar en controllers sin re-definirlas
User.XP_LEVELS = XP_LEVELS;
User.BADGE_DEFINITIONS = BADGE_DEFINITIONS;

module.exports = User;
