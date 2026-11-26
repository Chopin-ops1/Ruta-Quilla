/**
 * ============================================
 * RutaQuilla - API Service
 * ============================================
 * 
 * Wrapper HTTP optimizado para redes inestables (3G/4G):
 * - Timeout de 10 segundos por request
 * - Retry automático con backoff exponencial (3 intentos)
 * - Manejo centralizado de tokens JWT
 * - Cache básico con localStorage
 */

/**
 * En producción (Render), el frontend y backend están en dominios distintos.
 * VITE_API_URL apunta al backend (ej: https://rutaquilla-api.onrender.com/api).
 * En desarrollo, usamos '/api' que el proxy de Vite redirige a localhost:5000.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Obtiene el token JWT del localStorage.
 */
function getToken() {
  return localStorage.getItem('rutaquilla_token');
}

/**
 * Guarda el token JWT en localStorage.
 */
export function setToken(token) {
  localStorage.setItem('rutaquilla_token', token);
}

/**
 * Elimina el token (logout).
 */
export function removeToken() {
  localStorage.removeItem('rutaquilla_token');
}

/**
 * Fetch con timeout — Importante para conexiones 3G inestables.
 * Si el servidor no responde en `ms` milisegundos, aborta el request.
 * 
 * @param {string} url - URL completa
 * @param {object} options - Opciones de fetch
 * @param {number} ms - Timeout en milisegundos
 */
async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Request HTTP con retry y backoff exponencial.
 * 
 * En redes 3G/4G de Barranquilla, los timeouts y errores
 * de red son comunes. Esta función reintenta automáticamente
 * con una espera creciente entre intentos:
 * 
 * Intento 1: inmediato
 * Intento 2: espera 1 segundo
 * Intento 3: espera 2 segundos
 * 
 * @param {string} endpoint - Ruta relativa de la API (ej: '/routes')
 * @param {object} options - Opciones de fetch
 * @param {number} retries - Número de reintentos
 */
async function apiRequest(endpoint, options = {}, retries = 3) {
  const url = `${API_BASE}${endpoint}`;

  // Agregar token JWT si existe
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions);

      // Si es error del servidor (5xx), reintentar
      if (response.status >= 500 && attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Backoff exponencial
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        throw { status: response.status, ...data };
      }

      return data;
    } catch (error) {
      lastError = error;

      // Si es error de red o timeout, reintentar
      if (error.name === 'AbortError' || error.name === 'TypeError') {
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`⚠️ Intento ${attempt + 1} fallido. Reintentando en ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      // Si es error de autenticación, no reintentar
      if (error.status === 401 || error.status === 403) {
        throw error;
      }

      // Si es error de validación (4xx), no reintentar
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Para otros errores, reintentar si quedan intentos
      if (attempt >= retries - 1) {
        throw lastError;
      }
    }
  }

  throw lastError;
}

// ============================================
// Endpoints de la API
// ============================================

// ---- Rutas ----
export const routesAPI = {
  /** Obtener todas las rutas */
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/routes${params ? `?${params}` : ''}`);
  },

  /** Obtener ruta por ID */
  getById: (id) => apiRequest(`/routes/${id}`),

  /** Búsqueda radial de rutas cercanas */
  getNearby: (lat, lng, radius = 500, { limit = 25, includeGeometry = false } = {}) =>
    apiRequest(
      `/routes/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}&includeGeometry=${includeGeometry}`
    ),

  /** Capturar nueva ruta GPS */
  capture: (routeData) =>
    apiRequest('/routes/capture', {
      method: 'POST',
      body: JSON.stringify(routeData),
    }),

  /** Navegar: buscar opciones de ruta entre origen y destino */
  navigate: (origin, destination) =>
    apiRequest('/routes/navigate', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    }),
};

