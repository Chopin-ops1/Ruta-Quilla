/**
 * ============================================
 * RutaQuilla - Report Controller
 * ============================================
 *
 * Endpoints para reportes en tiempo real:
 * - POST   /api/reports          — Crear reporte (auth)
 * - GET    /api/reports/active    — Reportes activos cerca de un punto (público)
 * - POST   /api/reports/:id/confirm — Confirmar un reporte (auth)
 * - GET    /api/reports/types     — Tipos de reporte disponibles
 */

const Report = require('../models/ReportModel');
const User = require('../models/UserModel');

// Emojis + labels para cada tipo
const TYPE_META = {
  desvio:     { emoji: '🔀', label: 'Desvío de ruta',    color: '#F59E0B' },
  cancelada:  { emoji: '🚫', label: 'Ruta cancelada',    color: '#EF4444' },
  trafico:    { emoji: '🚗', label: 'Tráfico pesado',    color: '#F97316' },
  peligro:    { emoji: '⚠️', label: 'Zona peligrosa',    color: '#DC2626' },
  inundacion: { emoji: '🌊', label: 'Calle inundada',    color: '#3B82F6' },
  accidente:  { emoji: '💥', label: 'Accidente',         color: '#A855F7' },
  otro:       { emoji: '📌', label: 'Otro',              color: '#64748B' },
};

/**
 * POST /api/reports
 * Crear un nuevo reporte de incidencia.
 * Body: { type, description?, location: { lat, lng }, routeName?, locationName? }
 *
 * Otorga +10 XP al usuario que reporta.
 */
async function createReport(req, res) {
  try {
    const { type, description, location, routeName, locationName } = req.body;

    if (!type || !location?.lat || !location?.lng) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: type, location { lat, lng }',
      });
    }

    if (!Report.REPORT_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Tipo inválido. Opciones: ${Report.REPORT_TYPES.join(', ')}`,
      });
    }

    // Rate limit: max 5 reports per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await Report.countDocuments({
      userId: req.user._id,
      createdAt: { $gt: oneHourAgo },
    });
    if (recentCount >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Máximo 5 reportes por hora. Intenta más tarde.',
      });
    }

    const report = new Report({
      type,
      description: (description || '').slice(0, 200),
      location: {
        type: 'Point',
        coordinates: [parseFloat(location.lng), parseFloat(location.lat)],
      },
      locationName: locationName || '',
      routeName: routeName || '',
      userId: req.user._id,
      userName: req.user.name,
    });

    await report.save();

    // Award +10 XP for reporting
    let xpResult = null;
    try {
      const user = await User.findById(req.user._id);
      if (user) {
        xpResult = await user.awardXP(10);
      }
    } catch (xpErr) {
      console.warn('XP award failed for report:', xpErr.message);
    }

    const meta = TYPE_META[type] || TYPE_META.otro;

    res.status(201).json({
      success: true,
      message: `${meta.emoji} Reporte creado. ¡Gracias por informar!`,
      data: {
        _id: report._id,
        type: report.type,
        ...meta,
        expiresAt: report.expiresAt,
      },
      xp: xpResult,
    });
  } catch (error) {
    console.error('Error al crear reporte:', error);
    res.status(500).json({ success: false, message: 'Error al crear el reporte' });
  }
}

/**
 * GET /api/reports/active?lat=X&lng=Y&radius=5000
 * Retorna reportes activos (no expirados) cerca de un punto.
 * Público — no requiere autenticación.
 */
async function getActiveReports(req, res) {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    const cappedRadius = Math.min(parseInt(radius) || 5000, 10000); // max 10km

    const filter = { expiresAt: { $gt: new Date() } };
    let reports;

    if (lat && lng) {
      // Geospatial query
      reports = await Report.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            distanceField: 'distance',
            maxDistance: cappedRadius,
            spherical: true,
            query: filter,
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 50 },
        {
          $project: {
            type: 1, description: 1, location: 1, locationName: 1,
            routeName: 1, userName: 1, confirmations: 1,
            createdAt: 1, expiresAt: 1, distance: { $round: ['$distance', 0] },
          },
        },
      ]);
    } else {
      // No location — just get recent active reports
      reports = await Report.find(filter)
        .select('type description location locationName routeName userName confirmations createdAt expiresAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    }

    // Enrich with type metadata
    const enriched = reports.map(r => ({
      ...r,
      ...(TYPE_META[r.type] || TYPE_META.otro),
      minutesAgo: Math.round((Date.now() - new Date(r.createdAt).getTime()) / 60000),
      minutesLeft: Math.max(0, Math.round((new Date(r.expiresAt).getTime() - Date.now()) / 60000)),
    }));

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error('Error al obtener reportes:', error);
    res.status(500).json({ success: false, message: 'Error al obtener reportes' });
  }
}

/**
 * POST /api/reports/:id/confirm
 * Confirmar un reporte (autenticado, máx 1 confirmación por usuario).
 * Otorga +2 XP al confirmador.
 */
async function confirmReport(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
    }

    if (report.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: 'Este reporte ya expiró' });
    }

    // Check if already confirmed by this user
    if (report.confirmedBy.includes(req.user._id)) {
      return res.status(409).json({ success: false, message: 'Ya confirmaste este reporte' });
    }

    // Can't confirm your own report
    if (report.userId.toString() === req.user._id.toString()) {
      return res.status(409).json({ success: false, message: 'No puedes confirmar tu propio reporte' });
    }

    report.confirmations += 1;
    report.confirmedBy.push(req.user._id);

    // Each confirmation extends expiry by 15 min (max 2 hours total)
    const maxExpiry = new Date(report.createdAt.getTime() + 2 * 60 * 60 * 1000);
    const newExpiry = new Date(report.expiresAt.getTime() + 15 * 60 * 1000);
    report.expiresAt = newExpiry < maxExpiry ? newExpiry : maxExpiry;

    await report.save();

    // Award +2 XP for confirming
    try {
      const user = await User.findById(req.user._id);
      if (user) await user.awardXP(2);
    } catch (xpErr) {
      console.warn('XP award for confirm failed:', xpErr.message);
    }

    res.json({
      success: true,
      message: '✅ Reporte confirmado. +15 min de visibilidad.',
      data: { confirmations: report.confirmations, expiresAt: report.expiresAt },
    });
  } catch (error) {
    console.error('Error al confirmar reporte:', error);
    res.status(500).json({ success: false, message: 'Error al confirmar' });
  }
}

/**
 * GET /api/reports/types
 * Tipos de reporte disponibles con metadatos.
 */
async function getReportTypes(req, res) {
  const types = Report.REPORT_TYPES.map(id => ({
    id,
    ...(TYPE_META[id] || TYPE_META.otro),
  }));
  res.json({ success: true, data: types });
}

module.exports = { createReport, getActiveReports, confirmReport, getReportTypes };
