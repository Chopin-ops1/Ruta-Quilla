import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import { Bus, CheckCircle2, XCircle, Eye, GitCompare, ChevronDown, Search } from 'lucide-react';
import { adminAPI } from '../../services/api';

const COLORS = ['#F59E0B', '#06B6D4', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#F97316'];

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

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filters */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { v: 'pending', l: '⏳ Pendientes' },
          { v: 'approved', l: '✅ Aprobadas' },
          { v: 'rejected', l: '❌ Rechazadas' },
          { v: '', l: '📋 Todas' },
        ].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)} style={{
            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: filter === f.v ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
            color: filter === f.v ? '#F59E0B' : '#64748B',
            fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
          }}>{f.l}</button>
        ))}
      </div>

      {/* List + Detail split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Capture list */}
        <div style={{ width: selected || comparing ? '40%' : '100%', overflowY: 'auto', padding: 12, transition: 'width 0.3s' }}>
          {loading ? <p style={{ color: '#475569', fontSize: 12, padding: 12 }}>Cargando...</p> :
           captures.length === 0 ? <p style={{ color: '#475569', fontSize: 12, padding: 12 }}>No hay capturas</p> :
           captures.map(c => (
            <button key={c._id} onClick={() => { setSelected(c); setComparing(null); }} style={{
              width: '100%', padding: '10px 12px', marginBottom: 6, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: selected?._id === c._id ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
              borderLeft: `3px solid ${c.status === 'pending' ? '#FBBF24' : c.status === 'approved' ? '#10B981' : '#EF4444'}`,
              textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bus size={12} color="#F59E0B" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.routeName}</span>
                <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 6, fontWeight: 700, textTransform: 'uppercase',
                  background: c.direction === 'ida' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                  color: c.direction === 'ida' ? '#34D399' : '#A78BFA',
                }}>{c.direction}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 9, color: '#475569' }}>👤 {c.userName}</span>
                <span style={{ fontSize: 9, color: '#475569' }}>🏢 {c.company}</span>
                <span style={{ fontSize: 9, color: '#334155' }}>{new Date(c.createdAt).toLocaleDateString('es-CO')}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {(selected || comparing) && (
          <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Map */}
            <div style={{ height: '55%', position: 'relative' }}>
              <MapContainer center={[10.9685, -74.7813]} zoom={13} style={{ width: '100%', height: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maxZoom={19} subdomains="abcd" />
                {comparing ? (
                  comparing.captures.map((cap, i) => (
                    <Polyline key={cap._id}
                      positions={cap.geometry.coordinates.map(c => [c[1], c[0]])}
                      pathOptions={{ color: COLORS[i % COLORS.length], weight: 4, opacity: 0.8 }}
                    >
                      <Popup><strong>{cap.userName}</strong><br/>{cap.direction} · {new Date(cap.createdAt).toLocaleDateString('es-CO')}</Popup>
                    </Polyline>
                  ))
                ) : selected?.geometry?.coordinates ? (
                  <>
                    <Polyline
                      positions={selected.geometry.coordinates.map(c => [c[1], c[0]])}
                      pathOptions={{ color: '#F59E0B', weight: 4, opacity: 0.9 }}
                    />
                    {selected.boardingPoint?.coordinates && (
                      <CircleMarker center={[selected.boardingPoint.coordinates[1], selected.boardingPoint.coordinates[0]]}
                        radius={8} pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.8 }}>
                        <Popup>📍 Punto de abordaje</Popup>
                      </CircleMarker>
                    )}
                  </>
                ) : null}
              </MapContainer>
              {comparing && (
                <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1000, padding: '6px 12px', borderRadius: 10, background: 'rgba(7,11,22,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', margin: 0 }}>Comparando {comparing.captures.length} capturas de "{comparing.routeName}"</p>
                </div>
              )}
            </div>

            {/* Info + actions */}
            {selected && !comparing && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px' }}>{selected.routeName}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, fontSize: 10, color: '#94A3B8' }}>
                  <span>🏢 {selected.company}</span>
                  <span>👤 {selected.userName}</span>
                  <span>📍 {selected.pointCount} pts</span>
                  <span>🎯 ±{selected.averageAccuracy?.toFixed(0)}m</span>
                  {selected.durationSeconds > 0 && <span>⏱️ {Math.round(selected.durationSeconds / 60)} min</span>}
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
                        background: 'rgba(255,255,255,0.04)', color: '#F1F5F9',
                        border: '1px solid rgba(255,255,255,0.08)', outline: 'none', marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleReview(selected._id, 'approved')} disabled={saving} style={{
                        flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        <CheckCircle2 size={14} /> Aprobar
                      </button>
                      <button onClick={() => handleReview(selected._id, 'rejected')} disabled={saving} style={{
                        flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
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
                    {selected.adminNotes && <p style={{ fontSize: 10, color: '#94A3B8', margin: '4px 0 0' }}>{selected.adminNotes}</p>}
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
