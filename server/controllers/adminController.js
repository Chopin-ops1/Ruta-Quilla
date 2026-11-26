/**
 * ============================================
 * RutaQuilla - Admin Controller v4
 * ============================================
 *
 * Controlador completo de monitoreo, moderación y seguridad:
 * - Dashboard KPI + salud de rutas, colaborativas, reportes y logs
 * - Gestión de capturas GPS + eliminación
 * - Gestión de rutas colaborativas + eliminación + promoción
 * - Gestión de usuarios (búsqueda, filtros, Quilla-Pass, verificación, suspensión y cierre de sesiones)
 * - Salud del sistema, cachés de mapas y visor de auditoría
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/UserModel');
const Route = require('../models/RouteModel');
const CapturedRoute = require('../models/CapturedRouteModel');
const CompositeRoute = require('../models/CompositeRouteModel');
const Report = require('../models/ReportModel');
const { getSystemConfig, updateSystemConfig } = require('../models/SystemConfigModel');
const { AdminLog, CATEGORIES, logAdminAction } = require('../models/AdminLogModel');
const { getTrafficData } = require('../middleware/trafficTracker');
const { escapeRegex } = require('../middleware/security');
const { getMapCacheStats, clearMapCaches } = require('./mapController');
const { generateVerificationCode, sendVerificationEmail, verifySmtpStatus } = require('../services/emailService');
const { checkDomainMx, analyzeUserAccount } = require('../services/emailSecurityService');

/**
 * GET /api/admin/dashboard
 * Returns comprehensive overview stats for the admin dashboard.
 */
async function getDashboardStats(req, res) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      freeUsers,
      premiumUsers,
      adminUsers,
      unverifiedUsers,
      suspendedUsers,
      totalRoutes,
      activeRoutes,
      inactiveRoutes,
      masivoRoutes,
      urbanoRoutes,
      intermunicipalRoutes,
      needsAuditRoutes,
      pendingCaptures,
      approvedCaptures,
      rejectedCaptures,
      totalCaptures,
      buildingComposites,
      completeComposites,
      promotedComposites,
      activeReportsNow,
      totalReports,
      recentCaptures,
      recentLogs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ updatedAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ role: 'free' }),
      User.countDocuments({ role: 'premium' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ isVerified: false }),
      User.countDocuments({ isSuspended: true }),
      Route.countDocuments(),
      Route.countDocuments({ activa: true }),
      Route.countDocuments({ activa: false }),
      Route.countDocuments({ sistema: 'masivo' }),
      Route.countDocuments({ sistema: 'urbano', esIntermunicipal: { $ne: true } }),
      Route.countDocuments({ esIntermunicipal: true }),
      Route.countDocuments({ 'audit.revisadoManualmente': false }),
      CapturedRoute.countDocuments({ status: 'pending' }),
      CapturedRoute.countDocuments({ status: 'approved' }),
      CapturedRoute.countDocuments({ status: 'rejected' }),
      CapturedRoute.countDocuments(),
      CompositeRoute.countDocuments({ status: 'building' }),
      CompositeRoute.countDocuments({ status: 'complete' }),
      CompositeRoute.countDocuments({ status: 'promoted' }),
      Report.countDocuments({ status: 'active', expiresAt: { $gt: now } }),
      Report.countDocuments(),
      CapturedRoute.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('routeName company direction userName status createdAt')
        .lean(),
      AdminLog.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .select('action category adminEmail summary createdAt')
        .lean(),
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
          unverified: unverifiedUsers,
          suspended: suspendedUsers,
        },
        routes: {
          total: totalRoutes,
          active: activeRoutes,
          inactive: inactiveRoutes,
          masivo: masivoRoutes,
          urbano: urbanoRoutes,
          intermunicipal: intermunicipalRoutes,
          needsAudit: needsAuditRoutes,
        },
        captures: {
          total: totalCaptures,
          pending: pendingCaptures,
          approved: approvedCaptures,
          rejected: rejectedCaptures,
        },
        composites: {
          building: buildingComposites,
          complete: completeComposites,
          promoted: promotedComposites,
        },
        reports: {
          activeNow: activeReportsNow,
          total: totalReports,
        },
        recentCaptures,
        recentLogs,
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
 */
