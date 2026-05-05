import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bus, CheckCircle2, XCircle, GitCompare } from 'lucide-react';
import { adminAPI } from '../../services/api';

const COLORS = ['#F59E0B', '#06B6D4', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#F97316'];

/**
 * Sub-component: Fixes the Leaflet "gray tiles" bug when the map is inside a
 * dynamically-sized panel. Calls invalidateSize() on mount and whenever
 * the capture data changes. Also fits bounds to show the captured route.
 */
function MapResizer({ coordinates, boardingPoint }) {
  const map = useMap();

  useEffect(() => {
    // Fix gray tiles — tell Leaflet to recalculate its container size
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });

      // Fit bounds to show the captured route
      if (coordinates && coordinates.length >= 2) {
        try {
          const latLngs = coordinates.map(c => [c[1], c[0]]);
          const bounds = L.latLngBounds(latLngs);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
          }
        } catch (e) {
          console.warn('Error fitting bounds:', e);
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [map, coordinates, boardingPoint]);

  return null;
}

/**
 * Sub-component for comparison mode: fits bounds to all compared captures.
 */
function CompareResizer({ captures }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });

      if (captures && captures.length > 0) {
        try {
          const allLatLngs = captures.flatMap(cap =>
            (cap.geometry?.coordinates || []).map(c => [c[1], c[0]])
          );
          if (allLatLngs.length >= 2) {
            const bounds = L.latLngBounds(allLatLngs);
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
            }
          }
        } catch (e) {
          console.warn('Error fitting compare bounds:', e);
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [map, captures]);

  return null;
}

