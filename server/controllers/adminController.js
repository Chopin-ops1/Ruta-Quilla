/**
 * ============================================
 * RutaQuilla - Admin Controller
 * ============================================
 *
 * Controlador para el panel de administración expandido.
 * Incluye: dashboard stats, gestión de capturas comunitarias,
 * comparación de trazados, y datos de tráfico.
 */

const User = require('../models/UserModel');
const Route = require('../models/RouteModel');
const CapturedRoute = require('../models/CapturedRouteModel');
const { getTrafficData } = require('../middleware/trafficTracker');
const { escapeRegex } = require('../middleware/security');

/**
 * GET /api/admin/dashboard
 * Returns overview stats for the admin dashboard.
 */
async function getDashboardStats(req, res) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      totalRoutes,
      pendingCaptures,
      approvedCaptures,
      rejectedCaptures,
      totalCaptures,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ updatedAt: { $gte: sevenDaysAgo } }),
      Route.countDocuments(),
      CapturedRoute.countDocuments({ status: 'pending' }),
      CapturedRoute.countDocuments({ status: 'approved' }),
      CapturedRoute.countDocuments({ status: 'rejected' }),
      CapturedRoute.countDocuments(),
    ]);

    // Recent captures (last 5)
    const recentCaptures = await CapturedRoute.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('routeName company direction userName status createdAt')
      .lean();

    // User role distribution
    const [freeUsers, premiumUsers, adminUsers] = await Promise.all([
      User.countDocuments({ role: 'free' }),
      User.countDocuments({ role: 'premium' }),
      User.countDocuments({ role: 'admin' }),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          free: freeUsers,
          premium: premiumUsers,
          admin: adminUsers,
        },
        routes: {
          total: totalRoutes,
        },
        captures: {
          total: totalCaptures,
          pending: pendingCaptures,
          approved: approvedCaptures,
          rejected: rejectedCaptures,
        },
        recentCaptures,
      },
    });
  } catch (error) {
    console.error('Error en dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
}

/**
 * GET /api/admin/captures
 * List all captured routes with optional filters.
 * Query: ?status=pending&company=Sobrusa&routeName=C20
 */
async function getCapturedRoutes(req, res) {
  try {
    const { status, company, routeName } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (company) filter.company = company;
    if (routeName) filter.routeName = { $regex: escapeRegex(routeName), $options: 'i' };

    const captures = await CapturedRoute.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email')
      .lean();

    res.json({ success: true, count: captures.length, data: captures });
  } catch (error) {
    console.error('Error al listar capturas:', error);
    res.status(500).json({ success: false, message: 'Error al listar capturas' });
  }
}

/**
 * GET /api/admin/captures/:id
 * Get full detail of a single capture.
 */
async function getCaptureById(req, res) {
  try {
    const capture = await CapturedRoute.findById(req.params.id)
      .populate('userId', 'name email contributions')
      .populate('reviewedBy', 'name email');

    if (!capture) {
      return res.status(404).json({ success: false, message: 'Captura no encontrada' });
    }

    res.json({ success: true, data: capture });
  } catch (error) {
    console.error('Error al obtener captura:', error);
    res.status(500).json({ success: false, message: 'Error al obtener captura' });
  }
}

/**
 * PUT /api/admin/captures/:id/review
 * Approve or reject a community capture.
 * Body: { status: 'approved'|'rejected', adminNotes: '...' }
 * 
 * XP otorgado al contribuidor:
 * - Aprobada: +50 XP (captura oficial incorporada)
 * - Rechazada con notas: +5 XP (incentivo por participación)
 */
async function reviewCapture(req, res) {
  try {
    const { status, adminNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status debe ser approved o rejected' });
    }

    const capture = await CapturedRoute.findById(req.params.id);
    if (!capture) {
      return res.status(404).json({ success: false, message: 'Captura no encontrada' });
    }

    capture.status = status;
    capture.adminNotes = adminNotes || '';
    capture.reviewedBy = req.user._id;
    capture.reviewedAt = new Date();
    await capture.save();

    // ---- Sistema XP ----
    let xpResult = null;
    if (capture.userId) {
      const contributor = await User.findById(capture.userId);
      if (contributor) {
        if (status === 'approved') {
          // Incrementar contribuciones antes de awardXP para que las insignias
          // de capturas se evalúen con el nuevo total.
          contributor.contributions += 1;
          xpResult = await contributor.awardXP(50);
        } else if (status === 'rejected' && adminNotes) {
          // XP simbólico por participar aunque sea rechazada
          xpResult = await contributor.awardXP(5);
        }
      }
    }

    res.json({
      success: true,
      message: `Captura ${status === 'approved' ? 'aprobada' : 'rechazada'}`,
      data: capture,
      xp: xpResult,
    });
  } catch (error) {
    console.error('Error al revisar captura:', error);
    res.status(500).json({ success: false, message: 'Error al revisar captura' });
  }
}


/**
 * GET /api/admin/captures/compare?routeName=X&company=Y
 * Find all captures matching a route name for side-by-side comparison.
 */
async function compareCaptures(req, res) {
  try {
    const { routeName, company } = req.query;
    if (!routeName) {
      return res.status(400).json({ success: false, message: 'routeName es requerido' });
    }

    const filter = { routeName: { $regex: escapeRegex(routeName), $options: 'i' } };
    if (company) filter.company = company;

    const captures = await CapturedRoute.find(filter)
      .sort({ createdAt: -1 })
      .select('routeName company direction geometry boardingPoint userName userId status averageAccuracy pointCount createdAt')
      .lean();

    res.json({ success: true, count: captures.length, data: captures });
  } catch (error) {
    console.error('Error al comparar capturas:', error);
    res.status(500).json({ success: false, message: 'Error al comparar capturas' });
  }
}

/**
 * GET /api/admin/traffic
 * Returns hourly request counts for the last 24 hours.
 */
async function getTrafficStats(req, res) {
  try {
    const data = getTrafficData();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener tráfico:', error);
    res.status(500).json({ success: false, message: 'Error al obtener datos de tráfico' });
  }
}

/**
 * GET /api/admin/users
 * List all users with basic info.
 */
async function getUsers(req, res) {
  try {
    const users = await User.find()
      .select('name email role isPremium contributions isVerified createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const enriched = users.map(u => ({
      ...u,
      isActive: new Date(u.updatedAt) >= sevenDaysAgo,
    }));

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ success: false, message: 'Error al listar usuarios' });
  }
}