async function getCapturedRoutes(req, res) {
  try {
    const { status, company, routeName, page = 1, limit = 100 } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (safePage - 1) * safeLimit;

    const filter = {};
    if (typeof status === 'string' && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }
    if (typeof company === 'string' && company.trim()) {
      filter.company = company.trim().slice(0, 100);
    }
    if (typeof routeName === 'string' && routeName.trim()) {
      filter.routeName = { $regex: escapeRegex(routeName.trim().slice(0, 100)), $options: 'i' };
    }

    const [captures, total] = await Promise.all([
      CapturedRoute.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('userId', 'name email')
        .populate('reviewedBy', 'name email')
        .lean(),
      CapturedRoute.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: captures.length,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
      data: captures,
    });
  } catch (error) {
    console.error('Error al listar capturas:', error);
    res.status(500).json({ success: false, message: 'Error al listar capturas' });
  }
}

/**
 * GET /api/admin/captures/:id
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
 */
async function reviewCapture(req, res) {
  try {
    const { status, adminNotes } = req.body || {};

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status debe ser approved o rejected' });
    }

    const cleanNotes = typeof adminNotes === 'string' ? adminNotes.trim().slice(0, 300) : '';

    const capture = await CapturedRoute.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      {
        $set: {
          status,
          adminNotes: cleanNotes,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!capture) {
      const existing = await CapturedRoute.findById(req.params.id).select('_id status').lean();
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Captura no encontrada' });
      }
      return res.status(409).json({
        success: false,
        message: 'Esta captura ya fue revisada anteriormente',
        code: 'ALREADY_REVIEWED',
      });
    }

    let xpResult = null;
    if (capture.userId) {
      const contributor = await User.findById(capture.userId);
      if (contributor) {
        if (status === 'approved') {
          contributor.contributions += 1;
          xpResult = await contributor.awardXP(50);
        } else if (status === 'rejected' && cleanNotes) {
          xpResult = await contributor.awardXP(5);
        }
      }
    }

    await logAdminAction({
      req,
      action: 'CAPTURE_REVIEW',
      category: 'capture',
      targetType: 'CapturedRoute',
      targetId: capture._id,
      summary: `Captura ${status === 'approved' ? 'aprobada' : 'rechazada'}: ${capture.routeName} (${capture.userName})`,
      metadata: { status },
    });

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
 * DELETE /api/admin/captures/:id
 */
async function deleteCapture(req, res) {
  try {
    const capture = await CapturedRoute.findByIdAndDelete(req.params.id);
    if (!capture) {
      return res.status(404).json({ success: false, message: 'Captura no encontrada' });
    }

    await logAdminAction({
      req,
      action: 'CAPTURE_DELETE',
      category: 'capture',
      targetType: 'CapturedRoute',
      targetId: capture._id,
      summary: `Captura eliminada: ${capture.routeName} (${capture.userName || 'N/A'})`,
    });

    res.json({ success: true, message: 'Captura eliminada' });
  } catch (error) {
    console.error('Error al eliminar captura:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar captura' });
  }
}

/**
 * GET /api/admin/captures/compare?routeName=X&company=Y
 */
