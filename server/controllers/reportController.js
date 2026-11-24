/**
 * ============================================
 * RutaQuilla - Report Controller
 * ============================================
 *
 * Endpoints para reportes en tiempo real:
 * - POST   /api/reports          — Crear reporte (auth, routeId obligatorio)
 * - GET    /api/reports/active    — Reportes activos (público)
 * - POST   /api/reports/:id/confirm — Confirmar un reporte (auth)
 * - POST   /api/reports/:id/dismiss — Votar para remover (auth)
 * - GET    /api/reports/types     — Tipos disponibles
 * - GET    /api/reports/affected/:routeId — ¿La ruta tiene reportes activos?
 * - GET    /api/reports/admin     — Todos los reportes para admin
 * - DELETE /api/reports/admin/:id — Admin elimina un reporte
 */

const Report = require('../models/ReportModel');
const User = require('../models/UserModel');
const Route = require('../models/RouteModel');
const { isValidObjectId, isValidCoord } = require('../middleware/security');

const TYPE_META = {
  desvio:     { emoji: '🔀', label: 'Desvío de ruta',    color: '#F59E0B' },
  cancelada:  { emoji: '🚫', label: 'Ruta cancelada',    color: '#EF4444' },
  trafico:    { emoji: '🚗', label: 'Tráfico pesado',    color: '#F97316' },
  peligro:    { emoji: '⚠️', label: 'Zona peligrosa',    color: '#DC2626' },
  inundacion: { emoji: '🌊', label: 'Calle inundada',    color: '#3B82F6' },
  accidente:  { emoji: '💥', label: 'Accidente',         color: '#A855F7' },
  otro:       { emoji: '📌', label: 'Otro',              color: '#64748B' },
};

const DISMISS_LABELS = {
  invalido:    '❌ Reporte inválido',
  solucionado: '✅ Problema solucionado',
  vencido:     '⏰ Ya no aplica',
};

/**
 * POST /api/reports
 * Crear un nuevo reporte. routeId es OBLIGATORIO.
 */