/**
 * GET /api/admin/composites
 * List all composite routes (collaborative captures in progress).
 * Query: ?status=building&company=Sobrusa&routeName=C20
 */
async function getCompositeRoutes(req, res) {
  try {
    const CompositeRoute = require('../models/CompositeRouteModel');
    const { status, company, routeName } = req.query;
    const filter = {};
    const validStatuses = ['building', 'complete', 'promoted'];
    if (status && validStatuses.includes(status)) filter.status = status;
    if (company) filter.company = company;
    if (routeName) filter.routeName = { $regex: escapeRegex(routeName), $options: 'i' };

    const composites = await CompositeRoute.find(filter)
      .sort({ lastContribution: -1 })
      .populate('segments.userId', 'name email')
      .populate('promotedBy', 'name email')
      .lean();

    res.json({ success: true, count: composites.length, data: composites });
  } catch (error) {
    console.error('Error al listar composites:', error);
    res.status(500).json({ success: false, message: 'Error al listar rutas colaborativas' });
  }
}

/**
 * GET /api/admin/composites/:id
 * Get full detail of a composite route with all segments.
 */
async function getCompositeById(req, res) {
  try {
    const CompositeRoute = require('../models/CompositeRouteModel');
    const composite = await CompositeRoute.findById(req.params.id)
      .populate('segments.userId', 'name email contributions')
      .populate('segments.captureId', 'geometry averageAccuracy pointCount durationSeconds createdAt')
      .populate('promotedBy', 'name email')
      .populate('promotedRouteId', 'nombre operador');

    if (!composite) {
      return res.status(404).json({ success: false, message: 'Ruta colaborativa no encontrada' });
    }

    res.json({ success: true, data: composite });
  } catch (error) {
    console.error('Error al obtener composite:', error);
    res.status(500).json({ success: false, message: 'Error al obtener ruta colaborativa' });
  }
}

/**
 * POST /api/admin/composites/:id/promote
 * Promote a composite route to an official Route.
 *
 * Body: { origen?: string, destino?: string, color?: string, fare?: number }
 *
 * Creates a new Route document from the merged geometry and
 * marks the CompositeRoute as 'promoted'.
 *
 * XP: Awards 100 XP to each unique contributor.
 */
