/**
 * ============================================
 * SocialBar — Barra flotante de redes sociales
 * ============================================
 *
 * Muestra botones flotantes laterales para seguirnos
 * en Instagram (y futuras redes). Se oculta
 * automáticamente durante la navegación en vivo.
 *
 * Configuración rápida:
 *   - INSTAGRAM_URL: cambiar al perfil real de Instagram
 *   - Añadir más redes descomentando los botones extra
 */

import { useState, useEffect } from 'react';

// ── Configura aquí el username de Instagram ──────────────────────────────────
const INSTAGRAM_URL  = 'https://instagram.com/ruta.quilla';    // ← actualizado con tu usuario
const TIKTOK_URL     = 'https://tiktok.com/@rutaquilla';      // ← opcional, puede ocultarse
const FACEBOOK_URL   = 'https://facebook.com/rutaquilla';     // ← opcional, puede ocultarse
// ─────────────────────────────────────────────────────────────────────────────

/** Ícono SVG de Instagram (versión monocromo blanco) */
function IgIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

/** Ícono SVG de TikTok */
function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.89a8.18 8.18 0 004.78 1.54V7a4.85 4.85 0 01-1.01-.31z" />
    </svg>
  );
}

/** Ícono SVG de Facebook */
function FbIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.024 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.097 24 18.1 24 12.073z" />
    </svg>
  );
}

/**
 * SocialBar — Barra flotante lateral con botones de redes sociales.
 *
 * @param {boolean} hidden - Si true, el componente no se renderiza
 *                          (usado para ocultarlo durante la navegación en vivo)
 */
export default function SocialBar({ hidden = false }) {
  const [visible, setVisible] = useState(false);

  // Slide-in con retardo para no competir con la carga inicial del mapa
  useEffect(() => {
    if (hidden) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [hidden]);

  if (hidden) return null;

  return (
    <div
      className="social-bar"
      style={{
        position: 'fixed',
        left: 0,
        top: '50%',
        transform: `translateY(-50%) translateX(${visible ? '0' : '-110%'})`,
        zIndex: 1050,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
      aria-label="Síguenos en redes sociales"
    >
      {/* Instagram */}
      <SocialButton
        href={INSTAGRAM_URL}
        label="Síguenos en Instagram"
        network="instagram"
        icon={<IgIcon />}
        delay={0}
        visible={visible}
      />

      {/* Facebook */}
      <SocialButton
        href={FACEBOOK_URL}
        label="Síguenos en Facebook"
        network="facebook"
        icon={<FbIcon />}
        delay={80}
        visible={visible}
      />

      {/* TikTok */}
      <SocialButton
        href={TIKTOK_URL}
        label="Síguenos en TikTok"
        network="tiktok"
        icon={<TikTokIcon />}
        delay={160}
        visible={visible}
      />
    </div>
  );
}

/**
 * Botón individual de red social con tooltip y animación hover.
 */
function SocialButton({ href, label, network, icon, delay, visible }) {
  const [hovered, setHovered] = useState(false);

  const networkStyles = {
    instagram: {
      base: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
      glow: 'rgba(253, 29, 29, 0.5)',
      shadow: '0 4px 18px rgba(131, 58, 180, 0.5)',
      shadowHover: '0 6px 28px rgba(253, 29, 29, 0.65)',
    },
    facebook: {
      base: 'linear-gradient(135deg, #1877f2, #0c56c4)',
      glow: 'rgba(24, 119, 242, 0.5)',
      shadow: '0 4px 18px rgba(24, 119, 242, 0.4)',
      shadowHover: '0 6px 28px rgba(24, 119, 242, 0.65)',
    },
    tiktok: {
      base: 'linear-gradient(135deg, #010101, #ff0050)',
      glow: 'rgba(255, 0, 80, 0.5)',
      shadow: '0 4px 18px rgba(255, 0, 80, 0.35)',
      shadowHover: '0 6px 28px rgba(255, 0, 80, 0.6)',
    },
  };

  const style = networkStyles[network];

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        opacity: visible ? 1 : 0,
        transitionDelay: `${delay}ms`,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Botón principal */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        id={`social-btn-${network}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: '0 10px 10px 0',
          background: style.base,
          color: '#fff',
          boxShadow: hovered ? style.shadowHover : style.shadow,
          transform: hovered ? 'translateX(4px) scale(1.08)' : 'translateX(0) scale(1)',
          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textDecoration: 'none',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
          // Subtle left border accent
          borderLeft: `3px solid rgba(255,255,255,0.25)`,
        }}
      >
        {icon}
      </a>

      {/* Tooltip flotante */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 52,
          top: '50%',
          transform: `translateY(-50%) translateX(${hovered ? '0' : '-4px'})`,
          opacity: hovered ? 1 : 0,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          background: 'rgba(11, 17, 32, 0.92)',
          color: '#F1F5F9',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          padding: '5px 10px',
          borderRadius: 8,
          border: '1px solid rgba(248, 250, 252, 0.1)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          letterSpacing: '0.02em',
          boxShadow: `0 4px 16px rgba(0,0,0,0.4)`,
        }}
      >
        {label}
      </span>
    </div>
  );
}
