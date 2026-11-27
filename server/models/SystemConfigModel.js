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
    appRelease: {
      versionName: { type: String, default: '2.1.0', trim: true },
      androidVersionCode: { type: Number, default: 3 },
      title: { type: String, default: 'Nueva versión de RutaQuilla', trim: true },
      summary: {
        type: String,
        default: 'Interfaz más limpia en celular, accesos rápidos a Casa o Trabajo y avisos claros de mejoras y actualizaciones.',
        trim: true,
      },
      downloadUrl: {
        type: String,
        default: 'https://rutaquilla.me/downloads/RutaQuilla.apk',
        trim: true,
      },
      publishedAt: { type: String, default: '2026-11-27', trim: true },
      highlights: {
        type: [
          {
            category: { type: String, default: 'Mejoras', trim: true },
            text: { type: String, default: '', trim: true },
          },
        ],
        default: undefined,
      },
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

const DEFAULT_APP_RELEASE = {
  versionName: '2.1.0',
  androidVersionCode: 3,
  title: 'RutaQuilla 2.1.0 ya está disponible',
  summary: 'Interfaz más cómoda en celular, accesos rápidos a tus lugares favoritos y avisos de cada mejora.',
  downloadUrl: 'https://rutaquilla.me/downloads/RutaQuilla.apk',
  publishedAt: '2026-11-27',
  highlights: [
    {
      category: 'Diseño',
      text: 'Barra superior más limpia en celulares para leer el nombre y navegar con comodidad.',
    },
    {
      category: 'Rutas',
      text: 'Guarda tu Casa y Trabajo para calcular tu ruta con un solo toque.',
    },
    {
      category: 'Seguridad',
      text: 'Protección reforzada de cuentas y detección automática de nuevas versiones.',
    },
    {
      category: 'Mejoras',
      text: 'Aviso cuando estás sin conexión usando tus rutas guardadas.',
    },
  ],
};

function normalizeAppRelease(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_APP_RELEASE,
      highlights: DEFAULT_APP_RELEASE.highlights.map((h) => ({ ...h })),
    };
  }
  const rawCode = Number(raw.androidVersionCode);
  // Si en BD quedó una versión anterior a este despliegue, usar los valores por defecto vigentes
  if (!Number.isFinite(rawCode) || rawCode < DEFAULT_APP_RELEASE.androidVersionCode) {
    return {
      ...DEFAULT_APP_RELEASE,
      highlights: DEFAULT_APP_RELEASE.highlights.map((h) => ({ ...h })),
    };
  }
  const cleanHighlights = Array.isArray(raw.highlights)
    ? raw.highlights
        .map((item) => ({
          category: String(item?.category || 'Mejoras').trim().slice(0, 24) || 'Mejoras',
          text: String(item?.text || '').trim().slice(0, 180),
        }))
        .filter((item) => item.text.length > 0)
        .slice(0, 8)
    : [];

  return {
    versionName: String(raw.versionName || DEFAULT_APP_RELEASE.versionName).trim().slice(0, 24) || DEFAULT_APP_RELEASE.versionName,
    androidVersionCode: Math.max(1, Math.round(rawCode)),
    title: String(raw.title || DEFAULT_APP_RELEASE.title).trim().slice(0, 90) || DEFAULT_APP_RELEASE.title,
    summary: String(raw.summary || DEFAULT_APP_RELEASE.summary).trim().slice(0, 220) || DEFAULT_APP_RELEASE.summary,
    downloadUrl: String(raw.downloadUrl || DEFAULT_APP_RELEASE.downloadUrl).trim().slice(0, 240) || DEFAULT_APP_RELEASE.downloadUrl,
    publishedAt: String(raw.publishedAt || DEFAULT_APP_RELEASE.publishedAt).trim().slice(0, 24) || DEFAULT_APP_RELEASE.publishedAt,
    highlights: cleanHighlights.length > 0
      ? cleanHighlights
      : DEFAULT_APP_RELEASE.highlights.map((h) => ({ ...h })),
  };
}

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
    appRelease: normalizeAppRelease(doc?.appRelease),
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

  if (patch.appRelease && typeof patch.appRelease === 'object') {
    const ar = patch.appRelease;
    const codeNum = Number(ar.androidVersionCode);
    const cleanedHighlights = Array.isArray(ar.highlights)
      ? ar.highlights
          .map((item) => ({
            category: String(item?.category || 'Mejoras').trim().slice(0, 24) || 'Mejoras',
            text: String(item?.text || '').trim().slice(0, 180),
          }))
          .filter((item) => item.text.length > 0)
          .slice(0, 8)
      : DEFAULT_APP_RELEASE.highlights;

    safeSet.appRelease = {
      versionName: String(ar.versionName || DEFAULT_APP_RELEASE.versionName).trim().slice(0, 24) || DEFAULT_APP_RELEASE.versionName,
      androidVersionCode: Number.isFinite(codeNum)
        ? Math.max(1, Math.min(999999, Math.round(codeNum)))
        : DEFAULT_APP_RELEASE.androidVersionCode,
      title: String(ar.title || DEFAULT_APP_RELEASE.title).trim().slice(0, 90) || DEFAULT_APP_RELEASE.title,
      summary: String(ar.summary || DEFAULT_APP_RELEASE.summary).trim().slice(0, 220) || DEFAULT_APP_RELEASE.summary,
      downloadUrl: /^https?:\/\//i.test(String(ar.downloadUrl || '').trim())
        ? String(ar.downloadUrl).trim().slice(0, 240)
        : DEFAULT_APP_RELEASE.downloadUrl,
      publishedAt: String(ar.publishedAt || new Date().toISOString().slice(0, 10)).trim().slice(0, 24),
      highlights: cleanedHighlights.length > 0 ? cleanedHighlights : DEFAULT_APP_RELEASE.highlights,
    };
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
