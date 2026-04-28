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

const API_BASE = '/api';

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
  getNearby: (lat, lng, radius = 500) =>
    apiRequest(`/routes/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),

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

  /** Eliminar ruta */
  delete: (id) =>
    apiRequest(`/routes/${id}`, {
      method: 'DELETE',
    }),

  /** Eliminar TODAS las rutas */
  deleteAll: () =>
    apiRequest('/routes/admin/all', {
      method: 'DELETE',
    }),
};

// ---- Usuarios ----
export const usersAPI = {
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

  /** Reenviar código de verificación */
  resendCode: (email) =>
    apiRequest('/users/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  /** Iniciar sesión */
  login: (credentials) =>
    apiRequest('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  /** Obtener perfil del usuario autenticado */
  getProfile: () => apiRequest('/users/profile'),

  /** Actualizar a premium */
  upgrade: () =>
    apiRequest('/users/upgrade', { method: 'PATCH' }),
};

// ---- Mapas ----
export const mapsAPI = {
  /** Obtener ubicaciones patrocinadas */
  getSponsored: () => apiRequest('/maps/sponsored'),

  /** Descargar mapa offline (solo premium) */
  downloadOffline: () => apiRequest('/maps/download'),
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

  /** List users */
  getUsers: () => apiRequest('/admin/users'),

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

  /** Compare captures of the same route */
  compareCaptures: (routeName, company) => {
    const params = new URLSearchParams({ routeName, ...(company ? { company } : {}) }).toString();
    return apiRequest(`/admin/captures/compare?${params}`);
  },
};

// ---- Community (Quilla XP) ----
export const communityAPI = {
  /** Top contribuidores (público) */
  getLeaderboard: (limit = 10) => apiRequest(`/community/leaderboard?limit=${limit}`),

  /** Perfil XP del usuario autenticado */
  getProfile: () => apiRequest('/community/me'),

  /** Tabla de niveles e insignias disponibles */
  getLevels: () => apiRequest('/community/levels'),
};

export default { routesAPI, usersAPI, mapsAPI, healthAPI, adminAPI, communityAPI };
