/**
 * ============================================
 * RutaQuilla - Header v3 (Premium + Freemium)
 * ============================================
 */

import { useState, useRef, useEffect } from 'react';
import { Bus, User, Crown, LogOut, Menu, X, ChevronDown, Zap, Search, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({ onLoginClick, onMenuToggle, menuOpen, onShowLegal }) {
  const { user, isAuthenticated, isPremium, logout, remainingFreeSearches, maxFreeSearches } = useAuth();
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
        background: 'rgba(7, 11, 22, 0.88)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Left: Logo + hamburger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onMenuToggle}
          id="menu-toggle-btn"
          className="md:hidden"
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: menuOpen ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
            color: menuOpen ? '#F59E0B' : '#94A3B8',
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
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 60%, #92400E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
          }}>
            <Bus size={20} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{
              fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 800,
              color: '#F1F5F9', lineHeight: 1, letterSpacing: '-0.3px',
              margin: 0,
            }}>
              Ruta<span style={{ color: '#F59E0B' }}>Quilla</span>
            </h1>
            <p style={{ fontSize: 10, color: '#475569', margin: 0, lineHeight: 1, marginTop: 2 }}>
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

      {/* Right: Auth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                background: showUserMenu ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showUserMenu ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                background: isPremium
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'rgba(255,255,255,0.08)',
                border: isPremium ? 'none' : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isPremium ? '0 2px 10px rgba(245,158,11,0.3)' : 'none',
              }}>
                {isPremium ? <Crown size={13} color="#000" /> : <User size={13} color="#94A3B8" />}
              </div>

              <div className="hidden sm:block" style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', lineHeight: 1.2 }}>
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
                  background: 'rgba(15, 20, 38, 0.97)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(24px)',
                }}
              >
                {/* User info */}
                <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 12,
                      background: isPremium ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255,255,255,0.07)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isPremium ? '0 4px 12px rgba(245,158,11,0.3)' : 'none',
                    }}>
                      {isPremium ? <Crown size={18} color="#000" /> : <User size={18} color="#94A3B8" />}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', margin: 0 }}>
                        {user?.name}
                      </p>
                      <p style={{ fontSize: 11, color: '#475569', margin: 0, marginTop: 1 }}>
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
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>Contribuciones</span>
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
                    color: '#94A3B8', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
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
                    borderTop: '1px solid rgba(255,255,255,0.04)',
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