async function createReport(req, res) {
  try {
    const { type, description, location, routeId, locationName } = req.body || {};

    const lat = parseFloat(location?.lat);
    const lng = parseFloat(location?.lng);

    if (!type || !isValidCoord(lat, lng, true)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere tipo de reporte y una ubicación válida en Barranquilla / Atlántico',
      });
    }

    if (!routeId || !isValidObjectId(routeId)) {
      return res.status(400).json({
        success: false,
        message: 'Debes seleccionar una ruta de bus válida',
      });
    }

    if (!Report.REPORT_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Tipo inválido. Opciones: ${Report.REPORT_TYPES.join(', ')}`,
      });
    }

    const route = await Route.findById(routeId).select('nombre codigo').lean();
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'La ruta seleccionada no existe',
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

    const cleanDescription = typeof description === 'string' ? description.trim().slice(0, 200) : '';
    const cleanLocationName = typeof locationName === 'string' ? locationName.trim().slice(0, 120) : '';

    const report = new Report({
      type,
      description: cleanDescription,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      locationName: cleanLocationName,
      routeId: route._id,
      routeName: route.nombre,
      routeCodigo: route.codigo || '',
      userId: req.user._id,
      userName: req.user.name,
    });

    await report.save();

    // Award +10 XP
    let xpResult = null;
    try {
      const user = await User.findById(req.user._id);
      if (user) xpResult = await user.awardXP(10);
    } catch (xpErr) {
      console.warn('XP award failed for report:', xpErr.message);
    }

    const meta = TYPE_META[type] || TYPE_META.otro;

    res.status(201).json({
      success: true,
      message: `${meta.emoji} Reporte creado. ¡Gracias por informar!`,
      data: { _id: report._id, type: report.type, ...meta, expiresAt: report.expiresAt },
      xp: xpResult,
    });
  } catch (error) {
    console.error('Error al crear reporte:', error);
    res.status(500).json({ success: false, message: 'Error al crear el reporte' });
  }
}

/**
 * GET /api/reports/active?lat=X&lng=Y&radius=5000
 * Reportes activos (no expirados, no dismissed).
 */
async function getActiveReports(req, res) {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    const cappedRadius = Math.min(Math.max(parseInt(radius, 10) || 5000, 100), 10000);

    const filter = { expiresAt: { $gt: new Date() }, status: 'active' };
    let reports;

    if (lat !== undefined && lng !== undefined) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (!isValidCoord(parsedLat, parsedLng)) {
        return res.status(400).json({
          success: false,
          message: 'Coordenadas inválidas',
        });
      }

      reports = await Report.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [parsedLng, parsedLat] },
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
            routeId: 1, routeName: 1, routeCodigo: 1,
            userName: 1, confirmations: 1, dismissals: 1,
            createdAt: 1, expiresAt: 1, distance: { $round: ['$distance', 0] },
          },
        },
      ]);
    } else {
      reports = await Report.find(filter)
        .select('type description location locationName routeId routeName routeCodigo userName confirmations dismissals createdAt expiresAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    }

    const enriched = reports.map(r => ({
      ...r,
      ...(TYPE_META[r.type] || TYPE_META.otro),
      minutesAgo: Math.round((Date.now() - new Date(r.createdAt).getTime()) / 60000),
      minutesLeft: Math.max(0, Math.round((new Date(r.expiresAt).getTime() - Date.now()) / 60000)),
    }));

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    console.error('Error al obtener reportes:', error);
    res.status(500).json({ success: false, message: 'Error al obtener reportes' });
  }
}

/**
 * POST /api/reports/:id/confirm
 * Confirmar reporte (+2 XP, +15 min visibilidad, max 2h).
 */
async function confirmReport(req, res) {
  try {
    const now = new Date();
    const report = await Report.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'active',
        expiresAt: { $gt: now },
        userId: { $ne: req.user._id },
        confirmedBy: { $ne: req.user._id },
      },
      {
        $inc: { confirmations: 1 },
        $addToSet: { confirmedBy: req.user._id },
      },
      { new: true }
    );

    if (!report) {
      const existing = await Report.findById(req.params.id).select('status expiresAt userId').lean();
      if (!existing || existing.status !== 'active') {
        return res.status(404).json({ success: false, message: 'Reporte no encontrado o inactivo' });
      }
      if (existing.expiresAt < now) {
        return res.status(410).json({ success: false, message: 'Este reporte ya expiró' });
      }
      if (existing.userId.toString() === req.user._id.toString()) {
        return res.status(409).json({ success: false, message: 'No puedes confirmar tu propio reporte' });
      }
      return res.status(409).json({ success: false, message: 'Ya confirmaste este reporte' });
    }

    const maxExpiry = new Date(report.createdAt.getTime() + 2 * 60 * 60 * 1000);
    const newExpiry = new Date(report.expiresAt.getTime() + 15 * 60 * 1000);
    const clampedExpiry = newExpiry < maxExpiry ? newExpiry : maxExpiry;
    if (clampedExpiry.getTime() !== report.expiresAt.getTime()) {
      report.expiresAt = clampedExpiry;
      await Report.updateOne({ _id: report._id }, { $set: { expiresAt: clampedExpiry } });
    }

    try {
      const user = await User.findById(req.user._id);
      if (user) await user.awardXP(2);
    } catch (_) {}

    res.json({
      success: true,
      message: '✅ Reporte confirmado. +15 min de visibilidad.',
      data: { confirmations: report.confirmations, expiresAt: report.expiresAt },
    });
  } catch (error) {
    console.error('Error al confirmar:', error);
    res.status(500).json({ success: false, message: 'Error al confirmar' });
  }
}

/**
 * POST /api/reports/:id/dismiss
 * Votar para remover un reporte.
 * Body: { reason: 'invalido' | 'solucionado' | 'vencido' }
 * Si alcanza DISMISS_THRESHOLD (3), se marca como dismissed.
 */
async function dismissReport(req, res) {
  try {
    const { reason } = req.body || {};
    if (!reason || !Report.DISMISS_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Razón requerida: ${Report.DISMISS_REASONS.join(', ')}`,
      });
    }

    const report = await Report.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'active',
        'dismissedBy.userId': { $ne: req.user._id },
      },
      {
        $inc: { dismissals: 1 },
        $push: { dismissedBy: { userId: req.user._id, reason } },
      },
      { new: true }
    );

    if (!report) {
      const existing = await Report.findById(req.params.id).select('status').lean();
      if (!existing || existing.status !== 'active') {
        return res.status(404).json({ success: false, message: 'Reporte no encontrado o ya removido' });
      }
      return res.status(409).json({ success: false, message: 'Ya votaste para remover este reporte' });
    }

    // Auto-remove if threshold reached
    if (report.dismissals >= Report.DISMISS_THRESHOLD) {
      const removeReason = `Removido por comunidad (${report.dismissals} votos)`;
      await Report.updateOne(
        { _id: report._id, status: 'active' },
        { $set: { status: 'dismissed', removeReason } }
      );
      report.status = 'dismissed';
      report.removeReason = removeReason;
    }

    const remaining = Math.max(0, Report.DISMISS_THRESHOLD - report.dismissals);

    res.json({
      success: true,
      message: report.status === 'dismissed'
        ? '🗑️ Reporte removido por la comunidad'
        : `📊 Voto registrado. Faltan ${remaining} para remover.`,
      data: {
        dismissals: report.dismissals,
        status: report.status,
        remaining,
      },
    });
  } catch (error) {
    console.error('Error al votar dismiss:', error);
    res.status(500).json({ success: false, message: 'Error al procesar el voto' });
  }
}

