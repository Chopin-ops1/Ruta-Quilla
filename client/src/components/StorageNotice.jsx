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
import { ShieldCheck } from 'lucide-react';
import { isNativeApp } from '../utils/platform';

const CONSENT_KEY = 'rutaquilla_cookies_accepted';

export default function StorageNotice({ onShowPrivacy }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isNativeApp()) return;
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
      className="animate-slide-up rq-sheet"
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        right: 12,
        zIndex: 1500,
        width: 'auto',
        maxWidth: 520,
        margin: '0 auto',
        borderRadius: 14,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'nowrap',
      }}
    >
      {/* Storage icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--brand)',
      }}>
        <ShieldCheck size={17} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0,
        }}>
          Usamos almacenamiento local para tu sesión y preferencias.{' '}
          <button
            type="button"
            onClick={onShowPrivacy}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--caribe)', fontSize: 11.5, fontWeight: 600,
              textDecoration: 'underline', padding: 0,
            }}
          >
            Política de Privacidad
          </button>
        </p>
      </div>

      {/* Accept button */}
      <button
        type="button"
        onClick={handleAccept}
        className="rq-btn-primary"
        style={{
          flexShrink: 0,
          padding: '7px 12px',
          fontSize: 11.5,
          whiteSpace: 'nowrap',
        }}
      >
        Aceptar
      </button>
    </div>
  );
}
