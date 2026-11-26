/**
 * ============================================
 * RutaQuilla - Contexto de Autenticación
 * ============================================
 * 
 * React Context que gestiona el estado de autenticación:
 * - Login/Registro con JWT
 * - Persistencia de sesión en localStorage
 * - Estado del usuario (free/premium)
 * - Sistema freemium: 3 búsquedas gratis sin registro
 * - Funciones de auth disponibles en toda la app
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usersAPI, mapsAPI, setToken, removeToken } from '../services/api';

const AuthContext = createContext(null);

const DEFAULT_FREE_SEARCHES = 3;
const USAGE_KEY = 'rutaquilla_usage_count';

const DEFAULT_PUBLIC_CONFIG = {
  registrationEnabled: true,
  botShieldEnabled: true,
  strictEmailValidation: true,
  requireEmailVerification: true,
  turnstileEnabled: false,
  turnstileSiteKey: '',
  reportsEnabled: true,
  capturesEnabled: true,
  maxFreeSearches: DEFAULT_FREE_SEARCHES,
  banner: { enabled: false, type: 'info', text: '' },
  formToken: '',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publicConfig, setPublicConfig] = useState(DEFAULT_PUBLIC_CONFIG);

  const refreshPublicConfig = useCallback(async () => {
    try {
      const res = await mapsAPI.getPublicConfig();
      if (res?.data) {
        setPublicConfig((prev) => ({ ...prev, ...res.data }));
      }
    } catch (_) {
      // Fallback silencioso a valores por defecto
    }
  }, []);

  useEffect(() => {
    refreshPublicConfig();
  }, [refreshPublicConfig]);

  // Freemium: usage counter (persisted in localStorage)
  const [usageCount, setUsageCount] = useState(() => {
    const stored = localStorage.getItem(USAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });

  /**
   * Verificar sesión existente al montar el componente.
   * Si hay un token en localStorage, intenta obtener el perfil.
   */
  useEffect(() => {
    async function checkSession() {
      const token = localStorage.getItem('rutaquilla_token');
      if (token) {
        try {
          const response = await usersAPI.getProfile();
          setUser(response.data);
        } catch (err) {
          // Only clear session on auth errors (401/403).
          // Network errors or server errors are transient — keep the session alive.
          if (err?.status === 401 || err?.status === 403) {
            removeToken();
            setUser(null);
          } else {
            console.warn('⚠️ Error transitorio al verificar sesión, manteniendo sesión:', err?.message || err);
          }
        }
      }
      setLoading(false);
    }
    checkSession();
  }, []);

  /**
   * Registrar nuevo usuario.
   */
  const register = useCallback(async (name, email, password, antiBotMeta = {}) => {
    setError(null);
    try {
      const response = await usersAPI.register({ name, email, password, ...antiBotMeta });
      // If server requires verification, don't log in yet
      if (response.data?.requiresVerification) {
        return response;
      }
      // Auto-verified (email not configured on server)
      if (response.data?.token) {
        setToken(response.data.token);
        setUser(response.data.user);
      }
      return response;
    } catch (err) {
      setError(err.message || 'Error al registrar');
      throw err;
    }
  }, []);

  /**
   * Verificar email con código de 6 dígitos.
   */
  const verifyEmail = useCallback(async (email, code) => {
    setError(null);
    try {
      const response = await usersAPI.verify(email, code);
      if (response.data?.token) {
        setToken(response.data.token);
        setUser(response.data.user);
      }
      return response;
    } catch (err) {
      setError(err.message || 'Código inválido');
      throw err;
    }
  }, []);

  /**
   * Reenviar código de verificación.
   */
  const resendCode = useCallback(async (email) => {
    try {
      return await usersAPI.resendCode(email);
    } catch (err) {
      setError(err.message || 'Error al reenviar código');
      throw err;
    }
  }, []);

  /**
   * Iniciar sesión.
   */
  const login = useCallback(async (email, password, antiBotMeta = {}) => {
    setError(null);
    try {
      const response = await usersAPI.login({ email, password, ...antiBotMeta });
      if (response.data?.requiresTwoFactor) {
        return { requiresTwoFactor: true, email: response.data.email };
      }
      setToken(response.data.token);
      setUser(response.data.user);
      return response;
    } catch (err) {
      // Handle NOT_VERIFIED — don't throw, return so modal can show verify step
      if (err.code === 'NOT_VERIFIED') {
        return { notVerified: true, email: err.data?.email };
      }
      setError(err.message || 'Credenciales incorrectas');
      throw err;
    }
  }, []);

  /**
   * Verificar segundo factor 2FA de acceso Administrador.
   */
  const verifyTwoFactor = useCallback(async (email, code) => {
    setError(null);
    try {
      const response = await usersAPI.verify2FA(email, code);
      if (response.data?.token) {
        setToken(response.data.token);
        setUser(response.data.user);
      }
      return response;
    } catch (err) {
      setError(err.message || 'Código 2FA incorrecto');
      throw err;
    }
  }, []);

  /**
   * Cerrar sesión.
   */
  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    setError(null);
    // Clear app-level localStorage to fully clean the session
    localStorage.removeItem(USAGE_KEY);
    localStorage.removeItem('rutaquilla_favorites');
  }, []);

  /**
   * Actualizar a premium (Quilla-Pass).
   */
  const upgradeToPremium = useCallback(async () => {
    try {
      const response = await usersAPI.upgrade();
      setUser(prev => ({ ...prev, role: 'premium', isPremium: true }));
      return response;
    } catch (err) {
      setError(err.message || 'Error al actualizar plan');
      throw err;
    }
  }, []);

  const maxFreeSearches = Number.isFinite(Number(publicConfig?.maxFreeSearches))
    ? Number(publicConfig.maxFreeSearches)
    : DEFAULT_FREE_SEARCHES;

  /**
   * Freemium: ¿Puede el usuario navegar?
   * - Autenticado: siempre puede
   * - No autenticado: solo si tiene usos restantes (999 = ilimitado)
   */
  const canNavigate = useCallback(() => {
    if (user) return true;
    if (maxFreeSearches >= 999) return true;
    return usageCount < maxFreeSearches;
  }, [user, usageCount, maxFreeSearches]);

  /**
   * Freemium: Incrementar el contador de uso.
   * Solo incrementa si NO está autenticado.
   */
  const incrementUsage = useCallback(() => {
    if (user) return; // Usuarios registrados: ilimitado
    const newCount = usageCount + 1;
    setUsageCount(newCount);
    localStorage.setItem(USAGE_KEY, newCount.toString());
  }, [user, usageCount]);

  const remainingFreeSearches = maxFreeSearches >= 999 ? 999 : Math.max(0, maxFreeSearches - usageCount);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isPremium: user?.isPremium || user?.role === 'premium' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    publicConfig,
    refreshPublicConfig,
    register,
    verifyEmail,
    verifyTwoFactor,
    resendCode,
    login,
    logout,
    upgradeToPremium,
    clearError: () => setError(null),
    // Freemium
    canNavigate,
    incrementUsage,
    usageCount,
    remainingFreeSearches,
    maxFreeSearches,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para acceder al contexto de autenticación.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}

export default AuthContext;
