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

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  X,
  Send,
  MapPin,
  Clock,
  ChevronDown,
  Bus,
  GitBranch,
  Ban,
  Car,
  ShieldAlert,
  CloudRain,
  AlertOctagon,
  Flag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reportAPI, routesAPI } from '../services/api';

const REPORT_TYPES = [
  { id: 'desvio',     icon: GitBranch,    label: 'Desvío de ruta',  color: '#D99B00' },
  { id: 'cancelada',  icon: Ban,          label: 'Ruta cancelada',  color: '#E5484D' },
  { id: 'trafico',    icon: Car,          label: 'Tráfico pesado',  color: '#E0701D' },
  { id: 'peligro',    icon: ShieldAlert,  label: 'Zona peligrosa',  color: '#C83232' },
  { id: 'inundacion', icon: CloudRain,    label: 'Calle inundada',  color: '#3B8BF0' },
  { id: 'accidente',  icon: AlertOctagon, label: 'Accidente',       color: '#8F52D9' },
  { id: 'otro',       icon: Flag,         label: 'Otro',            color: '#6E7581' },
];

export default function IncidentReporter({
  routes: propRoutes,
  userPosition,
  onReportCreated,
  bottomOffset = 28,
  compact = false,
  reportTrigger = null,
  onClearReportTrigger,
}) {
  const { isAuthenticated } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null); // { _id, nombre, codigo }
  const [fallbackLocation, setFallbackLocation] = useState(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [fetchedRoutes, setFetchedRoutes] = useState([]);
  const [routeSearch, setRouteSearch] = useState('');
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);

  // Fallback fetch only if parent did not pass routes prop
  useEffect(() => {
    if (propRoutes !== undefined) return;
    routesAPI.getAll().then(res => {
      setFetchedRoutes(res.data || []);
    }).catch(() => {});
  }, [propRoutes]);

  const routes = useMemo(() => {
    const source = propRoutes !== undefined ? propRoutes : fetchedRoutes;
    const list = (source || []).map(r => ({
      _id: r._id, nombre: r.nombre, codigo: r.codigo || '', operador: r.operador || '',
    }));
    list.sort((a, b) => (a.codigo || a.nombre).localeCompare(b.codigo || b.nombre));
    return list;
  }, [propRoutes, fetchedRoutes]);

  const filteredRoutes = routes.filter(r => {
    if (!routeSearch) return true;
    const q = routeSearch.toLowerCase();
    return r.nombre.toLowerCase().includes(q)
      || r.codigo.toLowerCase().includes(q)
      || r.operador.toLowerCase().includes(q);
  });

  // Contextual trigger from SelectedRouteFicha ("Reportar cambio o desvío")
  useEffect(() => {
    if (!reportTrigger?.route || !isAuthenticated) return;
    const r = reportTrigger.route;
    setSelectedRoute({
      _id: r._id,
      nombre: r.nombre || r.name || 'Ruta',
      codigo: r.codigo || '',
      operador: r.operador || '',
    });
    setSelectedType(reportTrigger.defaultType || 'desvio');
    setDescription('');
    setRouteSearch('');
    setShowRouteDropdown(false);
    const coords = r.ida?.trazado?.coordinates;
    if (Array.isArray(coords) && coords.length > 0) {
      const mid = coords[Math.floor(coords.length / 2)];
      if (Array.isArray(mid) && Number.isFinite(mid[1]) && Number.isFinite(mid[0])) {
        setFallbackLocation({ lat: mid[1], lng: mid[0] });
      } else {
        setFallbackLocation({ lat: 10.9685, lng: -74.7813 });
      }
    } else {
      setFallbackLocation({ lat: 10.9685, lng: -74.7813 });
    }
    setShowModal(true);
  }, [reportTrigger, isAuthenticated]);

  const effectiveLocation = userPosition || fallbackLocation;
  const usingFallbackLocation = !userPosition && Boolean(fallbackLocation);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFallbackLocation(null);
    onClearReportTrigger?.();
  }, [onClearReportTrigger]);

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
    setFallbackLocation(null);
    setShowModal(true);
    setSelectedType(null);
    setDescription('');
    setSelectedRoute(null);
    setRouteSearch('');
    setShowRouteDropdown(false);
  }, [isAuthenticated, userPosition]);

  const handleSubmit = useCallback(async () => {
    if (!selectedType || !effectiveLocation || !selectedRoute) return;
    setSending(true);
    try {
      const res = await reportAPI.create({
        type: selectedType,
        description,
        routeId: selectedRoute._id,
        routeName: selectedRoute.nombre,
        routeCodigo: selectedRoute.codigo,
        location: { lat: effectiveLocation.lat, lng: effectiveLocation.lng },
      });
      setFeedback({ type: 'success', msg: res.message || '¡Reporte enviado!' });
      handleCloseModal();
      onReportCreated?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Error al enviar' });
    } finally {
      setSending(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  }, [selectedType, description, selectedRoute, effectiveLocation, onReportCreated, handleCloseModal]);

  const canSubmit = selectedType && selectedRoute && !sending;

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          position: 'fixed', bottom: bottomOffset, right: compact ? 10 : 16, zIndex: 1100,
          width: compact ? 40 : 44, height: compact ? 40 : 44, borderRadius: compact ? 10 : 12,
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'bottom 0.25s ease, transform 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
        title="Reportar incidencia"
        aria-label="Reportar incidencia"
      >
        <AlertTriangle size={compact ? 18 : 20} strokeWidth={2.25} />
      </button>

      {/* Feedback toast */}
      {feedback && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed', bottom: bottomOffset + (compact ? 48 : 56), right: compact ? 10 : 16, zIndex: 1200,
            padding: '10px 14px', borderRadius: 10, maxWidth: 260,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderLeft: `3px solid ${feedback.type === 'success' ? 'var(--mangle)' : 'var(--carnaval)'}`,
            color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {feedback.msg}
        </div>
      )}

      {/* Modal / Bottom Sheet */}
      {showModal && (
        <div
          onClick={handleCloseModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 1300,
            background: 'rgba(13, 16, 20, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rq-sheet animate-slide-up"
            style={{
              width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto',
              borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
              borderBottom: 'none',
              padding: '10px 20px 24px',
            }}
          >
            <div className="sheet-handle" />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(255, 194, 26, 0.14)',
                  border: '1px solid rgba(255, 194, 26, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--brand)',
                }}>
                  <AlertTriangle size={15} />
                </div>
                <h2 className="font-display" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Reportar incidencia
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rq-icon-btn"
                style={{ width: 30, height: 30 }}
                aria-label="Cerrar"
              >
                <X size={14} />
              </button>
            </div>

            {/* GPS indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
              background: usingFallbackLocation ? 'var(--brand-soft)' : 'rgba(31, 157, 107, 0.1)',
              border: `1px solid ${usingFallbackLocation ? 'color-mix(in srgb, var(--brand) 32%, transparent)' : 'rgba(31, 157, 107, 0.25)'}`,
              marginBottom: 14, fontSize: 11.5, fontWeight: 500,
              color: usingFallbackLocation ? 'var(--brand)' : 'var(--mangle)',
            }}>
              <MapPin size={13} style={{ flexShrink: 0 }} />
              <span>
                {usingFallbackLocation
                  ? 'Sin GPS activo: se usará el punto medio de esta ruta'
                  : 'Tu ubicación actual será usada para el reporte'}
              </span>
            </div>

            {/* ---- ROUTE SELECTOR (OBLIGATORIO) ---- */}
            <p className="rq-section-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Bus size={12} style={{ color: 'var(--brand)' }} />
              <span>Ruta afectada</span>
              <span style={{ color: 'var(--carnaval)' }}>*</span>
            </p>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setShowRouteDropdown(!showRouteDropdown)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
                  border: selectedRoute ? '1.5px solid var(--brand)' : '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: selectedRoute ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: selectedRoute ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedRoute
                    ? `${selectedRoute.codigo ? selectedRoute.codigo + ' — ' : ''}${selectedRoute.nombre}`
                    : 'Selecciona la ruta de bus afectada'
                  }
                </span>
                <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0, transform: showRouteDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Dropdown */}
              {showRouteDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  borderRadius: 12, marginTop: 4, overflow: 'hidden',
                  boxShadow: 'var(--shadow-lg)',
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
                      width: '100%', padding: '10px 12px', border: 'none', boxSizing: 'border-box',
                      borderBottom: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  {/* Route list */}
                  <div style={{ overflowY: 'auto', maxHeight: 180 }}>
                    {filteredRoutes.length === 0 ? (
                      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: 12, margin: 0 }}>
                        No se encontraron rutas
                      </p>
                    ) : filteredRoutes.map(r => (
                      <button
                        type="button"
                        key={r._id}
                        onClick={() => { setSelectedRoute(r); setShowRouteDropdown(false); setRouteSearch(''); }}
                        style={{
                          width: '100%', padding: '8px 12px', border: 'none', boxSizing: 'border-box',
                          background: selectedRoute?._id === r._id ? 'var(--bg-surface)' : 'transparent',
                          color: 'var(--text-primary)', fontSize: 12, textAlign: 'left', cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        {r.codigo && (
                          <span className="transit-code" style={{ '--route-color': 'var(--brand)' }}>{r.codigo}</span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.nombre}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }}>
                          {r.operador}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Type grid */}
            <p className="rq-section-label" style={{ marginBottom: 8 }}>
              ¿Qué está pasando? <span style={{ color: 'var(--carnaval)' }}>*</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              {REPORT_TYPES.map(t => {
                const TypeIcon = t.icon;
                const active = selectedType === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setSelectedType(t.id)}
                    style={{
                      padding: '10px 10px', borderRadius: 10,
                      border: active ? `1.5px solid ${t.color}` : '1px solid var(--border-color)',
                      background: active ? `${t.color}16` : 'var(--bg-surface)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      textAlign: 'left',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <TypeIcon size={16} color={active ? t.color : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Description */}
            <textarea
              placeholder="Descripción breve (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              className="rq-input"
              style={{
                width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                fontSize: 12.5, resize: 'none', marginBottom: 14,
              }}
            />

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rq-btn-primary"
              style={{
                width: '100%', padding: '12px 0',
                fontSize: 13.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: canSubmit ? 1 : 0.45,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={14} />
              {sending ? 'Enviando...' : 'Enviar reporte (+10 XP)'}
            </button>

            {!selectedRoute && (
              <p style={{ fontSize: 11, color: 'var(--carnaval)', textAlign: 'center', margin: '8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <AlertTriangle size={11} />
                Selecciona la ruta de bus afectada para continuar
              </p>
            )}

            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0 0', lineHeight: 1.4 }}>
              <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Los reportes se muestran por 1 hora. La comunidad puede confirmarlos o descartarlos.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
