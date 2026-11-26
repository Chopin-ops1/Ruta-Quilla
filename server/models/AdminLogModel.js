/**
 * ============================================
 * RutaQuilla - Modelo de Auditoría Admin
 * ============================================
 *
 * Registra eventos administrativos y de seguridad relevantes:
 * - Cambios, altas, bajas y pausas de rutas
 * - Cambios de rol, verificación, suspensión y revocación de sesiones
 * - Revisión y eliminación de capturas, colaborativas y reportes
 * - Eventos de seguridad (bloqueo por fuerza bruta, limpieza de cachés)
 */

const mongoose = require('mongoose');

const CATEGORIES = ['route', 'user', 'capture', 'report', 'security', 'system'];

const adminLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
    index: true,
  },
  category: {
    type: String,
    enum: CATEGORIES,
    default: 'system',
    index: true,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  adminEmail: {
    type: String,
    trim: true,
    default: 'system',
    maxlength: 120,
  },
  targetType: {
    type: String,
    trim: true,
    default: '',
    maxlength: 60,
  },
  targetId: {
    type: String,
    trim: true,
    default: '',
    maxlength: 80,
  },
  summary: {
    type: String,
    trim: true,
    default: '',
    maxlength: 300,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  ip: {
    type: String,
    trim: true,
    default: '',
    maxlength: 80,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 90, // TTL automático de 90 días
  },
});

adminLogSchema.index({ createdAt: -1 });
adminLogSchema.index({ category: 1, createdAt: -1 });

const AdminLog = mongoose.models.AdminLog || mongoose.model('AdminLog', adminLogSchema);

/**
 * Helper no bloqueante para registrar acciones administrativas y de seguridad.
 */
async function logAdminAction({
  req = null,
  action,
  category = 'system',
  targetType = '',
  targetId = '',
  summary = '',
  metadata = null,
  adminEmailOverride = '',
} = {}) {
  try {
    if (!action) return null;
    const safeCategory = CATEGORIES.includes(category) ? category : 'system';
    const rawIp = req?.ip || req?.headers?.['x-forwarded-for'] || '';
    const ip = String(Array.isArray(rawIp) ? rawIp[0] : rawIp).split(',')[0].trim().slice(0, 80);

    return await AdminLog.create({
      action: String(action).slice(0, 80),
      category: safeCategory,
      adminId: req?.user?._id || null,
      adminEmail: String(req?.user?.email || adminEmailOverride || 'system').slice(0, 120),
      targetType: String(targetType || '').slice(0, 60),
      targetId: targetId ? String(targetId).slice(0, 80) : '',
      summary: String(summary || '').slice(0, 300),
      metadata,
      ip,
    });
  } catch (err) {
    console.warn('⚠️ AdminLog write skipped:', err.message);
    return null;
  }
}

module.exports = {
  AdminLog,
  CATEGORIES,
  logAdminAction,
};
