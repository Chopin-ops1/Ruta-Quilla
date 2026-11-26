/**
 * ============================================
 * RutaQuilla - Configuración Global del Sistema
 * ============================================
 *
 * Documento singleton (`key: 'global'`) administrable en vivo
 * desde el panel de Seguridad de Admin sin reiniciar el servidor.
 */

const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global',
      unique: true,
    },
    registrationEnabled: {
      type: Boolean,
      default: true,
    },
    botShieldEnabled: {
      type: Boolean,
      default: true,
    },
    strictEmailValidation: {
      type: Boolean,
      default: true,
    },
    requireEmailVerification: {
      type: Boolean,
      default: true,
    },
    adminLogin2FA: {
      type: Boolean,
      default: false,
    },
    turnstileEnabled: {
      type: Boolean,
      default: false,
    },
    turnstileSiteKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    reportsEnabled: {
      type: Boolean,
      default: true,
    },
    capturesEnabled: {
      type: Boolean,
      default: true,
    },
    maxFreeSearches: {
      type: Number,
      default: 3,
      min: 0,
      max: 999,
    },
    bannerEnabled: {
      type: Boolean,
      default: false,
    },
    bannerType: {
      type: String,
      enum: ['info', 'warning', 'carnaval'],
      default: 'info',
    },
    bannerText: {
      type: String,
      default: '',
      trim: true,
      maxlength: 220,
    },
    blockedEmailDomains: {
      type: [String],
      default: [],
    },
    updatedBy: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

const CACHE_TTL_MS = 30 * 1000;
let cachedConfig = null;
let cachedAt = 0;

function normalizeConfigDoc(doc) {
  return {
    registrationEnabled: doc?.registrationEnabled !== false,
    botShieldEnabled: doc?.botShieldEnabled !== false,
    strictEmailValidation: doc?.strictEmailValidation !== false,
    requireEmailVerification: doc?.requireEmailVerification !== false,
    adminLogin2FA: Boolean(doc?.adminLogin2FA),
    turnstileEnabled: Boolean(doc?.turnstileEnabled),
    turnstileSiteKey: typeof doc?.turnstileSiteKey === 'string' ? doc.turnstileSiteKey.trim() : '',
    reportsEnabled: doc?.reportsEnabled !== false,
    capturesEnabled: doc?.capturesEnabled !== false,
    maxFreeSearches: Number.isFinite(Number(doc?.maxFreeSearches))
      ? Math.max(0, Math.min(999, Math.round(Number(doc.maxFreeSearches))))
      : 3,
    bannerEnabled: Boolean(doc?.bannerEnabled),
    bannerType: ['info', 'warning', 'carnaval'].includes(doc?.bannerType) ? doc.bannerType : 'info',
    bannerText: typeof doc?.bannerText === 'string' ? doc.bannerText.trim() : '',
    blockedEmailDomains: Array.isArray(doc?.blockedEmailDomains)
      ? doc.blockedEmailDomains
          .map((d) => String(d || '').trim().toLowerCase())
          .filter(Boolean)
      : [],
    updatedBy: doc?.updatedBy || '',
    updatedAt: doc?.updatedAt || null,
  };
}

function invalidateSystemConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

/**
 * Obtiene la configuración global vigente (con caché en memoria de 30s).
 */
async function getSystemConfig() {
  if (cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  let doc = await SystemConfig.findOne({ key: 'global' }).lean();
  if (!doc) {
    try {
      const created = await SystemConfig.create({
        key: 'global',
        turnstileSiteKey: (process.env.TURNSTILE_SITE_KEY || '').trim(),
      });
      doc = created.toObject();
    } catch (err) {
      // Posible condición de carrera al inicializar en paralelo
      doc = await SystemConfig.findOne({ key: 'global' }).lean();
    }
  }

  cachedConfig = normalizeConfigDoc(doc || {});
  cachedAt = Date.now();
  return cachedConfig;
}

/**
 * Actualiza de forma segura la configuración global e invalida caché.
 */
async function updateSystemConfig(patch = {}, adminEmail = '') {
  const safeSet = {};

  const booleanFields = [
    'registrationEnabled',
    'botShieldEnabled',
    'strictEmailValidation',
    'requireEmailVerification',
    'adminLogin2FA',
    'turnstileEnabled',
    'reportsEnabled',
    'capturesEnabled',
    'bannerEnabled',
  ];

  for (const field of booleanFields) {
    if (patch[field] !== undefined) {
      safeSet[field] = Boolean(patch[field]);
    }
  }

  if (patch.turnstileSiteKey !== undefined) {
    safeSet.turnstileSiteKey = String(patch.turnstileSiteKey || '').trim().slice(0, 120);
  }

  if (patch.maxFreeSearches !== undefined) {
    const num = Number(patch.maxFreeSearches);
    if (Number.isFinite(num)) {
      safeSet.maxFreeSearches = Math.max(0, Math.min(999, Math.round(num)));
    }
  }

  if (patch.bannerType !== undefined && ['info', 'warning', 'carnaval'].includes(patch.bannerType)) {
    safeSet.bannerType = patch.bannerType;
  }

  if (patch.bannerText !== undefined) {
    safeSet.bannerText = String(patch.bannerText || '').trim().slice(0, 220);
  }

  if (Array.isArray(patch.blockedEmailDomains)) {
    const cleaned = Array.from(
      new Set(
        patch.blockedEmailDomains
          .map((d) => String(d || '').trim().toLowerCase().replace(/^@+/, ''))
          .filter((d) => d.length >= 3 && d.includes('.') && /^[a-z0-9.-]+$/.test(d))
      )
    ).slice(0, 100);
    safeSet.blockedEmailDomains = cleaned;
  }

  if (adminEmail) {
    safeSet.updatedBy = String(adminEmail).trim().slice(0, 120);
  }

  const updated = await SystemConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: safeSet, $setOnInsert: { key: 'global' } },
    { new: true, upsert: true }
  ).lean();

  cachedConfig = normalizeConfigDoc(updated);
  cachedAt = Date.now();
  return cachedConfig;
}

module.exports = {
  SystemConfig,
  getSystemConfig,
  updateSystemConfig,
  invalidateSystemConfigCache,
};
