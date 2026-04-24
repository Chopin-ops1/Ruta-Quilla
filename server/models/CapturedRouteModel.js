/**
 * ============================================
 * RutaQuilla - Captured Route Model
 * ============================================
 *
 * Modelo para rutas capturadas por la comunidad via GPS.
 * Separado del RouteModel oficial para flujo de verificación.
 *
 * Flujo: Usuario captura → admin revisa → aprueba/rechaza
 */

const mongoose = require('mongoose');

const capturedRouteSchema = new mongoose.Schema({
  // ---- Route identification ----
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

  // ---- GPS data ----
  boardingPoint: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },
  geometry: {
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
        message: 'Se requieren al menos 2 coordenadas',
      },
    },
  },
  pointCount: {
    type: Number,
    default: 0,
  },
  averageAccuracy: {
    type: Number,
    default: 0,
  },
  durationSeconds: {
    type: Number,
    default: 0,
  },

  // ---- User who captured ----
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },

  // ---- Review status ----
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  adminNotes: {
    type: String,
    default: '',
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
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

// Geospatial indexes
capturedRouteSchema.index({ 'boardingPoint': '2dsphere' });
capturedRouteSchema.index({ 'geometry': '2dsphere' });

// Compound index for comparing captures of the same route
capturedRouteSchema.index({ routeName: 1, company: 1, status: 1 });

module.exports = mongoose.models.CapturedRoute || mongoose.model('CapturedRoute', capturedRouteSchema);
