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
 * - Otro
 *
 * Los reportes expiran automáticamente (TTL) después de 1h.
 * MongoDB borra documentos expirados via el índice TTL.
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
  // Nombre legible de la ubicación (reverse geocoded)
  locationName: {
    type: String,
    trim: true,
    default: '',
  },
  // Ruta asociada (opcional — ej: "C20 desvió por Calle 30")
  routeName: {
    type: String,
    trim: true,
    default: '',
  },
  // Usuario que reportó
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  // Votos de confirmación (otros usuarios validan el reporte)
  confirmations: {
    type: Number,
    default: 0,
    min: 0,
  },
  confirmedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  // Tiempo de expiración — MongoDB TTL index borra el doc automáticamente
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

// Índice para buscar reportes activos rápidamente
reportSchema.index({ expiresAt: -1, type: 1 });

const Report = mongoose.model('Report', reportSchema);
Report.REPORT_TYPES = REPORT_TYPES;

module.exports = Report;