/**
 * GET /api/reports/affected/:routeId
 * ¿Esta ruta tiene reportes activos? Retorna los reportes.
 */
async function getAffectedReports(req, res) {
  try {
    const reports = await Report.find({
      routeId: req.params.id,
      status: 'active',
      expiresAt: { $gt: new Date() },
    })
    .select('type description routeName routeCodigo userName confirmations dismissals createdAt expiresAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    const enriched = reports.map(r => ({
      ...r,
      ...(TYPE_META[r.type] || TYPE_META.otro),
      minutesAgo: Math.round((Date.now() - new Date(r.createdAt).getTime()) / 60000),
    }));

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    console.error('Error affected reports:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
}

/**
 * GET /api/reports/types
 */
async function getReportTypes(req, res) {
  const types = Report.REPORT_TYPES.map(id => ({
    id, ...(TYPE_META[id] || TYPE_META.otro),
  }));
  const reasons = Report.DISMISS_REASONS.map(id => ({
    id, label: DISMISS_LABELS[id] || id,
  }));
  res.json({ success: true, data: types, dismissReasons: reasons });
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * GET /api/reports/admin?status=active&type=desvio&page=1
 * Lista paginada de reportes para el panel admin.
 */
async function adminGetReports(req, res) {
  try {
    const { status, type, page = 1 } = req.query;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const limit = 20;
    const skip = (safePage - 1) * limit;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (type && type !== 'all') filter.type = type;

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .select('type description location locationName routeId routeName routeCodigo userName userId confirmations dismissals status removeReason createdAt expiresAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(filter),
    ]);

    const enriched = reports.map(r => ({
      ...r,
      ...(TYPE_META[r.type] || TYPE_META.otro),
      isExpired: new Date(r.expiresAt) < new Date(),
      minutesAgo: Math.round((Date.now() - new Date(r.createdAt).getTime()) / 60000),
    }));

    // Stats summary
    const stats = await Report.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: enriched,
      total,
      page: safePage,
      totalPages: Math.ceil(total / limit),
      stats: stats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    });
  } catch (error) {
    console.error('Error admin reports:', error);
    res.status(500).json({ success: false, message: 'Error al obtener reportes' });
  }
}

/**
 * DELETE /api/reports/admin/:id
 * Admin elimina un reporte con razón.
 */
async function adminDeleteReport(req, res) {
  try {
    const { reason } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
    }

    report.status = 'admin_removed';
    report.removedBy = req.user._id;
    report.removeReason = reason || 'Removido por administrador';
    await report.save();

    res.json({
      success: true,
      message: '🗑️ Reporte removido por admin',
    });
  } catch (error) {
    console.error('Error admin delete report:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar reporte' });
  }
}

module.exports = {
  createReport, getActiveReports, confirmReport, dismissReport,
  getReportTypes, getAffectedReports, adminGetReports, adminDeleteReport,
};
