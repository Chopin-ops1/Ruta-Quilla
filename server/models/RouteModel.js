/**
 * ============================================
 * RutaQuilla - Route Model v5
 * ============================================
 *
 * Modelo de datos reestructurado con base en el
 * análisis oficial de rutas del TPC de Barranquilla.
 *
 * Cambios v5:
 * - Código oficial de ruta (C20, B1, A3, etc.)
 * - Origen/Destino textuales
 * - Barrios cubiertos
 * - Recorrido textual (ida/regreso)
 * - tieneParadas: true solo para Transmetro BRT
 * - Geometría GeoJSON con waypoints en cada intersección
 */

const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  nombre: { type: String, required: false },
  coordenadas: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },
}, { _id: false });

const segmentSchema = new mongoose.Schema({
  puntoPartida: { type: pointSchema, required: true },
  puntoFinal: { type: pointSchema, required: true },
  trazado: {
    type: { type: String, enum: ['LineString'], default: 'LineString' },
    coordinates: {
      type: [[Number]], // Array of [lng, lat]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length >= 2;
        },
        message: 'El trazado debe tener al menos 2 coordenadas',
      },
    },
  },
}, { _id: false });

const routeSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre de la ruta es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder los 100 caracteres'],
  },
  externalId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    index: true,
  },
  codigo: {
    type: String,
    trim: true,
    index: true,
  },
  descripcion: {
    type: String,
    trim: true,
    default: '',
  },
  operador: {
    type: String,
    required: [true, 'El operador de la ruta es obligatorio'],
    trim: true,
    index: true,
    maxlength: [100, 'El operador no puede exceder los 100 caracteres'],
  },
  sistema: {
    type: String,
    enum: ['urbano', 'masivo'],
    default: 'urbano',
    index: true,
  },
  tipoVehiculo: {
    type: String,
    default: 'bus',
  },
  tipoRecorrido: {
    type: String,
    enum: ['circular', 'lineal'],
    default: 'circular',
  },
  esIntermunicipal: {
    type: Boolean,
    default: false,
    index: true,
  },
  distanciaKm: {
    type: Number,
    default: 0,
  },
  tieneRegreso: {
    type: Boolean,
    default: false,
  },
  origen: {
    type: String,
    trim: true,
  },
  destino: {
    type: String,
    trim: true,
  },
  barriosCubiertos: [{
    type: String,
    trim: true,
  }],
  horarios: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  metodosPago: [{
    type: String,
    trim: true,
  }],
  paradas: [{
    orden: Number,
    indice: Number,
    sentido: String,
    nombre: String,
    lat: Number,
    lng: Number,
    _id: false,
  }],
  actualizadoFuente: {
    type: Date,
    default: null,
  },
  recorridoTextual: {
    ida: { type: String, default: '' },
    regreso: { type: String, default: '' },
  },
  color: {
    type: String,
    default: '#06B6D4',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color hexadecimal inválido'],
  },
  // Solo Transmetro BRT tiene paradas fijas.
  // Buses cooperativos: el pasajero baja donde desee dentro de la ruta.
  tieneParadas: {
    type: Boolean,
    default: false,
  },
  geometriaOSM: {
    type: Boolean,
    default: false,
  },
  ida: { type: segmentSchema, required: true },
  regreso: { type: segmentSchema, required: false, default: undefined },
  activa: {
    type: Boolean,
    default: true,
  },
  trazadoIncompleto: {
    type: Boolean,
    default: false,
  },
  audit: {
    revisadoManualmente: {
      type: Boolean,
      default: false,
    },
    observaciones: {
      type: String,
      default: '',
    },
  },
  fuente: {
    type: String,
    enum: ['openstreetmap', 'nominatim', 'geocoded', 'manual', 'google_maps_verified', 'dataset_2026'],
    required: true,
  },
  // Metadata AMBQ
  codigoAMBQ: {
    type: String,
    trim: true,
  },
  resolucionPdf: {
    type: String,
    trim: true,
  },
  // Retrocompatibilidad
  type: {
    type: String,
    enum: ['official', 'community'],
    default: 'official',
  },
  fare: {
    type: Number,
    default: 3700,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
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

/**
 * Índices 2dsphere para búsquedas geoespaciales $geoNear
 */
routeSchema.index({ 'ida.trazado': '2dsphere' });
routeSchema.index({ 'regreso.trazado': '2dsphere' });
routeSchema.index({ 'ida.puntoPartida.coordenadas': '2dsphere' });
routeSchema.index({ 'ida.puntoFinal.coordenadas': '2dsphere' });
routeSchema.index({ 'regreso.puntoPartida.coordenadas': '2dsphere' });
routeSchema.index({ 'regreso.puntoFinal.coordenadas': '2dsphere' });

module.exports = mongoose.models.Route || mongoose.model('Route', routeSchema);
