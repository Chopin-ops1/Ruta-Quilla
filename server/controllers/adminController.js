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
    if (routeName) filter.routeName = { $regex: routeName, $options: 'i' };

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

    // Increment contributor's count if approved
    if (status === 'approved' && capture.userId) {
      await User.findByIdAndUpdate(capture.userId, { $inc: { contributions: 1 } });
    }

    res.json({ success: true, message: `Captura ${status === 'approved' ? 'aprobada' : 'rechazada'}`, data: capture });
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

    const filter = { routeName: { $regex: routeName, $options: 'i' } };
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

module.exports = {
  getDashboardStats,
  getCapturedRoutes,
  getCaptureById,
  reviewCapture,
  compareCaptures,
  getTrafficStats,
  getUsers,
};