async function compareCaptures(req, res) {
  try {
    const { routeName, company } = req.query;
    if (typeof routeName !== 'string' || !routeName.trim()) {
      return res.status(400).json({ success: false, message: 'routeName es requerido' });
    }

    const filter = { routeName: { $regex: escapeRegex(routeName.trim().slice(0, 100)), $options: 'i' } };
    if (typeof company === 'string' && company.trim()) {
      filter.company = company.trim().slice(0, 100);
    }

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
 * Helper interno: resuelve registros DNS MX para todos los dominios de una lista de usuarios.
 */
async function resolveMxMapForUsers(users) {
  const uniqueDomains = Array.from(
    new Set(
      (users || [])
        .map((u) => String(u?.email || '').toLowerCase().split('@')[1])
        .filter(Boolean)
    )
  );
  const entries = await Promise.all(
    uniqueDomains.map(async (domain) => [domain, await checkDomainMx(domain)])
  );
  return new Map(entries);
}

/**
 * GET /api/admin/users?search=&role=all&page=1&limit=30
 */
async function getUsers(req, res) {
  try {
    const { search = '', role = 'all', page = 1, limit = 30 } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (safePage - 1) * safeLimit;

    const filter = {};
    if (typeof search === 'string' && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim().slice(0, 80)), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }

    if (typeof role === 'string') {
      if (['free', 'premium', 'admin'].includes(role)) {
        filter.role = role;
      } else if (role === 'suspended') {
        filter.isSuspended = true;
      } else if (role === 'unverified') {
        filter.isVerified = false;
      } else if (role === 'verified') {
        filter.isVerified = true;
      }
    }

    const sysConfig = await getSystemConfig();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Filtro especial de auditoría ("suspicious"): analiza dominios con typo/sin MX, demos o keyboard mash
    if (role === 'suspicious') {
      const allUsers = await User.find(filter)
        .select('name email role isPremium isVerified isSuspended suspendedReason xp level contributions createdAt updatedAt')
        .sort({ createdAt: 1 })
        .lean();
      const mxMap = await resolveMxMapForUsers(allUsers);
      const flagged = [];
      for (let i = 0; i < allUsers.length; i++) {
        const u = allUsers[i];
        const prevCreatedAt = i > 0 ? new Date(allUsers[i - 1].createdAt).getTime() : null;
        const nextCreatedAt = i + 1 < allUsers.length ? new Date(allUsers[i + 1].createdAt).getTime() : null;
        const authenticity = analyzeUserAccount(u, {
          mxMap,
          prevCreatedAt,
          nextCreatedAt,
          blockedDomains: sysConfig.blockedEmailDomains,
        });
        if (['typo_or_nomx', 'suspicious_pattern', 'demo_account'].includes(authenticity.classification)) {
          flagged.push({
            ...u,
            isActive: new Date(u.updatedAt) >= sevenDaysAgo,
            authenticity,
          });
        }
      }
      flagged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const total = flagged.length;
      const paged = flagged.slice(skip, skip + safeLimit);
      return res.json({
        success: true,
        count: paged.length,
        total,
        page: safePage,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        data: paged,
      });
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email role isPremium isVerified isSuspended suspendedReason xp level contributions createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const mxMap = await resolveMxMapForUsers(users);
    const enriched = users.map((u) => ({
      ...u,
      isActive: new Date(u.updatedAt) >= sevenDaysAgo,
      authenticity: analyzeUserAccount(u, {
        mxMap,
        blockedDomains: sysConfig.blockedEmailDomains,
      }),
    }));

    res.json({
      success: true,
      count: enriched.length,
      total,
      page: safePage,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      data: enriched,
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ success: false, message: 'Error al listar usuarios' });
  }
}

/**
 * GET /api/admin/users/audit
 * Auditoría forense de autenticidad, verificación OTP y DNS MX sobre todo el padrón de cuentas.
 */
async function getUsersAudit(req, res) {
  try {
    const [allUsers, sysConfig, smtpStatus] = await Promise.all([
      User.find()
        .select('name email role isVerified isSuspended xp contributions createdAt')
        .sort({ createdAt: 1 })
        .lean(),
      getSystemConfig(),
      verifySmtpStatus(),
    ]);

    const mxMap = await resolveMxMapForUsers(allUsers);
    const domainStatsMap = new Map();

    let verifiedHumans = 0;
    let institutionalCount = 0;
    let unverifiedRecent = 0;
    let unverifiedStale = 0;
    let typoOrNoMxCount = 0;
    let suspiciousPatternCount = 0;
    let demoCount = 0;
    const flaggedUsers = [];

    for (let i = 0; i < allUsers.length; i++) {
      const u = allUsers[i];
      const domain = String(u.email || '').toLowerCase().split('@')[1] || 'unknown';
      const mxInfo = mxMap.get(domain) || { valid: null, status: 'UNKNOWN' };

      if (!domainStatsMap.has(domain)) {
        domainStatsMap.set(domain, { domain, count: 0, mxValid: mxInfo.valid, mxStatus: mxInfo.status });
      }
      domainStatsMap.get(domain).count += 1;

      const prevCreatedAt = i > 0 ? new Date(allUsers[i - 1].createdAt).getTime() : null;
      const nextCreatedAt = i + 1 < allUsers.length ? new Date(allUsers[i + 1].createdAt).getTime() : null;
      const auth = analyzeUserAccount(u, {
        mxMap,
        prevCreatedAt,
        nextCreatedAt,
        blockedDomains: sysConfig.blockedEmailDomains,
      });

      switch (auth.classification) {
        case 'verified_human':
          verifiedHumans += 1;
          break;
        case 'institutional':
          verifiedHumans += 1;
          institutionalCount += 1;
          break;
        case 'unverified_recent':
          unverifiedRecent += 1;
          break;
        case 'unverified_stale':
          unverifiedStale += 1;
          break;
        case 'typo_or_nomx':
          typoOrNoMxCount += 1;
          flaggedUsers.push({ ...u, authenticity: auth });
          break;
        case 'suspicious_pattern':
          suspiciousPatternCount += 1;
          flaggedUsers.push({ ...u, authenticity: auth });
          break;
        case 'demo_account':
          demoCount += 1;
          flaggedUsers.push({ ...u, authenticity: auth });
          break;
        default:
          break;
      }
    }

    const domains = Array.from(domainStatsMap.values()).sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers: allUsers.length,
          verifiedHumans,
          institutionalCount,
          unverifiedTotal: unverifiedRecent + unverifiedStale,
          unverifiedRecent,
          unverifiedStale,
          typoOrNoMxCount,
          suspiciousPatternCount,
          demoCount,
          alertsTotal: flaggedUsers.length,
        },
        smtp: smtpStatus,
        domains,
        flaggedUsers: flaggedUsers.reverse(),
      },
    });
  } catch (error) {
    console.error('Error en getUsersAudit:', error);
    res.status(500).json({ success: false, message: 'Error al auditar usuarios' });
  }
}

