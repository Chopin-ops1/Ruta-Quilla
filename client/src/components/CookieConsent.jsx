/**
 * ============================================
 * RutaQuilla - Banner de Consentimiento de Cookies
 * ============================================
 * 
 * Banner no invasivo que aparece la primera vez que
 * el usuario visita la página. Se almacena el
 * consentimiento en localStorage.
 */

import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'rutaquilla_cookies_accepted';

export default function CookieConsent({ onShowPrivacy }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner after a short delay if not yet accepted
    const accepted = localStorage.getItem(CONSENT_KEY);
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="animate-slide-up"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 1500,
        width: 'auto',
        maxWidth: 520,
        margin: '0 auto',
        borderRadius: 20,
        background: 'rgba(17, 24, 39, 0.95)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Cookie icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 20 }}>🍪</span>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 12.5, color: '#CBD5E1', lineHeight: 1.5, margin: 0,
        }}>
          Usamos almacenamiento local para tu sesión y preferencias.{' '}
          <button
            onClick={onShowPrivacy}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#06B6D4', fontSize: 12.5, fontWeight: 600,
              textDecoration: 'underline', padding: 0,
            }}
          >
            Política de Privacidad
          </button>
        </p>
      </div>

      {/* Accept button */}
      <button
        onClick={handleAccept}
        style={{
          flexShrink: 0,
          padding: '8px 18px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          color: '#000', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
      >
        Aceptar
      </button>
    </div>
  );
}
