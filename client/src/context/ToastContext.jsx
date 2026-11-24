import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_META = {
  success: { color: '#1F9D6B', icon: CheckCircle2 },
  error: { color: '#E5484D', icon: XCircle },
  warning: { color: '#D99B00', icon: AlertTriangle },
  info: { color: '#3B8BF0', icon: Info },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', duration = 3800) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message: String(message), type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const api = useMemo(
    () => ({
      show,
      success: (msg, dur) => show(msg, 'success', dur),
      error: (msg, dur) => show(msg, 'error', dur),
      warning: (msg, dur) => show(msg, 'warning', dur),
      info: (msg, dur) => show(msg, 'info', dur),
      dismiss,
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 68,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3000,
            width: 'calc(100% - 24px)',
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => {
            const meta = TOAST_META[t.type] || TOAST_META.info;
            const Icon = meta.icon;
            return (
              <div
                key={t.id}
                className="animate-fade-in rq-card"
                style={{
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: 12,
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--border-color)',
                  borderLeft: `3px solid ${meta.color}`,
                  boxShadow: 'var(--shadow-lg)',
                  color: 'var(--text-primary)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                <Icon size={16} color={meta.color} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Cerrar notificación"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 2,
                    flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return ctx;
}