/**
 * POST /api/admin/users/:id/resend-verification
 * Reenvía código OTP real sin ocultar fallos SMTP para diagnóstico del administrador.
 */
async function resendUserVerificationAdmin(req, res) {
  try {
    const target = await User.findById(req.params.id).select('+verificationCode +verificationCodeExpiry +verificationAttempts');
    if (!target) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    if (target.isVerified) {
      return res.status(400).json({ success: false, message: 'Este usuario ya está verificado' });
    }
    if (!process.env.ZOHO_EMAIL || !process.env.ZOHO_PASSWORD) {
      return res.status(503).json({ success: false, message: 'SMTP (ZOHO_EMAIL/ZOHO_PASSWORD) no está configurado en el servidor' });
    }

    const code = generateVerificationCode();
    target.verificationCode = crypto.createHash('sha256').update(code).digest('hex');
    target.verificationCodeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    target.verificationAttempts = 0;
    await target.save();

    await sendVerificationEmail(target.email, target.name, code);

    await logAdminAction({
      req,
      action: 'USER_RESEND_OTP',
      category: 'user',
      targetType: 'User',
      targetId: target._id,
      summary: `Código de verificación reenviado manualmente a ${target.email}`,
    });

    res.json({
      success: true,
      message: `Código de verificación enviado a ${target.email}`,
    });
  } catch (error) {
    console.error('Error reenviando verificación admin:', error);
    res.status(502).json({
      success: false,
      message: error.message || 'Falló el envío de correo via Zoho SMTP',
    });
  }
}

/**
 * DELETE /api/admin/users/:id
 * Elimina una cuenta inválida, demo o spam (protegido contra admins y propia cuenta).
 */