async function promoteComposite(req, res) {
  try {
    const CompositeRoute = require('../models/CompositeRouteModel');
    const composite = await CompositeRoute.findById(req.params.id);
    if (!composite) {
      return res.status(404).json({ success: false, message: 'Ruta colaborativa no encontrada' });
    }

    if (composite.status === 'promoted') {
      return res.status(400).json({ success: false, message: 'Esta ruta ya fue promovida a oficial' });
    }

    const { origen, destino, color, fare, codigo, codigoAMBQ } = req.body;
    const coords = composite.mergedGeometry.coordinates;

    // Assign color based on company
    const companyColors = {
      'Sobrusa': '#F59E0B', 'Coolitoral': '#06B6D4', 'Transmecar': '#10B981',
      'Sobusa': '#EAB308', 'Cootransnorte': '#8B5CF6', 'Embusa': '#EC4899',
      'Flota Angulo': '#F97316', 'Sodis': '#A855F7', 'Lolaya': '#EF4444',
      'Lucero San Felipe': '#F472B6', 'Coochofal': '#14B8A6', 'Cootrasol': '#22D3EE',
      'La Carolina': '#818CF8', 'Excolcar': '#3B82F6',
    };

    // Build official route from composite
    const routeData = {
      nombre: composite.routeName,
      operador: composite.company,
      color: color || companyColors[composite.company] || '#06B6D4',
      type: 'community', // Source is community collaboration
      fare: fare || 2600,
      fuente: 'manual',
      activa: true,
      trazadoIncompleto: false,
      geometriaOSM: false,
      audit: {
        revisadoManualmente: true,
        observaciones: `Promovida desde ruta colaborativa (${composite.contributorCount} contribuidores). Admin: ${req.user.email}`,
      },
    };

    // Set ida or regreso based on direction
    const segment = {
      puntoPartida: {
        nombre: origen || 'Inicio',
        coordenadas: { type: 'Point', coordinates: coords[0] },
      },
      puntoFinal: {
        nombre: destino || 'Final',
        coordenadas: { type: 'Point', coordinates: coords[coords.length - 1] },
      },
      trazado: { type: 'LineString', coordinates: coords },
    };

    if (composite.direction === 'ida') {
      routeData.ida = segment;
      // Mirror as regreso
      routeData.regreso = {
        puntoPartida: {
          nombre: destino || 'Inicio Vuelta',
          coordenadas: { type: 'Point', coordinates: coords[coords.length - 1] },
        },
        puntoFinal: {
          nombre: origen || 'Fin Vuelta',
          coordenadas: { type: 'Point', coordinates: coords[0] },
        },
        trazado: { type: 'LineString', coordinates: [...coords].reverse() },
      };
    } else {
      routeData.regreso = segment;
      routeData.ida = {
        puntoPartida: {
          nombre: destino || 'Inicio Ida',
          coordenadas: { type: 'Point', coordinates: coords[coords.length - 1] },
        },
        puntoFinal: {
          nombre: origen || 'Fin Ida',
          coordenadas: { type: 'Point', coordinates: coords[0] },
        },
        trazado: { type: 'LineString', coordinates: [...coords].reverse() },
      };
    }

    if (origen) routeData.origen = origen;
    if (destino) routeData.destino = destino;
    if (codigo) routeData.codigo = codigo;
    if (codigoAMBQ) routeData.codigoAMBQ = codigoAMBQ;

    const route = new Route(routeData);
    await route.save();

    // Mark composite as promoted
    composite.status = 'promoted';
    composite.promotedRouteId = route._id;
    composite.promotedAt = new Date();
    composite.promotedBy = req.user._id;
    await composite.save();

    // Award XP to all unique contributors
    const uniqueUserIds = [...new Set(composite.segments.map(s => s.userId.toString()))];
    let xpResults = [];
    for (const uid of uniqueUserIds) {
      try {
        const contributor = await User.findById(uid);
        if (contributor) {
          contributor.contributions += 1;
          const xpResult = await contributor.awardXP(100);
          xpResults.push({ userId: uid, userName: contributor.name, ...xpResult });
        }
      } catch (xpErr) {
        console.error(`Error awarding XP to ${uid}:`, xpErr.message);
      }
    }

    res.json({
      success: true,
      message: `Ruta "${composite.routeName}" promovida a oficial con ${composite.contributorCount} contribuidores`,
      data: {
        route,
        composite,
        xpAwarded: xpResults,
      },
    });
  } catch (error) {
    console.error('Error al promover composite:', error);
    res.status(500).json({ success: false, message: 'Error al promover ruta colaborativa' });
  }
}

module.exports = {
  getDashboardStats,
  getCapturedRoutes,
  getCaptureById,
  reviewCapture,
  compareCaptures,
  getTrafficStats,
  getUsers,
  getCompositeRoutes,
  getCompositeById,
  promoteComposite,
};
