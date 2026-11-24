/**
 * ============================================
 * RutaQuilla - Header v4 (Señalética Editorial)
 * ============================================
 */

import { useState, useRef, useEffect } from 'react';
import { User, Crown, LogOut, Menu, X, ChevronDown, Shield, Sun, Moon, Search, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Header({ onLoginClick, onMenuToggle, menuOpen, onShowLegal, onAdminClick, routeCount = 0 }) {
  const { user, isAuthenticated, isPremium, logout, remainingFreeSearches, maxFreeSearches } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header
      className="px-2.5 sm:px-3.5"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Left: Hamburger + Marca */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        <button
          onClick={onMenuToggle}
          id="menu-toggle-btn"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: `1px solid ${menuOpen ? 'var(--brand)' : 'var(--border-color)'}`,
            background: menuOpen ? 'var(--brand)' : 'var(--bg-card)',
            color: menuOpen ? 'var(--brand-ink)' : 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
            flexShrink: 0,
          }}
          aria-label="Alternar panel lateral"
        >
          {menuOpen ? <X size={15} /> : <Menu size={15} />}
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              flexShrink: 0,
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              background: 'var(--plate-bg)',
            }}
          >
            <img
              src="/logo.png"
              alt="RutaQuilla"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: 15.5,
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1.05,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span>Ruta</span>
              <span
                style={{
                  background: 'var(--plate-bg)',
                  color: 'var(--plate-fg)',
                  padding: '1px 6px',
                  borderRadius: 5,
                  fontSize: 14,
                  border: '1px solid rgba(255, 194, 26, 0.28)',
                }}
              >
                Quilla
              </span>
            </h1>
            <p
              className="font-mono hidden sm:block"
              style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                margin: 0,
                marginTop: 2,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              }}
            >
              Barranquilla · SITM + TPC
            </p>
          </div>
        </div>
      </div>

      {/* Center: Tablero compacto de estado (solo desktop) */}
      <div
        className="hidden md:flex"
        style={{
          alignItems: 'center',
          gap: 10,
          padding: '5px 12px',
          borderRadius: 8,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isOnline ? 'var(--mangle)' : 'var(--carnaval)',
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: isOnline ? 'var(--mangle)' : 'var(--carnaval)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {isOnline ? 'En línea' : 'Offline'}
          </span>
        </div>

        <div style={{ width: 1, height: 14, background: 'var(--border-color)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Layers size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
            {routeCount > 0 ? `${routeCount} rutas` : 'Red BQ'}
          </span>
        </div>

        {!isAuthenticated && (
          <>
            <div style={{ width: 1, height: 14, background: 'var(--border-color)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Search size={11} style={{ color: remainingFreeSearches > 0 ? 'var(--brand)' : 'var(--carnaval)' }} />
              <span
                className="tabular-nums"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: remainingFreeSearches > 0 ? 'var(--text-secondary)' : 'var(--carnaval)',
                }}
              >
                {remainingFreeSearches}/{maxFreeSearches} gratis
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Acciones + Cuenta */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <a
          href="https://instagram.com/ruta.quilla"
          target="_blank"
          rel="noopener noreferrer"
          id="instagram-btn"
          aria-label="Síguenos en Instagram"
          title="Instagram @ruta.quilla"
          className="rq-icon-btn"
          style={{ width: 30, height: 30, textDecoration: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
        </a>

        <button
          onClick={toggleTheme}
          id="theme-toggle-btn"
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
          className="rq-icon-btn"
          style={{ width: 30, height: 30, color: isDark ? 'var(--brand)' : 'var(--text-primary)' }}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {onAdminClick && (
          <button
            onClick={onAdminClick}
            id="admin-btn"
            className="rq-chip"
            style={{
              height: 34,
              borderColor: 'color-mix(in srgb, var(--brand) 45%, var(--border-color))',
              color: 'var(--brand)',
            }}
          >
            <Shield size={12} /> Admin
          </button>
        )}

        {!isAuthenticated && (
          <div
            className="md:hidden tabular-nums"
            style={{
              padding: '3px 6px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              fontSize: 10,
              fontWeight: 700,
              color: remainingFreeSearches > 0 ? 'var(--brand)' : 'var(--carnaval)',
            }}
          >
            {remainingFreeSearches}/{maxFreeSearches}
          </div>
        )}

        {isAuthenticated ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              id="user-menu-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: 34,
                padding: '0 9px 0 5px',
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: `1px solid ${showUserMenu ? 'var(--brand)' : 'var(--border-color)'}`,
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  flexShrink: 0,
                  background: isPremium ? 'var(--brand)' : 'var(--bg-surface)',
                  border: isPremium ? 'none' : '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isPremium ? <Crown size={12} color="var(--brand-ink)" /> : <User size={12} color="var(--text-secondary)" />}
              </div>

              <div className="hidden sm:block" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                  {user?.name?.split(' ')[0]}
                </div>
                {isPremium && (
                  <div className="font-mono" style={{ fontSize: 8.5, color: 'var(--brand)', fontWeight: 700, letterSpacing: '0.05em' }}>
                    QUILLA-PASS
                  </div>
                )}
              </div>
              <ChevronDown
                size={13}
                color="var(--text-muted)"
                style={{ transition: 'transform 0.18s', transform: showUserMenu ? 'rotate(180deg)' : 'none' }}
              />
            </button>

            {showUserMenu && (
              <div
                className="animate-fade-in rq-sheet"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: 232,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--bg-card)',
                }}
              >
                <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: isPremium ? 'var(--brand)' : 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isPremium ? <Crown size={16} color="var(--brand-ink)" /> : <User size={16} color="var(--text-secondary)" />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      padding: '6px 10px',
                      borderRadius: 7,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Contribuciones</span>
                    <span className="tabular-nums" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mangle)' }}>
                      {user?.contributions || 0}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onShowLegal?.('privacy');
                    setShowUserMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--subtle-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Shield size={14} /> Privacidad y Legal
                </button>

                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  id="logout-btn"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    border: 'none',
                    borderTop: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--carnaval)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--carnaval-soft)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            id="login-btn"
            className="rq-btn-primary"
            style={{ padding: '0 10px', fontSize: 11.5, height: 30, whiteSpace: 'nowrap' }}
          >
            <span className="sm:hidden">Ingresar</span>
            <span className="hidden sm:inline">Iniciar sesión</span>
          </button>
        )}
      </div>
    </header>
  );
}
