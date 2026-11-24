/**
 * ============================================
 * RutaQuilla - Report Action Panel
 * ============================================
 *
 * Panel flotante (bottom-sheet) que aparece al tocar
 * un reporte en el mapa. Permite:
 * - Ver detalles del reporte
 * - Confirmar ✅ (+15 min, +2 XP)
 * - Descartar 👎 (votar para remover: invalido/solucionado/vencido)
 *
 * Mobile-first: aparece desde abajo como un card compacto.
 */

import { useState, useCallback } from 'react';
import {
  X,
  ThumbsUp,
  ThumbsDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Bus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportAPI } from '../services/api';

const DISMISS_OPTIONS = [
  { id: 'invalido',    icon: XCircle,      color: '#E5484D', label: 'Reporte inválido',     desc: 'No es real o es falso' },
  { id: 'solucionado', icon: CheckCircle2, color: '#1F9D6B', label: 'Problema solucionado', desc: 'Ya se resolvió' },
  { id: 'vencido',     icon: Clock,        color: '#D99B00', label: 'Ya no aplica',         desc: 'La situación cambió' },
];

export default function ReportActionPanel({ report, onClose, onActionDone }) {
  const { isAuthenticated } = useAuth();
  const [showDismissOptions, setShowDismissOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleConfirm = useCallback(async () => {
    if (!isAuthenticated) {
      setFeedback({ type: 'error', msg: 'Inicia sesión para confirmar' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setLoading(true);
    try {
      const res = await reportAPI.confirm(report._id);
      setFeedback({ type: 'success', msg: res.message || 'Reporte confirmado' });
      setTimeout(() => { onActionDone?.(); onClose(); }, 1500);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al confirmar' });
      setTimeout(() => setFeedback(null), 3000);
    } finally { setLoading(false); }
  }, [report, isAuthenticated, onActionDone, onClose]);

  const handleDismiss = useCallback(async (reason) => {
    if (!isAuthenticated) {
      setFeedback({ type: 'error', msg: 'Inicia sesión para votar' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setLoading(true);
    try {
      const res = await reportAPI.dismiss(report._id, reason);
      setFeedback({ type: 'success', msg: res.message || 'Voto registrado' });
      setTimeout(() => { onActionDone?.(); onClose(); }, 1500);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al votar' });
      setTimeout(() => setFeedback(null), 3000);
    } finally { setLoading(false); setShowDismissOptions(false); }
  }, [report, isAuthenticated, onActionDone, onClose]);

  if (!report) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1400,
        background: 'rgba(13, 16, 20, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rq-sheet"
        style={{
          width: '100%', maxWidth: 400,
          borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
          borderBottom: 'none',
          padding: '10px 18px 22px',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        <div className="sheet-handle" />
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button
            type="button"
            onClick={onClose}
            className="rq-icon-btn"
            style={{ width: 28, height: 28 }}
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Report info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: `${report.color || '#D99B00'}16`,
            border: `1.5px solid ${report.color || '#D99B00'}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
            color: report.color || '#D99B00',
          }}>
            {report.emoji || <AlertTriangle size={20} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="font-display" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {report.label || 'Reporte'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              {report.routeCodigo && (
                <span className="transit-code" style={{ '--route-color': report.color || 'var(--brand)' }}>{report.routeCodigo}</span>
              )}
              <span style={{
                fontSize: 11.5, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Bus size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                {report.routeName}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {report.description && (
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.45 }}>
            "{report.description}"
          </p>
        )}

        {/* Stats row */}
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--text-muted)',
          padding: '8px 10px', borderRadius: 10,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          marginBottom: 14,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <User size={11} />
            {report.userName}
          </span>
          <span className="tabular-nums font-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />
            hace {report.minutesAgo || '?'}m
          </span>
          {report.confirmations > 0 && (
            <span className="tabular-nums font-mono" style={{ color: 'var(--mangle)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <CheckCircle2 size={11} />
              {report.confirmations}
            </span>
          )}
          {report.dismissals > 0 && (
            <span className="tabular-nums font-mono" style={{ color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <ThumbsDown size={11} />
              {report.dismissals}/3
            </span>
          )}
          <span className="tabular-nums font-mono" style={{ marginLeft: 'auto', color: 'var(--caribe)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} />
            {report.minutesLeft || '?'} min
          </span>
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{
            padding: '8px 12px', borderRadius: 10, marginBottom: 10,
            background: feedback.type === 'success' ? 'rgba(31, 157, 107, 0.12)' : 'rgba(229, 72, 77, 0.12)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(31, 157, 107, 0.28)' : 'rgba(229, 72, 77, 0.28)'}`,
            color: feedback.type === 'success' ? 'var(--mangle)' : 'var(--carnaval)',
            fontSize: 12, fontWeight: 600, textAlign: 'center',
          }}>{feedback.msg}</div>
        )}

        {/* Action buttons */}
        {!showDismissOptions ? (
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Confirmar */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                background: 'var(--mangle)',
                color: '#FFFFFF', fontWeight: 700, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s',
              }}
            >
              <ThumbsUp size={14} />
              Confirmar
            </button>

            {/* Descartar */}
            <button
              type="button"
              onClick={() => setShowDismissOptions(true)}
              disabled={loading}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(229, 72, 77, 0.12)',
                color: 'var(--carnaval)', fontWeight: 700, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: '1px solid rgba(229, 72, 77, 0.3)',
                opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s',
              }}
            >
              <ThumbsDown size={14} />
              Descartar
            </button>
          </div>
        ) : (
          /* Dismiss reason options */
          <div>
            <p className="rq-section-label" style={{ marginBottom: 8 }}>
              ¿Por qué quieres descartar este reporte?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DISMISS_OPTIONS.map(opt => {
                const OptIcon = opt.icon;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => handleDismiss(opt.id)}
                    disabled={loading}
                    style={{
                      padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <OptIcon size={16} color={opt.color} style={{ flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</p>
                      <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-muted)' }}>{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowDismissOptions(false)}
                style={{
                  padding: '8px 0', borderRadius: 8, border: 'none',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontSize: 11.5, cursor: 'pointer', fontWeight: 600,
                }}
              >
                ← Volver
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', margin: '10px 0 0', lineHeight: 1.4 }}>
          Confirmar extiende el reporte +15 min. 3 votos de descarte lo remueven automáticamente.
        </p>
      </div>

      {/* slideUp animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