async function deleteUserAdmin(req, res) {
  try {
    const targetId = req.params.id;
    if (String(req.user._id) === String(targetId)) {
      return res.status(403).json({ success: false, message: 'No puedes eliminar tu propia cuenta administrativa' });
    }

    const target = await User.findById(targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    if (target.role === 'admin') {
      return res.status(403).json({ success: false, message: 'No está permitido eliminar cuentas de administrador' });
    }

    await User.deleteOne({ _id: target._id });

    await logAdminAction({
      req,
      action: 'USER_DELETE',
      category: 'user',
      targetType: 'User',
      targetId: target._id,
      summary: `Cuenta eliminada: ${target.email} (${target.name})`,
    });

    res.json({
      success: true,
      message: `Cuenta de ${target.email} eliminada`,
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
  }
}

/**
 * PATCH /api/admin/users/:id
 * Moderación integral de usuarios: plan, verificación, suspensión y revocación de sesiones.
 */
async function updateUserAdmin(req, res) {
  try {
    const targetId = req.params.id;
    if (String(req.user._id) === String(targetId)) {
      return res.status(403).json({
        success: false,
        message: 'No puedes modificar tu propia cuenta administrativa desde este panel',
        code: 'FORBIDDEN_SELF_MUTATION',
      });
    }

    const target = await User.findById(targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (target.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No está permitido modificar otra cuenta de administrador desde este panel',
        code: 'FORBIDDEN_ADMIN_MUTATION',
      });
    }

    const { role, isVerified, isSuspended, suspendedReason, revokeSessions } = req.body || {};
    const changes = [];

    if (role !== undefined) {
      if (!['free', 'premium'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Rol inválido. Solo se permite free o premium',
          code: 'INVALID_ROLE',
        });
      }
      if (target.role !== role) {
        target.role = role;
        target.isPremium = role === 'premium';
        changes.push(`plan=${role}`);
      }
    }

    if (isVerified !== undefined) {
      const nextVerified = Boolean(isVerified);
      if (target.isVerified !== nextVerified) {
        target.isVerified = nextVerified;
        if (nextVerified) {
          target.verificationCode = undefined;
          target.verificationCodeExpiry = undefined;
          target.verificationAttempts = 0;
        }
        changes.push(`verificado=${nextVerified}`);
      }
    }

    if (isSuspended !== undefined) {
      const nextSuspended = Boolean(isSuspended);
      target.isSuspended = nextSuspended;
      target.suspendedReason = nextSuspended
        ? String(suspendedReason || 'Suspendido por administrador').trim().slice(0, 200)
        : '';
      if (nextSuspended) {
        target.tokenVersion = (target.tokenVersion || 0) + 1;
      }
      changes.push(nextSuspended ? 'suspendido' : 'reactivado');
    }

    if (revokeSessions === true) {
      target.tokenVersion = (target.tokenVersion || 0) + 1;
      target.failedLoginAttempts = 0;
      target.lockUntil = null;
      changes.push('sesiones_revocadas');
    }

    if (changes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se especificaron cambios válidos',
      });
    }

    await target.save();

    await logAdminAction({
      req,
      action: isSuspended === true ? 'USER_SUSPEND' : revokeSessions ? 'USER_REVOKE_SESSIONS' : 'USER_UPDATE',
      category: isSuspended || revokeSessions ? 'security' : 'user',
      targetType: 'User',
      targetId: target._id,
      summary: `Usuario ${target.email} actualizado (${changes.join(', ')})`,
      metadata: { changes },
    });

    res.json({
      success: true,
      message: `Usuario ${target.name} actualizado correctamente`,
      data: {
        _id: target._id,
        name: target.name,
        email: target.email,
        role: target.role,
        isPremium: target.isPremium,
        isVerified: target.isVerified,
        isSuspended: target.isSuspended,
        suspendedReason: target.suspendedReason,
      },
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
}

/**
 * GET /api/admin/composites
 */
async function getCompositeRoutes(req, res) {
  try {
    const { status, company, routeName } = req.query;
    const filter = {};
    const validStatuses = ['building', 'complete', 'promoted'];
    if (typeof status === 'string' && validStatuses.includes(status)) filter.status = status;
    if (typeof company === 'string' && company.trim()) filter.company = company.trim().slice(0, 100);
    if (typeof routeName === 'string' && routeName.trim()) {
      filter.routeName = { $regex: escapeRegex(routeName.trim().slice(0, 100)), $options: 'i' };
    }

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
 */
async function getCompositeById(req, res) {
  try {
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
 * DELETE /api/admin/composites/:id
 */
async function deleteComposite(req, res) {
  try {
    const composite = await CompositeRoute.findByIdAndDelete(req.params.id);
    if (!composite) {
      return res.status(404).json({ success: false, message: 'Ruta colaborativa no encontrada' });
    }

    await logAdminAction({
      req,
      action: 'COMPOSITE_DELETE',
      category: 'capture',
      targetType: 'CompositeRoute',
      targetId: composite._id,
      summary: `Ruta colaborativa eliminada: ${composite.routeName} (${composite.company})`,
    });

    res.json({ success: true, message: 'Ruta colaborativa eliminada' });
  } catch (error) {
    console.error('Error al eliminar composite:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar ruta colaborativa' });
  }
}

/**
 * POST /api/admin/composites/:id/promote
 */
async function promoteComposite(req, res) {
  try {
    const composite = await CompositeRoute.findById(req.params.id);
    if (!composite) {
      return res.status(404).json({ success: false, message: 'Ruta colaborativa no encontrada' });
    }

    if (composite.status === 'promoted') {
      return res.status(400).json({ success: false, message: 'Esta ruta ya fue promovida a oficial' });
    }

    const { origen, destino, color, fare, codigo, codigoAMBQ } = req.body || {};
    const coords = composite.mergedGeometry.coordinates;

    const companyColors = {
      'Sobrusa': '#F59E0B', 'Coolitoral': '#06B6D4', 'Transmecar': '#10B981',
      'Sobusa': '#EAB308', 'Cootransnorte': '#8B5CF6', 'Embusa': '#EC4899',
      'Flota Angulo': '#F97316', 'Sodis': '#A855F7', 'Lolaya': '#EF4444',
      'Lucero San Felipe': '#F472B6', 'Coochofal': '#14B8A6', 'Cootrasol': '#22D3EE',
      'La Carolina': '#818CF8', 'Excolcar': '#3B82F6',
    };

    const routeData = {
      nombre: composite.routeName,
      operador: composite.company,
      color: color || companyColors[composite.company] || '#06B6D4',
      type: 'community',
      fare: Number.isFinite(Number(fare)) && Number(fare) > 0 ? Math.round(Number(fare)) : 3700,
      fuente: 'manual',
      activa: true,
      trazadoIncompleto: false,
      geometriaOSM: false,
      audit: {
        revisadoManualmente: true,
        observaciones: `Promovida desde ruta colaborativa (${composite.contributorCount} contribuidores). Admin: ${req.user.email}`,
      },
    };

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

    if (origen) routeData.origen = String(origen).trim().slice(0, 120);
    if (destino) routeData.destino = String(destino).trim().slice(0, 120);
    if (codigo) routeData.codigo = String(codigo).trim().slice(0, 30);
    if (codigoAMBQ) routeData.codigoAMBQ = String(codigoAMBQ).trim().slice(0, 40);

    const route = new Route(routeData);
    await route.save();

    composite.status = 'promoted';
    composite.promotedRouteId = route._id;
    composite.promotedAt = new Date();
    composite.promotedBy = req.user._id;
    await composite.save();

    const uniqueUserIds = [...new Set(composite.segments.map((s) => s.userId.toString()))];
    const xpResults = [];
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

    await logAdminAction({
      req,
      action: 'COMPOSITE_PROMOTE',
      category: 'route',
      targetType: 'Route',
      targetId: route._id,
      summary: `Colaborativa promovida a oficial: ${composite.routeName} (${composite.contributorCount} contrib.)`,
    });

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

/**
 * GET /api/admin/system-health
 * Retorna diagnóstico operativo, estado de DB, cachés y postura de seguridad (solo admin).
 */
async function getSystemHealth(req, res) {
  try {
    let dbStatus = 'disconnected';
    let dbLatencyMs = null;

    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const started = Date.now();
      try {
        await mongoose.connection.db.admin().ping();
        dbLatencyMs = Date.now() - started;
        dbStatus = 'connected';
      } catch (_) {
        dbStatus = 'error';
      }
    }

    const mem = process.memoryUsage();
    const [lockedAccounts, suspendedAccounts, totalAdmins] = await Promise.all([
      User.countDocuments({ lockUntil: { $gt: new Date() } }),
      User.countDocuments({ isSuspended: true }),
      User.countDocuments({ role: 'admin' }),
    ]);

    const smtpConfigured = Boolean(process.env.ZOHO_EMAIL && process.env.ZOHO_PASSWORD);
    const jwtStrongSecret = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);

    res.json({
      success: true,
      data: {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        memory: {
          rssMB: Math.round(mem.rss / 1048576),
          heapUsedMB: Math.round(mem.heapUsed / 1048576),
          heapTotalMB: Math.round(mem.heapTotal / 1048576),
        },
        caches: getMapCacheStats(),
        security: {
          jwtStrongSecret,
          smtpConfigured,
          mongoSanitize: true,
          helmetCSP: true,
          accountLockout: true,
          tokenRevocation: true,
          bulkWipeLocked: process.env.NODE_ENV === 'production'
            ? process.env.ALLOW_BULK_ROUTE_WIPE !== 'true'
            : true,
          lockedAccounts,
          suspendedAccounts,
          totalAdmins,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error en system-health:', error);
    res.status(500).json({ success: false, message: 'Error al consultar salud del sistema' });
  }
}

/**
 * POST /api/admin/cache/clear
 */
async function clearSystemCaches(req, res) {
  try {
    const cleared = clearMapCaches();
    await logAdminAction({
      req,
      action: 'CACHE_CLEAR',
      category: 'system',
      summary: `Cachés de mapas limpiadas (geocode:${cleared.geocode}, reverse:${cleared.reverse}, pois:${cleared.pois}, safety:${cleared.roadSafety})`,
      metadata: cleared,
    });

    res.json({
      success: true,
      message: 'Cachés en memoria limpiadas',
      data: cleared,
    });
  } catch (error) {
    console.error('Error limpiando cachés:', error);
    res.status(500).json({ success: false, message: 'Error al limpiar cachés' });
  }
}

/**
 * GET /api/admin/audit-logs?category=all&page=1&limit=25
 */
async function getAuditLogs(req, res) {
  try {
    const { category = 'all', page = 1, limit = 25 } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (safePage - 1) * safeLimit;

    const filter = {};
    if (typeof category === 'string' && CATEGORIES.includes(category)) {
      filter.category = category;
    }

    const [logs, total] = await Promise.all([
      AdminLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      AdminLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: safePage,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      data: logs,
    });
  } catch (error) {
    console.error('Error al obtener logs de auditoría:', error);
    res.status(500).json({ success: false, message: 'Error al obtener registros de auditoría' });
  }
}

/**
 * GET /api/admin/security-config
 */
async function getSecurityConfigAdmin(req, res) {
  try {
    const [cfg, smtp] = await Promise.all([getSystemConfig(), verifySmtpStatus()]);
    res.json({
      success: true,
      data: {
        ...cfg,
        turnstileSecretConfigured: Boolean(process.env.TURNSTILE_SECRET_KEY),
        smtp,
      },
    });
  } catch (error) {
    console.error('Error obteniendo security-config:', error);
    res.status(500).json({ success: false, message: 'Error al obtener configuración de seguridad' });
  }
}

/**
 * PUT /api/admin/security-config
 */
async function updateSecurityConfigAdmin(req, res) {
  try {
    if (req.body?.adminLogin2FA === true && !(process.env.ZOHO_EMAIL && process.env.ZOHO_PASSWORD)) {
      return res.status(400).json({
        success: false,
        message: 'No se puede activar 2FA por correo sin configurar primero ZOHO_EMAIL y ZOHO_PASSWORD en el servidor.',
      });
    }

    const updated = await updateSystemConfig(req.body || {}, req.user?.email || '');

    await logAdminAction({
      req,
      action: 'SECURITY_CONFIG_UPDATE',
      category: 'security',
      summary: `Políticas de sitio y seguridad actualizadas (registro=${updated.registrationEnabled ? 'on' : 'off'}, botShield=${updated.botShieldEnabled ? 'on' : 'off'}, búsquedas=${updated.maxFreeSearches})`,
      metadata: {
        registrationEnabled: updated.registrationEnabled,
        botShieldEnabled: updated.botShieldEnabled,
        strictEmailValidation: updated.strictEmailValidation,
        requireEmailVerification: updated.requireEmailVerification,
        turnstileEnabled: updated.turnstileEnabled,
        reportsEnabled: updated.reportsEnabled,
        capturesEnabled: updated.capturesEnabled,
        maxFreeSearches: updated.maxFreeSearches,
        bannerEnabled: updated.bannerEnabled,
      },
    });

    res.json({
      success: true,
      message: 'Configuración de seguridad y sitio aplicada en vivo',
      data: {
        ...updated,
        turnstileSecretConfigured: Boolean(process.env.TURNSTILE_SECRET_KEY),
      },
    });
  } catch (error) {
    console.error('Error actualizando security-config:', error);
    res.status(500).json({ success: false, message: 'Error al guardar configuración de seguridad' });
  }
}

/**
 * POST /api/admin/security-actions/purge-unverified
 * Limpia cuentas gratuitas sin verificar y con 0 aportes anteriores a `olderThanDays` días.
 */
async function purgeUnverifiedUsersAdmin(req, res) {
  try {
    const { olderThanDays = 7, dryRun = false } = req.body || {};
    const days = Math.max(1, Math.min(365, parseInt(olderThanDays, 10) || 7));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const filter = {
      role: 'free',
      isVerified: false,
      contributions: 0,
      createdAt: { $lt: cutoff },
    };

    const count = await User.countDocuments(filter);
    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        eligibleCount: count,
        olderThanDays: days,
        message: `${count} cuenta(s) no verificada(s) sin aportes cumplen >${days} días`,
      });
    }

    const result = await User.deleteMany(filter);
    const deletedCount = result.deletedCount || 0;

    await logAdminAction({
      req,
      action: 'PURGE_UNVERIFIED_USERS',
      category: 'security',
      summary: `Limpieza de cuentas no verificadas >${days}d: ${deletedCount} eliminadas`,
      metadata: { days, deletedCount },
    });

    res.json({
      success: true,
      deletedCount,
      message: `Se eliminaron ${deletedCount} cuenta(s) no verificada(s) con más de ${days} días`,
    });
  } catch (error) {
    console.error('Error en purge-unverified:', error);
    res.status(500).json({ success: false, message: 'Error al limpiar cuentas no verificadas' });
  }
}

/**
 * POST /api/admin/security-actions/revoke-all-sessions
 * Cierra sesiones JWT activas de todos los usuarios no-admin incrementando su tokenVersion.
 */
async function revokeAllUserSessionsAdmin(req, res) {
  try {
    const result = await User.updateMany(
      { role: { $ne: 'admin' } },
      { $inc: { tokenVersion: 1 } }
    );
    const modifiedCount = result.modifiedCount || 0;

    await logAdminAction({
      req,
      action: 'REVOKE_ALL_SESSIONS',
      category: 'security',
      summary: `Revocación global de sesiones JWT aplicada a ${modifiedCount} cuentas`,
      metadata: { modifiedCount },
    });

    res.json({
      success: true,
      modifiedCount,
      message: `Sesiones revocadas en ${modifiedCount} cuenta(s) de usuario`,
    });
  } catch (error) {
    console.error('Error revocando sesiones globales:', error);
    res.status(500).json({ success: false, message: 'Error al revocar sesiones globales' });
  }
}

/**
 * POST /api/admin/security-actions/unlock-accounts
 * Limpia bloqueos temporales por intentos fallidos.
 */
async function unlockAllAccountsAdmin(req, res) {
  try {
    const result = await User.updateMany(
      { $or: [{ lockUntil: { $gt: new Date() } }, { failedLoginAttempts: { $gt: 0 } }] },
      { $set: { lockUntil: null, failedLoginAttempts: 0 } }
    );
    const modifiedCount = result.modifiedCount || 0;

    await logAdminAction({
      req,
      action: 'UNLOCK_ACCOUNTS',
      category: 'security',
      summary: `Desbloqueo manual de cuentas aplicado (${modifiedCount} actualizadas)`,
      metadata: { modifiedCount },
    });

    res.json({
      success: true,
      modifiedCount,
      message: `Se desbloquearon ${modifiedCount} cuenta(s)`,
    });
  } catch (error) {
    console.error('Error desbloqueando cuentas:', error);
    res.status(500).json({ success: false, message: 'Error al desbloquear cuentas' });
  }
}

module.exports = {
  getDashboardStats,
  getCapturedRoutes,
  getCaptureById,
  reviewCapture,
  deleteCapture,
  compareCaptures,
  getTrafficStats,
  getUsers,
  getUsersAudit,
  updateUserAdmin,
  resendUserVerificationAdmin,
  deleteUserAdmin,
  getCompositeRoutes,
  getCompositeById,
  deleteComposite,
  promoteComposite,
  getSystemHealth,
  clearSystemCaches,
  getAuditLogs,
  getSecurityConfigAdmin,
  updateSecurityConfigAdmin,
  purgeUnverifiedUsersAdmin,
  revokeAllUserSessionsAdmin,
  unlockAllAccountsAdmin,
};
