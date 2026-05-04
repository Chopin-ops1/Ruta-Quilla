/**
 * ============================================
 * RutaQuilla - Composite Route Model
 * ============================================
 *
 * Modelo para rutas compuestas construidas colaborativamente
 * a partir de múltiples capturas GPS de diferentes usuarios.
 *
 * Flujo: Captura parcial → Merge automático → Admin revisa → Promueve a oficial
 *
 * Cada CompositeRoute agrupa segmentos de la misma ruta+empresa+dirección
 * y mantiene una geometría fusionada que crece con cada contribución.
 */

const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  // Referencia a la captura original
  captureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CapturedRoute',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },

  // Puntos extremos del segmento contribuido
  startPoint: {
    type: [Number], // [lng, lat]
    required: true,
  },
  endPoint: {
    type: [Number], // [lng, lat]
    required: true,
  },

  // Metadata de calidad
  pointCount: {
    type: Number,
    default: 0,
  },
  averageAccuracy: {
    type: Number,
    default: 0,
  },

  // Rango que cubre en la geometría fusionada (índices de coordenadas)
  overlapRange: {
    fromIndex: { type: Number, default: 0 },
    toIndex: { type: Number, default: 0 },
  },

  addedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const compositeRouteSchema = new mongoose.Schema({
  // ---- Identificación de ruta ----
  routeName: {
    type: String,
    required: [true, 'El nombre de la ruta es obligatorio'],
    trim: true,
    index: true,
  },
  company: {
    type: String,
    required: [true, 'La empresa es obligatoria'],
    trim: true,
    index: true,
  },
  direction: {
    type: String,
    enum: ['ida', 'vuelta'],
    required: [true, 'La dirección (ida/vuelta) es obligatoria'],
  },

  // ---- Geometría fusionada ----
  mergedGeometry: {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString',
    },
    coordinates: {
      type: [[Number]], // Array of [lng, lat]
      required: true,
      validate: {
        validator: function (coords) {
          return coords.length >= 2;
        },
        message: 'La geometría fusionada debe tener al menos 2 coordenadas',
      },
    },
  },

  // ---- Segmentos contribuidos ----
  segments: [segmentSchema],

  // ---- Métricas ----
  totalLength: {
    type: Number, // Longitud total en metros
    default: 0,
  },
  contributorCount: {
    type: Number,
    default: 0,
  },
  lastContribution: {
    type: Date,
    default: Date.now,
  },

  // ---- Estado ----
  status: {
    type: String,
    enum: ['building', 'complete', 'promoted'],
    default: 'building',
    index: true,
  },
  completionEstimate: {
    type: Number, // 0-100
    default: 0,
    min: 0,
    max: 100,
  },

  // ---- Promoción a ruta oficial ----
  promotedRouteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  },
  promotedAt: {
    type: Date,
  },
  promotedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

// ---- Índices ----

// Índice compuesto único: solo un composite por ruta+empresa+dirección
compositeRouteSchema.index(
  { routeName: 1, company: 1, direction: 1 },
  { unique: true }
);

// Geoespacial para búsqueda de proximidad
compositeRouteSchema.index({ 'mergedGeometry': '2dsphere' });

// Para consultas admin por estado
compositeRouteSchema.index({ status: 1, lastContribution: -1 });

module.exports = mongoose.models.CompositeRoute || mongoose.model('CompositeRoute', compositeRouteSchema);