export default function CapturesTab() {
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [comparing, setComparing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCaptures(filter ? { status: filter } : {});
      setCaptures(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleReview = async (id, status) => {
    setSaving(true);
    try {
      await adminAPI.reviewCapture(id, { status, adminNotes: reviewNotes });
      setReviewNotes('');
      setSelected(null);
      load();
    } catch (e) { alert('Error: ' + (e.message || 'No se pudo guardar')); }
    finally { setSaving(false); }
  };

  const handleCompare = async (routeName) => {
    try {
      const res = await adminAPI.compareCaptures(routeName);
      setComparing({ routeName, captures: res.data || [] });
    } catch (e) { console.error(e); }
  };

  // When selecting a capture, if geometry is missing (list didn't include it), fetch full detail
  const handleSelect = async (capture) => {
    setComparing(null);
    if (capture.geometry?.coordinates?.length > 0) {
      setSelected(capture);
    } else {
      // Fetch full detail with geometry
      try {
        const res = await adminAPI.getCaptureById(capture._id);
        setSelected(res.data || capture);
      } catch (e) {
        console.error('Error fetching capture detail:', e);
        setSelected(capture);
      }
    }
  };

  // Determine coordinates for the map
  const selectedCoords = selected?.geometry?.coordinates || [];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filters */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--subtle-border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { v: 'pending', l: '⏳ Pendientes' },
          { v: 'approved', l: '✅ Aprobadas' },
          { v: 'rejected', l: '❌ Rechazadas' },
          { v: '', l: '📋 Todas' },
        ].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)} style={{
            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: filter === f.v ? 'rgba(245,158,11,0.12)' : 'var(--subtle-bg)',
            color: filter === f.v ? '#F59E0B' : 'var(--text-muted)',
            fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
          }}>{f.l}</button>
        ))}
      </div>

      {/* List + Detail split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Capture list */}
        <div style={{ width: selected || comparing ? '40%' : '100%', overflowY: 'auto', padding: 12, transition: 'width 0.3s' }}>
          {loading ? <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: 12 }}>Cargando...</p> :
           captures.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: 12 }}>No hay capturas</p> :
           captures.map(c => (
            <button key={c._id} onClick={() => handleSelect(c)} style={{
              width: '100%', padding: '10px 12px', marginBottom: 6, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: selected?._id === c._id ? 'rgba(245,158,11,0.08)' : 'var(--subtle-bg)',
              borderLeft: `3px solid ${c.status === 'pending' ? '#FBBF24' : c.status === 'approved' ? '#10B981' : '#EF4444'}`,
              textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bus size={12} color="#F59E0B" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.routeName}</span>
                <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 6, fontWeight: 700, textTransform: 'uppercase',
                  background: c.direction === 'ida' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                  color: c.direction === 'ida' ? '#34D399' : '#A78BFA',
                }}>{c.direction}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>👤 {c.userName}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>🏢 {c.company}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleDateString('es-CO')}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {(selected || comparing) && (
          <div style={{ flex: 1, borderLeft: '1px solid var(--subtle-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Map — key forces remount when switching captures for clean tile rendering */}
            <div style={{ height: '55%', position: 'relative' }}>
              <MapContainer
                key={selected?._id || comparing?.routeName || 'map'}
                center={[10.9685, -74.7813]}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  maxZoom={19}
                  subdomains="abcd"
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />

                {comparing ? (
                  <>
                    <CompareResizer captures={comparing.captures} />
                    {comparing.captures.map((cap, i) => (
                      cap.geometry?.coordinates?.length >= 2 && (
                        <Polyline key={cap._id}
                          positions={cap.geometry.coordinates.map(c => [c[1], c[0]])}
                          pathOptions={{ color: COLORS[i % COLORS.length], weight: 4, opacity: 0.8 }}
                        >
                          <Popup><strong>{cap.userName}</strong><br/>{cap.direction} · {new Date(cap.createdAt).toLocaleDateString('es-CO')}</Popup>
                        </Polyline>
                      )
                    ))}
                  </>
                ) : selectedCoords.length >= 2 ? (
                  <>
                    <MapResizer coordinates={selectedCoords} boardingPoint={selected?.boardingPoint} />
                    <Polyline
                      positions={selectedCoords.map(c => [c[1], c[0]])}
                      pathOptions={{ color: '#F59E0B', weight: 4, opacity: 0.9 }}
                    />
                    {/* Start point marker */}
                    {selectedCoords.length > 0 && (
                      <CircleMarker
                        center={[selectedCoords[0][1], selectedCoords[0][0]]}
                        radius={7}
                        pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.9, weight: 2 }}
                      >
                        <Popup>📍 Inicio de captura</Popup>
                      </CircleMarker>
                    )}
                    {/* End point marker */}
                    {selectedCoords.length > 1 && (
                      <CircleMarker
                        center={[selectedCoords[selectedCoords.length - 1][1], selectedCoords[selectedCoords.length - 1][0]]}
                        radius={7}
                        pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.9, weight: 2 }}
                      >
                        <Popup>🏁 Fin de captura</Popup>
                      </CircleMarker>
                    )}
                    {/* Boarding point if different from start */}
                    {selected?.boardingPoint?.coordinates && (
                      <CircleMarker
                        center={[selected.boardingPoint.coordinates[1], selected.boardingPoint.coordinates[0]]}
                        radius={6}
                        pathOptions={{ color: '#06B6D4', fillColor: '#06B6D4', fillOpacity: 0.8, weight: 2 }}
                      >
                        <Popup>🚏 Punto de abordaje</Popup>
                      </CircleMarker>
                    )}
                  </>
                ) : (
                  <MapResizer coordinates={null} boardingPoint={null} />
                )}
              </MapContainer>

              {/* No data overlay */}
              {selected && selectedCoords.length < 2 && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 1000,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.5)', pointerEvents: 'none',
                }}>
                  <p style={{ color: '#F87171', fontSize: 12, fontWeight: 600, background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: 10 }}>
                    ⚠️ Esta captura no tiene coordenadas válidas
                  </p>
                </div>
              )}

              {comparing && (
                <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1000, padding: '6px 12px', borderRadius: 10, background: 'rgba(7,11,22,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', margin: 0 }}>Comparando {comparing.captures.length} capturas de "{comparing.routeName}"</p>
                  {/* Color legend */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {comparing.captures.map((cap, i) => (
                      <div key={cap._id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                        <span style={{ fontSize: 8, color: '#94A3B8' }}>{cap.userName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info + actions */}
            {selected && !comparing && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>{selected.routeName}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, fontSize: 10, color: 'var(--text-secondary)' }}>
                  <span>🏢 {selected.company}</span>
                  <span>👤 {selected.userName}</span>
                  <span>📍 {selected.pointCount || selectedCoords.length} pts</span>
                  <span>🎯 ±{selected.averageAccuracy?.toFixed(0)}m</span>
                  {selected.durationSeconds > 0 && <span>⏱️ {Math.round(selected.durationSeconds / 60)} min</span>}
                  <span style={{
                    padding: '1px 6px', borderRadius: 6, fontWeight: 700, fontSize: 9, textTransform: 'uppercase',
                    background: selected.direction === 'ida' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                    color: selected.direction === 'ida' ? '#34D399' : '#A78BFA',
                  }}>{selected.direction}</span>
                </div>

                {/* Compare button */}
                <button onClick={() => handleCompare(selected.routeName)} style={{
                  width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.2)',
                  background: 'rgba(6,182,212,0.08)', color: '#06B6D4', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10,
                }}>
                  <GitCompare size={12} /> Comparar con otras capturas de esta ruta
                </button>

                {selected.status === 'pending' && (
                  <>
                    <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                      placeholder="Notas del admin (opcional)..."
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 11, resize: 'vertical', minHeight: 50,
                        background: 'var(--subtle-bg)', color: 'var(--text-primary)',
                        border: '1px solid var(--subtle-border-strong)', outline: 'none', marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleReview(selected._id, 'approved')} disabled={saving} style={{
                        flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        opacity: saving ? 0.5 : 1,
                      }}>
                        <CheckCircle2 size={14} /> Aprobar
                      </button>
                      <button onClick={() => handleReview(selected._id, 'rejected')} disabled={saving} style={{
                        flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        opacity: saving ? 0.5 : 1,
                      }}>
                        <XCircle size={14} /> Rechazar
                      </button>
                    </div>
                  </>
                )}
                {selected.status !== 'pending' && (
                  <div style={{ padding: '8px 12px', borderRadius: 10, background: selected.status === 'approved' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${selected.status === 'approved' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: selected.status === 'approved' ? '#10B981' : '#EF4444', margin: 0 }}>
                      {selected.status === 'approved' ? '✅ Aprobada' : '❌ Rechazada'}
                    </p>
                    {selected.adminNotes && <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{selected.adminNotes}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