// ---- Admin Rutas (requiere token JWT de admin) ----
export const adminRoutesAPI = {
  /** Crear ruta oficial */
  create: (routeData) =>
    apiRequest('/routes/admin/create', {
      method: 'POST',
      body: JSON.stringify(routeData),
    }),

  /** Actualizar ruta */
  update: (id, updates) =>
    apiRequest(`/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  /** Alternar estado activa / pausada */
  toggleActive: (id, activa) =>
    apiRequest(`/routes/${id}/toggle-active`, {
      method: 'PATCH',
      body: JSON.stringify(activa !== undefined ? { activa } : {}),
    }),

  /** Obtener rutas pendientes de auditoría */
  getAudit: () => apiRequest('/routes/auditoria'),

  /** Eliminar ruta */
  delete: (id) =>
    apiRequest(`/routes/${id}`, {
      method: 'DELETE',
    }),

  /** Eliminar TODAS las rutas */
  deleteAll: (confirmPhrase) =>
    apiRequest('/routes/admin/all', {
      method: 'DELETE',
      body: JSON.stringify({ confirmPhrase }),
    }),
};

// ---- Usuarios ----
export const usersAPI = {
  /** Obtener token temporal HMAC anti-bots para el formulario */
  getFormToken: () => apiRequest('/users/form-token', {}, 1),

  /** Registrar nuevo usuario */
  register: (userData) =>
    apiRequest('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  /** Verificar email con código */
  verify: (email, code) =>
    apiRequest('/users/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  /** Verificar código OTP 2FA de acceso Admin */
  verify2FA: (email, code) =>
    apiRequest('/users/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  /** Reenviar código de verificación */
  resendCode: (email) =>
    apiRequest('/users/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  /** Solicitar código de recuperación de contraseña */
  forgotPassword: (email) =>
    apiRequest('/users/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  /** Restablecer contraseña con código OTP */
  resetPassword: (email, code, newPassword) =>
    apiRequest('/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    }),

  /** Iniciar sesión */
  login: (credentials) =>
    apiRequest('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  /** Obtener perfil del usuario autenticado */
  getProfile: () => apiRequest('/users/profile'),

  /** Actualizar plan de usuario (solo admin) */
  upgrade: (userId, role = 'premium') =>
    apiRequest('/users/upgrade', {
      method: 'PATCH',
      body: JSON.stringify({ userId, role }),
    }),
};

// ---- Mapas ----
export const mapsAPI = {
  /** Obtener ubicaciones patrocinadas */
  getSponsored: () => apiRequest('/maps/sponsored'),

  /** Descargar mapa offline (solo premium) */
  downloadOffline: () => apiRequest('/maps/download'),

  /** Autocompletado geocodificado via proxy del backend (con caché) */
  geocode: (q) => apiRequest(`/maps/geocode?q=${encodeURIComponent(q)}`, {}, 1),

  /** Geocodificación inversa via proxy del backend (con caché) */
  reverse: (lat, lng) => apiRequest(`/maps/reverse?lat=${lat}&lng=${lng}`, {}, 1),

  /** Puntos de interés (POIs) en vivo de OpenStreetMap via proxy del backend */
  getPOIs: ({ south, west, north, east }) =>
    apiRequest(`/maps/pois?south=${south}&west=${west}&north=${north}&east=${east}`, {}, 1),

  /** Catálogo oficial de paraderos de Transmetro (datos.gov.co) */
  getTransmetroStops: () => apiRequest('/maps/transmetro-stops', {}, 2),

  /** Capa opcional de seguridad vial: semáforos y fotodetección (datos.gov.co) */
  getRoadSafety: () => apiRequest('/maps/road-safety', {}, 1),

  /** Configuración pública en vivo (banner, límites freemium, flags anti-bot/registro) */
  getPublicConfig: () => apiRequest('/maps/public-config', {}, 1),
};

// ---- Health ----
export const healthAPI = {
  check: () => apiRequest('/health'),
};

// ---- Admin Panel ----
export const adminAPI = {
  /** Dashboard stats */
  getDashboard: () => apiRequest('/admin/dashboard'),

  /** Traffic data (last 24h) */
  getTraffic: () => apiRequest('/admin/traffic'),

  /** List users with optional search, role filter and pagination */
  getUsers: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/admin/users${params ? `?${params}` : ''}`);
  },

  /** Update user plan, verification, suspension or revoke active sessions */
  updateUser: (id, data) =>
    apiRequest(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** User authenticity & MX forensic audit */
  getUsersAudit: () => apiRequest('/admin/users/audit'),

  /** Resend OTP verification email to user (surfacing real SMTP status) */
  resendUserVerification: (id) =>
    apiRequest(`/admin/users/${id}/resend-verification`, {
      method: 'POST',
    }),

  /** Delete invalid, demo or spam user account */
  deleteUser: (id) =>
    apiRequest(`/admin/users/${id}`, {
      method: 'DELETE',
    }),

  /** System health, DB latency & security posture */
  getSystemHealth: () => apiRequest('/admin/system-health'),

  /** Get dynamic security & site configuration */
  getSecurityConfig: () => apiRequest('/admin/security-config'),

  /** Update dynamic security & site configuration */
  updateSecurityConfig: (data) =>
    apiRequest('/admin/security-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** Preview or purge stale unverified accounts with 0 contributions */
  purgeUnverifiedUsers: (data = {}) =>
    apiRequest('/admin/security-actions/purge-unverified', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Revoke active JWT sessions for all non-admin users */
  revokeAllSessions: () => apiRequest('/admin/security-actions/revoke-all-sessions', { method: 'POST' }),

  /** Clear temporary lockouts across user accounts */
  unlockAccounts: () => apiRequest('/admin/security-actions/unlock-accounts', { method: 'POST' }),

  /** Clear in-memory map & external API caches */
  clearCaches: () => apiRequest('/admin/cache/clear', { method: 'POST' }),

  /** Paginated admin & security audit logs */
  getAuditLogs: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/admin/audit-logs${params ? `?${params}` : ''}`);
  },

  /** List captured routes with optional filters */
  getCaptures: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/admin/captures${params ? `?${params}` : ''}`);
  },

  /** Get single capture detail */
  getCaptureById: (id) => apiRequest(`/admin/captures/${id}`),

  /** Approve or reject a capture */
  reviewCapture: (id, data) =>
    apiRequest(`/admin/captures/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** Delete a capture permanently */
  deleteCapture: (id) =>
    apiRequest(`/admin/captures/${id}`, {
      method: 'DELETE',
    }),

  /** Compare captures of the same route */
  compareCaptures: (routeName, company) => {
    const params = new URLSearchParams({ routeName, ...(company ? { company } : {}) }).toString();
    return apiRequest(`/admin/captures/compare?${params}`);
  },

  /** List composite routes (collaborative captures) */
  getComposites: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/admin/composites${params ? `?${params}` : ''}`);
  },

  /** Get composite route detail */
  getCompositeById: (id) => apiRequest(`/admin/composites/${id}`),

  /** Delete a composite route */
  deleteComposite: (id) =>
    apiRequest(`/admin/composites/${id}`, {
      method: 'DELETE',
    }),

  /** Promote composite route to official */
  promoteComposite: (id, data = {}) =>
    apiRequest(`/admin/composites/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ---- Community (Quilla XP) ----
export const communityAPI = {
  getLeaderboard: (limit = 10) => apiRequest(`/community/leaderboard?limit=${limit}`),
  getProfile: () => apiRequest('/community/me'),
  getLevels: () => apiRequest('/community/levels'),
  getPublicProfile: (id) => apiRequest(`/community/user/${id}`),
  getFeed: (limit = 20) => apiRequest(`/community/feed?limit=${limit}`),
};

// ---- Reports (Incidencias en tiempo real) ----
export const reportAPI = {
  create: (data) => apiRequest('/reports', { method: 'POST', body: JSON.stringify(data) }),
  getActive: (lat, lng, radius = 5000) => {
    const params = lat && lng ? `?lat=${lat}&lng=${lng}&radius=${radius}` : '';
    return apiRequest(`/reports/active${params}`);
  },
  confirm: (id) => apiRequest(`/reports/${id}/confirm`, { method: 'POST' }),
  dismiss: (id, reason) => apiRequest(`/reports/${id}/dismiss`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getTypes: () => apiRequest('/reports/types'),
  getAffected: (routeId) => apiRequest(`/reports/affected/${routeId}`),
  // Admin
  adminGetAll: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/reports/admin${params ? `?${params}` : ''}`);
  },
  adminDelete: (id, reason = '') => apiRequest(`/reports/admin/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
};

export default { routesAPI, usersAPI, mapsAPI, healthAPI, adminAPI, communityAPI, reportAPI };
