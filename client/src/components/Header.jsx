/**
 * ============================================
 * RutaQuilla - Header v3 (Premium + Freemium)
 * ============================================
 */

import { useState, useRef, useEffect } from 'react';
import { Bus, User, Crown, LogOut, Menu, X, ChevronDown, Zap, Search, Shield, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Header({ onLoginClick, onMenuToggle, menuOpen, onShowLegal, onAdminClick }) {
  const { user, isAuthenticated, isPremium, logout, remainingFreeSearches, maxFreeSearches } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
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
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
        height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid var(--subtle-border)',
        boxShadow: `0 4px 24px var(--shadow-color)`,
      }}
    >
      {/* Left: Logo + hamburger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onMenuToggle}
          id="menu-toggle-btn"
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: menuOpen ? 'rgba(245,158,11,0.15)' : 'var(--subtle-bg)',
            color: menuOpen ? '#F59E0B' : 'var(--btn-text-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s',
            flexShrink: 0,
          }}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={17} /> : <Menu size={17} />}
        </button>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
          }}>
            <img
              src="/logo.png"
              alt="Ruta-Quilla Logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div>
            <h1 style={{
              fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 800,
              color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.3px',
              margin: 0,
            }}>
              Ruta<span style={{ color: '#F59E0B' }}>Quilla</span>
            </h1>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, lineHeight: 1, marginTop: 2 }}>
              Barranquilla Transit
            </p>
          </div>
        </div>
      </div>

      {/* Center: status pill (only desktop) */}
      <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#10B981',
            boxShadow: '0 0 8px rgba(16,185,129,0.7)',
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#34D399', letterSpacing: '0.03em' }}>
            En línea
          </span>
        </div>

        {/* Free searches badge (only when not authenticated) */}
        {!isAuthenticated && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 20,
            background: remainingFreeSearches > 0
              ? 'rgba(245,158,11,0.07)'
              : 'rgba(239,68,68,0.07)',
            border: `1px solid ${remainingFreeSearches > 0
              ? 'rgba(245,158,11,0.2)'
              : 'rgba(239,68,68,0.2)'}`,
          }}>
            <Search size={11} color={remainingFreeSearches > 0 ? '#F59E0B' : '#EF4444'} />
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: remainingFreeSearches > 0 ? '#FBBF24' : '#F87171',
            }}>
              {remainingFreeSearches}/{maxFreeSearches} gratis
            </span>
          </div>
        )}

        {/* Route count badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 20,
          background: 'rgba(6,182,212,0.07)',
          border: '1px solid rgba(6,182,212,0.15)',
        }}>
          <Zap size={11} color="#06B6D4" />
          <span style={{ fontSize: 11, fontWeight: 500, color: '#22D3EE' }}>
            Transporte BQ
          </span>
        </div>
      </div>

      {/* Right: Auth + Admin */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Instagram button — minimal icon with gradient glow */}
        <a
          href="https://instagram.com/ruta.quilla"
          target="_blank"
          rel="noopener noreferrer"
          id="instagram-btn"
          aria-label="Síguenos en Instagram"
          title="Síguenos en Instagram @Ruta.quilla"
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94A3B8',
            textDecoration: 'none',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)';
            e.currentTarget.style.border = '1px solid transparent';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(253,29,29,0.4)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
            e.currentTarget.style.color = '#94A3B8';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
        </a>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          id="theme-toggle-btn"
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--subtle-bg)',
            border: '1px solid var(--subtle-border-strong)',
            color: isDark ? '#FBBF24' : '#6366F1',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isDark ? 'rgba(251,191,36,0.15)' : 'rgba(99,102,241,0.12)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--subtle-bg)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Admin button */}
        {onAdminClick && (
          <button
            onClick={onAdminClick}
            id="admin-btn"
            style={{
              padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)',
              background: 'rgba(245,158,11,0.1)', color: '#F59E0B',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
          >
            <Shield size={12} /> Admin
          </button>
        )}
        {/* Mobile: free searches badge */}
        {!isAuthenticated && (
          <div className="md:hidden" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 12,
            background: remainingFreeSearches > 0
              ? 'rgba(245,158,11,0.1)'
              : 'rgba(239,68,68,0.1)',
            border: `1px solid ${remainingFreeSearches > 0
              ? 'rgba(245,158,11,0.25)'
              : 'rgba(239,68,68,0.25)'}`,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: remainingFreeSearches > 0 ? '#FBBF24' : '#F87171',
            }}>
              {remainingFreeSearches}/{maxFreeSearches}
            </span>
          </div>
        )}

        {isAuthenticated ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              id="user-menu-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px 6px 6px',
                borderRadius: 14,
                background: showUserMenu ? 'var(--subtle-bg-hover)' : 'var(--subtle-bg)',
                border: `1px solid ${showUserMenu ? 'var(--subtle-border-strong)' : 'var(--subtle-border)'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--subtle-bg-hover)'; }}
              onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = 'var(--subtle-bg)'; }}
            >
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                background: isPremium
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'var(--subtle-bg-hover)',
                border: isPremium ? 'none' : '1px solid var(--subtle-border-strong)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isPremium ? '0 2px 10px rgba(245,158,11,0.3)' : 'none',
              }}>
                {isPremium ? <Crown size={13} color="#000" /> : <User size={13} color="var(--btn-text-color)" />}
              </div>

              <div className="hidden sm:block" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {user?.name?.split(' ')[0]}
                </div>
                {isPremium && (
                  <div style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Quilla-Pass ✦
                  </div>
                )}
              </div>
              <ChevronDown size={13} color="#64748B" style={{ transition: 'transform 0.2s', transform: showUserMenu ? 'rotate(180deg)' : 'none' }} />
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div
                className="animate-fade-in"
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 220, borderRadius: 18, overflow: 'hidden',
                  background: 'var(--dropdown-bg)',
                  border: '1px solid var(--subtle-border-strong)',
                  boxShadow: '0 20px 60px var(--shadow-color)',
                  backdropFilter: 'blur(24px)',
                }}
              >
                {/* User info */}
                <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--subtle-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 12,
                      background: isPremium ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'var(--subtle-bg-hover)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isPremium ? '0 4px 12px rgba(245,158,11,0.3)' : 'none',
                    }}>
                      {isPremium ? <Crown size={18} color="#000" /> : <User size={18} color="#94A3B8" />}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {user?.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 1 }}>
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 10, padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(6,182,212,0.07)',
                    border: '1px solid rgba(6,182,212,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Contribuciones</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#06B6D4' }}>
                      {user?.contributions || 0}
                    </span>
                  </div>
                </div>

                {/* Legal link */}
                <button
                  onClick={() => { onShowLegal?.('privacy'); setShowUserMenu(false); }}
                  style={{
                    width: '100%', padding: '10px 16px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    border: 'none', background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--subtle-bg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Shield size={14} /> Privacidad y Legal
                </button>

                {/* Logout */}
                <button
                  onClick={() => { logout(); setShowUserMenu(false); }}
                  id="logout-btn"
                  style={{
                    width: '100%', padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    border: 'none', background: 'transparent',
                    color: '#F87171', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.15s',
                    borderTop: '1px solid var(--subtle-border)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <LogOut size={15} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            id="login-btn"
            style={{
              padding: '8px 18px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: '#000', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(245,158,11,0.3)'; }}
          >
            Iniciar sesión
          </button>
        )}
      </div>
    </header>
  );
}
