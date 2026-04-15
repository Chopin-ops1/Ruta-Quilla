/**
 * ============================================
 * RutaQuilla - Contexto de Autenticación
 * ============================================
 * 
 * React Context que gestiona el estado de autenticación:
 * - Login/Registro con JWT
 * - Persistencia de sesión en localStorage
 * - Estado del usuario (free/premium)
 * - Funciones de auth disponibles en toda la app
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usersAPI, setToken, removeToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          // Token inválido o expirado
          removeToken();
          setUser(null);
        }
      }
      setLoading(false);
    }
    checkSession();
  }, []);

  /**
   * Registrar nuevo usuario.
   */
  const register = useCallback(async (name, email, password) => {
    setError(null);
    try {
      const response = await usersAPI.register({ name, email, password });
      setToken(response.data.token);
      setUser(response.data.user);
      return response;
    } catch (err) {
      setError(err.message || 'Error al registrar');
      throw err;
    }
  }, []);

  /**
   * Iniciar sesión.
   */
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const response = await usersAPI.login({ email, password });
      setToken(response.data.token);
      setUser(response.data.user);
      return response;
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas');
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

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isPremium: user?.isPremium || user?.role === 'premium',
    register,
    login,
    logout,
    upgradeToPremium,
    clearError: () => setError(null),
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
