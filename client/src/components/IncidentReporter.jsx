/**
 * ============================================
 * RutaQuilla - Incident Reporter
 * ============================================
 *
 * Floating action button + modal for submitting
 * real-time reports (incidents, traffic, floods).
 *
 * Mobile-first: bottom-right floating button,
 * bottom-sheet modal on mobile, centered on desktop.
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Send, ThumbsUp, MapPin, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportAPI } from '../services/api';

const REPORT_TYPES = [
  { id: 'desvio',     emoji: '🔀', label: 'Desvío de ruta',  color: '#F59E0B' },
  { id: 'cancelada',  emoji: '🚫', label: 'Ruta cancelada',  color: '#EF4444' },
  { id: 'trafico',    emoji: '🚗', label: 'Tráfico pesado',  color: '#F97316' },
  { id: 'peligro',    emoji: '⚠️', label: 'Zona peligrosa',  color: '#DC2626' },
  { id: 'inundacion', emoji: '🌊', label: 'Calle inundada',  color: '#3B82F6' },
  { id: 'accidente',  emoji: '💥', label: 'Accidente',       color: '#A855F7' },
  { id: 'otro',       emoji: '📌', label: 'Otro',            color: '#64748B' },
];

export default function IncidentReporter({ userPosition, onReportCreated }) {
  const { isAuthenticated, user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [routeName, setRouteName] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', msg }

  const handleOpen = useCallback(() => {
    if (!isAuthenticated) {
      setFeedback({ type: 'error', msg: 'Inicia sesión para reportar' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    if (!userPosition) {
      setFeedback({ type: 'error', msg: 'Activa tu GPS para reportar' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setShowModal(true);
    setSelectedType(null);
    setDescription('');
    setRouteName('');
  }, [isAuthenticated, userPosition]);

  const handleSubmit = useCallback(async () => {
    if (!selectedType || !userPosition) return;
    setSending(true);
    try {
      const res = await reportAPI.create({
        type: selectedType,
        description,
        routeName,
        location: { lat: userPosition.lat, lng: userPosition.lng },
      });
      setFeedback({ type: 'success', msg: res.message || '¡Reporte enviado!' });
      setShowModal(false);
      onReportCreated?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al enviar' });
    } finally {
      setSending(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  }, [selectedType, description, routeName, userPosition, onReportCreated]);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          zIndex: 1100,
          width: 50,
          height: 50,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        title="Reportar incidencia"
      >
        <AlertTriangle size={22} color="#000" strokeWidth={2.5} />
      </button>

      {/* Feedback toast */}
      {feedback && (
        <div style={{
          position: 'fixed',
          bottom: 140,
          right: 16,
          zIndex: 1200,
          padding: '10px 16px',
          borderRadius: 12,
          background: feedback.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          maxWidth: 260,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.3s ease-out',
          fontFamily: 'Inter, sans-serif',
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Modal / Bottom Sheet */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'linear-gradient(160deg, #111827, #0B1120)',
              borderRadius: '20px 20px 0 0',
              padding: '20px 20px 28px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#F59E0B" />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#F1F5F9', fontFamily: 'Outfit, sans-serif' }}>
                  Reportar incidencia
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
                width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={14} color="#94A3B8" />
              </button>
            </div>

            {/* Location indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              marginBottom: 16, fontSize: 11, color: '#10B981',
            }}>
              <MapPin size={12} />
              <span>Tu ubicación actual será usada para el reporte</span>
            </div>

            {/* Type grid */}
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8, fontWeight: 600 }}>¿Qué está pasando?</p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16,
            }}>
              {REPORT_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 12,
                    border: selectedType === t.id ? `2px solid ${t.color}` : '1px solid rgba(255,255,255,0.08)',
                    background: selectedType === t.id ? `${t.color}15` : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{t.emoji}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: selectedType === t.id ? t.color : '#94A3B8',
                  }}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Optional fields */}
            <input
              type="text"
              placeholder="Ruta afectada (ej: C20, B1)"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              maxLength={50}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#E2E8F0', fontSize: 13,
                marginBottom: 8, outline: 'none', boxSizing: 'border-box',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            <textarea
              placeholder="Descripción breve (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#E2E8F0', fontSize: 13, resize: 'none',
                marginBottom: 16, outline: 'none', boxSizing: 'border-box',
                fontFamily: 'Inter, sans-serif',
              }}
            />

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!selectedType || sending}
              style={{
                width: '100%', padding: '14px 0',
                borderRadius: 14, border: 'none',
                background: selectedType
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'rgba(255,255,255,0.06)',
                color: selectedType ? '#000' : '#475569',
                fontWeight: 700, fontSize: 14,
                cursor: selectedType ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: sending ? 0.6 : 1,
                fontFamily: 'Outfit, sans-serif',
                transition: 'all 0.2s',
              }}
            >
              <Send size={14} />
              {sending ? 'Enviando...' : 'Enviar reporte (+10 XP)'}
            </button>

            <p style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 10 }}>
              <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Los reportes se muestran por 1 hora y otros usuarios pueden confirmarlos
            </p>
          </div>
        </div>
      )}
    </>
  );
}
