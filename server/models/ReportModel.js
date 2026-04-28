/**
 * ============================================
 * RutaQuilla - Modelo de Reportes en Tiempo Real
 * ============================================
 *
 * Reportes de incidencias en el transporte público:
 * - Desvío de ruta
 * - Ruta cancelada / no salió
 * - Parada peligrosa o inundada
 * - Tráfico pesado
 * - Accidente
 * - Otro
 *
 * Features:
 * - Ruta afectada es OBLIGATORIA (ref a Route)
 * - TTL auto-expiry (1h base, hasta 2h con confirmaciones)
 * - Sistema de confirmación (+15 min por cada)
 * - Sistema de dismissal (3 votos = reporte removido)
 * - Admin puede eliminar reportes directamente
 */

const mongoose = require('mongoose');

const REPORT_TYPES = [
  'desvio',       // Bus tomó una ruta diferente
  'cancelada',    // Ruta no salió hoy
  'trafico',      // Tráfico pesado en la zona
  'peligro',      // Zona peligrosa o insegura
  'inundacion',   // Calle inundada (común en Barranquilla)
  'accidente',    // Accidente de tránsito
  'otro',
];

const DISMISS_REASONS = [
  'invalido',     // Reporte falso o incorrecto
  'solucionado',  // El problema ya se resolvió
  'vencido',      // Ya no aplica / situación cambió
];

const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: REPORT_TYPES,
    required: [true, 'El tipo de reporte es obligatorio'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'La descripción no puede exceder 200 caracteres'],
    default: '',
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [lng, lat]
      required: [true, 'La ubicación es obligatoria'],
    },
  },
  locationName: {
    type: String,
    trim: true,
    default: '',
  },

  // ---- Ruta afectada (OBLIGATORIO) ----
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: [true, 'La ruta afectada es obligatoria'],
  },
  routeName: {
    type: String,
    trim: true,
    required: [true, 'El nombre de la ruta es obligatorio'],
  },
  routeCodigo: {
    type: String,
    trim: true,
    default: '',
  },

  // ---- Usuario que reportó ----
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },

  // ---- Confirmaciones (otros usuarios validan) ----
  confirmations: {
    type: Number,
    default: 0,
    min: 0,
  },
  confirmedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // ---- Dismissals (usuarios votan para quitar) ----
  dismissals: {
    type: Number,
    default: 0,
    min: 0,
  },
  dismissedBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, enum: DISMISS_REASONS },
  }],

  // ---- Status: el reporte puede ser activo o removido ----
  status: {
    type: String,
    enum: ['active', 'dismissed', 'admin_removed'],
    default: 'active',
  },
  removedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  removeReason: {
    type: String,
    default: '',
  },

  // ---- TTL: auto-expiry ----
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hora
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

// Índice 2dsphere para búsquedas geoespaciales
reportSchema.index({ location: '2dsphere' });

// Índice TTL: MongoDB auto-borra cuando expiresAt < now
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Índice para buscar reportes activos por ruta
reportSchema.index({ routeId: 1, status: 1, expiresAt: -1 });

// Índice para buscar por status + fecha
reportSchema.index({ status: 1, createdAt: -1 });

// Dismiss threshold: si 3+ usuarios votan, se remueve automáticamente
reportSchema.statics.DISMISS_THRESHOLD = 3;

const Report = mongoose.model('Report', reportSchema);
Report.REPORT_TYPES = REPORT_TYPES;
Report.DISMISS_REASONS = DISMISS_REASONS;

module.exports = Report;
