/**
 * ============================================
 * RutaQuilla - Composites Tab (Admin)
 * ============================================
 * Shows collaborative routes with map preview,
 * segment visualization, and promote-to-official flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  GitMerge, Users, CheckCircle2,
  ChevronDown, ChevronRight, Zap, Crown, Bus
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const SEG_COLORS = ['#06B6D4', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#F97316'];

const STATUS_CONFIG = {
  building: { label: 'En construcción', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  complete: { label: 'Completa', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
  promoted: { label: 'Promovida', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
};

/** Leaflet helper: invalidateSize + fitBounds */
function MapFitter({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize({ animate: false });
      if (coordinates?.length >= 2) {
        try {
          const bounds = L.latLngBounds(coordinates.map(c => [c[1], c[0]]));
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        } catch (e) { /* ignore */ }
      }
    }, 150);
    return () => clearTimeout(t);
  }, [map, coordinates]);
  return null;
}

export default function CompositesTab() {
  const { isDark } = useTheme();
  const [composites, setComposites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null); // full detail
  const [promoting, setPromoting] = useState(null);
  const [promoteForm, setPromoteForm] = useState({ origen: '', destino: '' });
  const [message, setMessage] = useState(null);

  const loadComposites = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus !== 'all') filters.status = filterStatus;
      const res = await adminAPI.getComposites(filters);
      setComposites(res.data || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { loadComposites(); }, [loadComposites]);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(t); } }, [message]);

  const handleSelect = async (comp) => {
    // Fetch full detail with populated segment captures (geometry)
    try {
      const res = await adminAPI.getCompositeById(comp._id);
      setSelected(res.data || comp);
    } catch (e) {
      setSelected(comp);
    }
  };

  const handlePromote = async (id) => {
    try {
      setPromoting(id);
      await adminAPI.promoteComposite(id, promoteForm);
      setMessage({ text: '✅ Ruta promovida a oficial exitosamente', type: 'success' });
      setPromoteForm({ origen: '', destino: '' });
      setSelected(null);
      loadComposites();
    } catch (err) {
      setMessage({ text: `❌ ${err.message || 'Error al promover'}`, type: 'error' });
    } finally { setPromoting(null); }
  };

  const mergedCoords = selected?.mergedGeometry?.coordinates || [];

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full mx-auto"
          style={{ animation: 'spin-slow 0.8s linear infinite' }} />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Cargando rutas colaborativas...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header + filters */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--subtle-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitMerge size={16} color="#F59E0B" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            Rutas Colaborativas
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({composites.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'building', 'complete', 'promoted'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '5px 10px', borderRadius: 8, border: 'none',
              background: filterStatus === s ? 'rgba(245,158,11,0.12)' : 'var(--subtle-bg)',
              color: filterStatus === s ? '#F59E0B' : 'var(--text-muted)',
              fontSize: 10, fontWeight: 600, cursor: 'pointer',
            }}>
              {s === 'all' ? 'Todas' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div style={{
          padding: '10px 14px', margin: '8px 16px 0', borderRadius: 10,
          background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
          color: message.type === 'error' ? '#F87171' : '#34D399', fontSize: 12, fontWeight: 600,
        }}>{message.text}</div>
      )}

      {/* List + Detail */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* List */}
        <div style={{ width: selected ? '35%' : '100%', overflowY: 'auto', padding: 12, transition: 'width 0.3s' }}>
          {composites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <GitMerge size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin rutas colaborativas aún</p>
            </div>
          ) : composites.map(comp => {
            const st = STATUS_CONFIG[comp.status] || STATUS_CONFIG.building;
            return (
              <button key={comp._id} onClick={() => handleSelect(comp)} style={{
                width: '100%', padding: '10px 12px', marginBottom: 6, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: selected?._id === comp._id ? 'rgba(245,158,11,0.08)' : 'var(--subtle-bg)',
                borderLeft: `3px solid ${st.color}`,
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bus size={12} color={st.color} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.routeName}</span>
                  <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 6, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-muted)' }}>
                  <span>{comp.company}</span>
                  <span style={{ color: comp.direction === 'ida' ? '#34D399' : '#A78BFA', fontWeight: 600 }}>
                    {comp.direction === 'ida' ? '→ IDA' : '← VUELTA'}
                  </span>
                  <span><Users size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {comp.contributorCount}</span>
                  <span>{comp.completionEstimate}%</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ flex: 1, borderLeft: '1px solid var(--subtle-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Map showing merged geometry + individual segments */}
            <div style={{ height: '50%', position: 'relative' }}>
              <MapContainer
                key={selected._id}
                center={[10.9685, -74.7813]}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  url={isDark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"}
                  maxZoom={19}
                  subdomains="abcd"
                />
                <MapFitter coordinates={mergedCoords} />

                {/* Merged geometry — thick background line */}
                {mergedCoords.length >= 2 && (
                  <Polyline
                    positions={mergedCoords.map(c => [c[1], c[0]])}
                    pathOptions={{ color: '#F59E0B', weight: 5, opacity: 0.4, dashArray: '8 6' }}
                  >
                    <Popup>Geometría fusionada ({mergedCoords.length} puntos)</Popup>
                  </Polyline>
                )}

                {/* Individual segment traces (from populated captureId.geometry) */}
                {(selected.segments || []).map((seg, i) => {
                  const coords = seg.captureId?.geometry?.coordinates;
                  if (!coords || coords.length < 2) return null;
                  const color = SEG_COLORS[i % SEG_COLORS.length];
                  return (
                    <Polyline key={seg._id || i}
                      positions={coords.map(c => [c[1], c[0]])}
                      pathOptions={{ color, weight: 3, opacity: 0.85 }}
                    >
                      <Popup>
                        <strong>{seg.userName}</strong><br/>
                        {seg.pointCount} pts · ±{seg.averageAccuracy?.toFixed(0)}m
                      </Popup>
                    </Polyline>
                  );
                })}

                {/* Start/end markers */}
                {mergedCoords.length >= 2 && (
                  <>
                    <CircleMarker center={[mergedCoords[0][1], mergedCoords[0][0]]} radius={7}
                      pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.9 }}>
                      <Popup>📍 Inicio</Popup>
                    </CircleMarker>
                    <CircleMarker center={[mergedCoords[mergedCoords.length-1][1], mergedCoords[mergedCoords.length-1][0]]} radius={7}
                      pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.9 }}>
                      <Popup>🏁 Fin</Popup>
                    </CircleMarker>
                  </>
                )}
              </MapContainer>

              {/* Segment color legend */}
              {(selected.segments || []).length > 0 && (
                <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1000, padding: '6px 10px', borderRadius: 10, background: 'rgba(7,11,22,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', margin: '0 0 3px' }}>Segmentos</p>
                  {(selected.segments || []).map((seg, i) => (
                    <div key={seg._id || i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <div style={{ width: 8, height: 3, borderRadius: 2, background: SEG_COLORS[i % SEG_COLORS.length] }} />
                      <span style={{ fontSize: 8, color: '#94A3B8' }}>{seg.userName} ({seg.pointCount} pts)</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 3 }}>
                    <div style={{ width: 8, height: 3, borderRadius: 2, background: '#F59E0B', opacity: 0.5 }} />
                    <span style={{ fontSize: 8, color: '#64748B' }}>Fusionada</span>
                  </div>
                </div>
              )}
            </div>

            {/* Info + promote panel */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{selected.routeName}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, fontSize: 10, color: 'var(--text-secondary)' }}>
                <span>🏢 {selected.company}</span>
                <span style={{ color: selected.direction === 'ida' ? '#34D399' : '#A78BFA', fontWeight: 600 }}>
                  {selected.direction === 'ida' ? '→ IDA' : '← VUELTA'}
                </span>
                <span><Users size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {selected.contributorCount} contribuidores</span>
                <span>{selected.totalLength ? `${(selected.totalLength / 1000).toFixed(1)} km` : '—'}</span>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Completitud estimada</span>
                  <span style={{ fontWeight: 700, color: selected.completionEstimate >= 90 ? '#10B981' : selected.completionEstimate >= 50 ? '#F59E0B' : '#06B6D4' }}>
                    {selected.completionEstimate}%
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--subtle-bg)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${selected.completionEstimate}%`, height: '100%', borderRadius: 3,
                    background: selected.completionEstimate >= 90 ? 'linear-gradient(90deg, #10B981, #34D399)' : selected.completionEstimate >= 50 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #06B6D4, #22D3EE)',
                    transition: 'width 0.8s ease',
                  }} />
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{selected.segments?.length || 0} segmentos · {mergedCoords.length} puntos fusionados</span>
              </div>

              {/* Promote section */}
              {selected.status !== 'promoted' ? (
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Crown size={12} /> Promover a ruta oficial
                  </p>
                  <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
                    Revisa el trazado en el mapa. Si la ruta está incompleta, puedes promoverla y luego completar el trazado manualmente desde el editor de rutas.
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input type="text" placeholder="Origen (ej: Centro)" value={promoteForm.origen}
                      onChange={e => setPromoteForm(f => ({ ...f, origen: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--subtle-border-strong)', background: 'var(--subtle-bg)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
                    />
                    <input type="text" placeholder="Destino (ej: Norte)" value={promoteForm.destino}
                      onChange={e => setPromoteForm(f => ({ ...f, destino: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--subtle-border-strong)', background: 'var(--subtle-bg)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
                    />
                  </div>
                  <button onClick={() => handlePromote(selected._id)} disabled={promoting === selected._id}
                    style={{
                      width: '100%', padding: '9px', borderRadius: 8, border: 'none',
                      background: promoting === selected._id ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                      color: promoting === selected._id ? 'var(--text-muted)' : '#fff',
                      fontSize: 11, fontWeight: 700, cursor: promoting === selected._id ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                    {promoting === selected._id ? 'Promoviendo...' : <><Zap size={12} /> Promover ({selected.contributorCount} contribuidores)</>}
                  </button>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#34D399', margin: 0 }}>Promovida a ruta oficial</p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: 0 }}>
                      {selected.promotedAt ? new Date(selected.promotedAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
