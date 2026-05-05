/**
 * ============================================
 * RutaQuilla - Contexto de Tema (Claro/Oscuro)
 * ============================================
 *
 * React Context que gestiona el modo claro/oscuro:
 * - Persistencia de preferencia en localStorage
 * - Respeta prefers-color-scheme del sistema como default
 * - Aplica data-theme en <html> para activar las CSS variables
 * - Expone `theme` y `toggleTheme` a toda la app
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

const THEME_KEY = 'rutaquilla_theme';

/**
 * Determine initial theme:
 * 1. Check localStorage for saved preference
 * 2. Fall back to system prefers-color-scheme
 * 3. Default to 'dark'
 */
function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;

  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply the theme to <html> whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook para acceder al contexto de tema.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de un ThemeProvider');
  }
  return context;
}

export default ThemeContext;
