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

/**
 * Hook pre-save: Hashear la contraseña antes de guardar
 * 
 * Usa bcryptjs con un salt de 12 rondas para un balance
 * entre seguridad y rendimiento. Solo hashea si la
 * contraseña fue modificada (evita re-hash en updates).
 */
userSchema.pre('save', async function(next) {
  // Sincronizar isPremium con el rol (siempre)
  this.isPremium = this.role === 'premium' || this.role === 'admin';

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
 * Método de instancia: Comparar contraseña ingresada con el hash
 * 
 * @param {string} candidatePassword - Contraseña en texto plano
 * @returns {Promise<boolean>} true si coincide, false si no
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Método estático: Buscar usuario por email incluyendo la contraseña
 * (necesario para el login, ya que password tiene select: false)
 */
userSchema.statics.findByCredentials = async function(email) {
  return this.findOne({ email }).select('+password');
};

module.exports = mongoose.model('User', userSchema);
