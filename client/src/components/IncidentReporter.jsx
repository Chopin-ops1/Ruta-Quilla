/**
 * ============================================
 * RutaQuilla - Incident Reporter
 * ============================================
 *
 * Floating action button + bottom-sheet modal for
 * submitting real-time reports.
 *
 * Key features:
 * - Route selection REQUIRED (dropdown from all routes)
 * - Type grid selection
 * - Optional description
 * - GPS position auto-captured
 * - Mobile-first bottom-sheet
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Send, MapPin, Clock, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportAPI, routesAPI } from '../services/api';

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
  const { isAuthenticated } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null); // { _id, nombre, codigo }
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [routeSearch, setRouteSearch] = useState('');
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);

  // Load routes list once
  useEffect(() => {
    routesAPI.getAll().then(res => {
      const list = (res.data || []).map(r => ({
        _id: r._id, nombre: r.nombre, codigo: r.codigo || '', operador: r.operador || '',
      }));
      list.sort((a, b) => (a.codigo || a.nombre).localeCompare(b.codigo || b.nombre));
      setRoutes(list);
    }).catch(() => {});
  }, []);

  const filteredRoutes = routes.filter(r => {
    if (!routeSearch) return true;
    const q = routeSearch.toLowerCase();
    return r.nombre.toLowerCase().includes(q)
      || r.codigo.toLowerCase().includes(q)
      || r.operador.toLowerCase().includes(q);
  });

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
    setSelectedRoute(null);
    setRouteSearch('');
    setShowRouteDropdown(false);
  }, [isAuthenticated, userPosition]);

  const handleSubmit = useCallback(async () => {
    if (!selectedType || !userPosition || !selectedRoute) return;
    setSending(true);
    try {
      const res = await reportAPI.create({
        type: selectedType,
        description,
        routeId: selectedRoute._id,
        routeName: selectedRoute.nombre,
        routeCodigo: selectedRoute.codigo,
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
  }, [selectedType, description, selectedRoute, userPosition, onReportCreated]);

  const canSubmit = selectedType && selectedRoute && !sending;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 1100,
          width: 50, height: 50, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
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
          position: 'fixed', bottom: 140, right: 16, zIndex: 1200,
          padding: '10px 16px', borderRadius: 12, maxWidth: 260,
          background: feedback.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', fontSize: 12, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontFamily: 'Inter, sans-serif',
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Modal / Bottom Sheet */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1300,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto',
              background: 'linear-gradient(160deg, #111827, #0B1120)',
              borderRadius: '20px 20px 0 0', padding: '20px 20px 28px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.4)', fontFamily: 'Inter, sans-serif',
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

            {/* GPS indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              marginBottom: 16, fontSize: 11, color: '#10B981',
            }}>
              <MapPin size={12} />
              <span>Tu ubicación actual será usada para el reporte</span>
            </div>

            {/* ---- ROUTE SELECTOR (OBLIGATORIO) ---- */}
            <p style={{ fontSize: 11, color: '#F59E0B', marginBottom: 6, fontWeight: 700 }}>
              🚌 Ruta afectada <span style={{ color: '#EF4444' }}>*</span>
            </p>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <button
                onClick={() => setShowRouteDropdown(!showRouteDropdown)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
                  border: selectedRoute ? '1.5px solid rgba(245,158,11,0.4)' : '1.5px solid rgba(239,68,68,0.3)',
                  background: selectedRoute ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.04)',
                  color: selectedRoute ? '#F1F5F9' : '#64748B',
                  fontSize: 13, fontWeight: selectedRoute ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedRoute
                    ? `${selectedRoute.codigo ? selectedRoute.codigo + ' — ' : ''}${selectedRoute.nombre}`
                    : 'Selecciona la ruta de bus afectada'
                  }
                </span>
                <ChevronDown size={14} color="#64748B" style={{ flexShrink: 0, transform: showRouteDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Dropdown */}
              {showRouteDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, marginTop: 4, overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  maxHeight: 220,
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Buscar ruta..."
                    value={routeSearch}
                    onChange={(e) => setRouteSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none', boxSizing: 'border-box',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      background: 'transparent', color: '#E2E8F0', fontSize: 12,
                      outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                  />
                  {/* Route list */}
                  <div style={{ overflowY: 'auto', maxHeight: 180 }}>
                    {filteredRoutes.length === 0 ? (
                      <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: 12 }}>
                        No se encontraron rutas
                      </p>
                    ) : filteredRoutes.map(r => (
                      <button
                        key={r._id}
                        onClick={() => { setSelectedRoute(r); setShowRouteDropdown(false); setRouteSearch(''); }}
                        style={{
                          width: '100%', padding: '8px 14px', border: 'none', boxSizing: 'border-box',
                          background: selectedRoute?._id === r._id ? 'rgba(245,158,11,0.1)' : 'transparent',
                          color: '#E2E8F0', fontSize: 12, textAlign: 'left', cursor: 'pointer',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {r.codigo && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#F59E0B',
                            background: 'rgba(245,158,11,0.12)', padding: '2px 6px',
                            borderRadius: 4, flexShrink: 0,
                          }}>{r.codigo}</span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.nombre}
                        </span>
                        <span style={{ fontSize: 10, color: '#475569', flexShrink: 0, marginLeft: 'auto' }}>
                          {r.operador}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Type grid */}
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8, fontWeight: 600 }}>
              ¿Qué está pasando? <span style={{ color: '#EF4444' }}>*</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
              {REPORT_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  style={{
                    padding: '12px 10px', borderRadius: 12,
                    border: selectedType === t.id ? `2px solid ${t.color}` : '1px solid rgba(255,255,255,0.08)',
                    background: selectedType === t.id ? `${t.color}15` : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{t.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: selectedType === t.id ? t.color : '#94A3B8' }}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Description */}
            <textarea
              placeholder="Descripción breve (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#E2E8F0', fontSize: 13, resize: 'none',
                marginBottom: 16, outline: 'none', fontFamily: 'Inter, sans-serif',
              }}
            />

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                background: canSubmit
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'rgba(255,255,255,0.06)',
                color: canSubmit ? '#000' : '#475569',
                fontWeight: 700, fontSize: 14,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: sending ? 0.6 : 1, fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s',
              }}
            >
              <Send size={14} />
              {sending ? 'Enviando...' : 'Enviar reporte (+10 XP)'}
            </button>

            {!selectedRoute && (
              <p style={{ fontSize: 10, color: '#EF4444', textAlign: 'center', marginTop: 8 }}>
                ⚠️ Selecciona la ruta de bus afectada para continuar
              </p>
            )}

            <p style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 8 }}>
              <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Los reportes se muestran por 1 hora. La comunidad puede confirmarlos o descartarlos.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
