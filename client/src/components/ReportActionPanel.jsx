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
import { X, ThumbsUp, ThumbsDown, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportAPI } from '../services/api';

const DISMISS_OPTIONS = [
  { id: 'invalido',    emoji: '❌', label: 'Reporte inválido',      desc: 'No es real o es falso' },
  { id: 'solucionado', emoji: '✅', label: 'Problema solucionado',  desc: 'Ya se resolvió' },
  { id: 'vencido',     emoji: '⏰', label: 'Ya no aplica',          desc: 'La situación cambió' },
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
      setFeedback({ type: 'success', msg: res.message || '✅ Confirmado' });
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
      setFeedback({ type: 'success', msg: res.message || '📊 Voto registrado' });
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
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400,
          background: 'linear-gradient(160deg, #111827, #0B1120)',
          borderRadius: '20px 20px 0 0',
          padding: '16px 18px 24px',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
          fontFamily: 'Inter, sans-serif',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
            width: 28, height: 28, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} color="#64748B" />
          </button>
        </div>

        {/* Report info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `${report.color || '#F59E0B'}15`,
            border: `2px solid ${report.color || '#F59E0B'}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {report.emoji || '⚠️'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>
              {report.label || 'Reporte'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {report.routeCodigo && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#F59E0B',
                  background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4,
                }}>{report.routeCodigo}</span>
              )}
              <span style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🚌 {report.routeName}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {report.description && (
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 10px', lineHeight: 1.4 }}>
            "{report.description}"
          </p>
        )}

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 10, fontSize: 11, color: '#64748B',
          padding: '8px 10px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          marginBottom: 14,
        }}>
          <span>👤 {report.userName}</span>
          <span>⏰ hace {report.minutesAgo || '?'} min</span>
          {report.confirmations > 0 && <span style={{ color: '#10B981' }}>✅ {report.confirmations}</span>}
          {report.dismissals > 0 && <span style={{ color: '#F59E0B' }}>👎 {report.dismissals}/3</span>}
          <span style={{ marginLeft: 'auto', color: '#06B6D4' }}>
            <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {report.minutesLeft || '?'} min
          </span>
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{
            padding: '8px 12px', borderRadius: 10, marginBottom: 10,
            background: feedback.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: feedback.type === 'success' ? '#10B981' : '#EF4444',
            fontSize: 12, fontWeight: 600, textAlign: 'center',
          }}>{feedback.msg}</div>
        )}

        {/* Action buttons */}
        {!showDismissOptions ? (
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Confirmar */}
            <button
              onClick={handleConfirm}
              disabled={loading}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: loading ? 0.5 : 1, transition: 'all 0.2s',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              <ThumbsUp size={14} />
              Confirmar
            </button>

            {/* Descartar */}
            <button
              onClick={() => setShowDismissOptions(true)}
              disabled={loading}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                background: 'rgba(239,68,68,0.1)',
                color: '#EF4444', fontWeight: 700, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: '1px solid rgba(239,68,68,0.2)',
                opacity: loading ? 0.5 : 1, transition: 'all 0.2s',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              <ThumbsDown size={14} />
              Descartar
            </button>
          </div>
        ) : (
          /* Dismiss reason options */
          <div>
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8, fontWeight: 600 }}>
              ¿Por qué quieres descartar este reporte?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DISMISS_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleDismiss(opt.id)}
                  disabled={loading}
                  style={{
                    padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.03)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>{opt.label}</p>
                    <p style={{ margin: 0, fontSize: 10, color: '#64748B' }}>{opt.desc}</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setShowDismissOptions(false)}
                style={{
                  padding: '8px 0', borderRadius: 8, border: 'none',
                  background: 'transparent', color: '#64748B',
                  fontSize: 11, cursor: 'pointer', fontWeight: 600,
                }}
              >
                ← Volver
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: 9, color: '#334155', textAlign: 'center', marginTop: 10 }}>
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
