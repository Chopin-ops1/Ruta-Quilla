/**
 * ============================================
 * RutaQuilla - Composites Tab (Admin)
 * ============================================
 *
 * Panel de administración para rutas colaborativas.
 * Muestra rutas en construcción, sus segmentos por contribuidor,
 * y permite promover rutas completas a oficiales.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  GitMerge, Users, TrendingUp, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, MapPin, Zap, Crown, Bus
} from 'lucide-react';
import { adminAPI } from '../../services/api';

const STATUS_CONFIG = {
  building: { label: 'En construcción', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  complete: { label: 'Completa', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
  promoted: { label: 'Promovida', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
};

export default function CompositesTab() {
  const [composites, setComposites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
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
      setError(err.message || 'Error al cargar rutas colaborativas');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadComposites(); }, [loadComposites]);

  const handlePromote = async (id) => {
    try {
      setPromoting(id);
      await adminAPI.promoteComposite(id, promoteForm);
      setMessage({ text: '✅ Ruta promovida a oficial exitosamente', type: 'success' });
      setPromoteForm({ origen: '', destino: '' });
      loadComposites();
    } catch (err) {
      setMessage({ text: `❌ ${err.message || 'Error al promover'}`, type: 'error' });
    } finally {
      setPromoting(null);
    }
  };

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full mx-auto"
          style={{ animation: 'spin-slow 0.8s linear infinite' }} />
        <p style={{ fontSize: 12, color: '#64748B', marginTop: 10 }}>Cargando rutas colaborativas...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(139,92,246,0.12))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitMerge size={18} color="#F59E0B" />
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
              Rutas Colaborativas
            </h2>
            <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>
              {composites.length} ruta{composites.length !== 1 ? 's' : ''} en crowdsourcing
            </p>
          </div>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'building', 'complete', 'promoted'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '5px 10px', borderRadius: 8, border: 'none',
                background: filterStatus === s ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                color: filterStatus === s ? '#F59E0B' : '#64748B',
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {s === 'all' ? 'Todas' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Toast message */}
      {message && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 12,
          background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
          color: message.type === 'error' ? '#F87171' : '#34D399',
          fontSize: 12, fontWeight: 600,
        }}>
          {message.text}
        </div>
      )}

      {/* Empty state */}
      {composites.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <GitMerge size={40} style={{ color: '#1E293B', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>Sin rutas colaborativas</p>
          <p style={{ fontSize: 11, color: '#475569' }}>
            Cuando los usuarios capturen segmentos de rutas, aparecerán aquí para revisión.
          </p>
        </div>
      )}

      {/* Composite list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {composites.map(comp => {
          const status = STATUS_CONFIG[comp.status] || STATUS_CONFIG.building;
          const isExpanded = expandedId === comp._id;

          return (
            <div key={comp._id} style={{
              borderRadius: 14, overflow: 'hidden',
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${isExpanded ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
              transition: 'border-color 0.2s',
            }}>
              {/* Composite header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : comp._id)}
                style={{
                  width: '100%', padding: '12px 14px', border: 'none',
                  background: 'none', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${status.bg}`, border: `1px solid ${status.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bus size={14} color={status.color} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {comp.routeName}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 10, color: '#64748B' }}>
                    <span>{comp.company}</span>
                    <span style={{
                      fontWeight: 600,
                      color: comp.direction === 'ida' ? '#34D399' : '#A78BFA',
                    }}>
                      {comp.direction === 'ida' ? '→ IDA' : '← VUELTA'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Users size={9} /> {comp.contributorCount}
                    </span>
                  </div>
                </div>

                {/* Progress + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Mini progress */}
                  <div style={{ width: 50, textAlign: 'right' }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: comp.completionEstimate >= 90 ? '#10B981'
                           : comp.completionEstimate >= 50 ? '#F59E0B' : '#06B6D4',
                    }}>
                      {comp.completionEstimate}%
                    </span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    background: status.bg, color: status.color, border: `1px solid ${status.border}`,
                  }}>
                    {status.label}
                  </span>
                  {isExpanded
                    ? <ChevronDown size={12} style={{ color: '#64748B' }} />
                    : <ChevronRight size={12} style={{ color: '#64748B' }} />
                  }
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '0 14px 14px' }}>
                  {/* Progress bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{
                      width: '100%', height: 6, borderRadius: 3,
                      background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${comp.completionEstimate}%`,
                        height: '100%', borderRadius: 3,
                        background: comp.completionEstimate >= 90
                          ? 'linear-gradient(90deg, #10B981, #34D399)'
                          : comp.completionEstimate >= 50
                          ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                          : 'linear-gradient(90deg, #06B6D4, #22D3EE)',
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: '#475569' }}>
                      <span>{comp.segments?.length || 0} segmentos</span>
                      <span>{comp.totalLength ? `${(comp.totalLength / 1000).toFixed(1)} km` : '—'}</span>
                    </div>
                  </div>

                  {/* Segment list */}
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: '0 0 6px', letterSpacing: '0.05em' }}>
                    Segmentos contribuidos
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    {(comp.segments || []).map((seg, idx) => {
                      const colors = ['#06B6D4', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#F97316'];
                      const segColor = colors[idx % colors.length];

                      return (
                        <div key={seg._id || idx} style={{
                          padding: '8px 10px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${segColor}20`,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: segColor, boxShadow: `0 0 6px ${segColor}60`,
                          }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#F1F5F9', margin: 0 }}>
                              {seg.userName || 'Usuario'}
                            </p>
                            <p style={{ fontSize: 9, color: '#64748B', margin: 0 }}>
                              {seg.pointCount} pts · ±{seg.averageAccuracy?.toFixed(0) || '?'}m · {new Date(seg.addedAt).toLocaleDateString('es-CO')}
                            </p>
                          </div>
                          <div style={{
                            padding: '2px 6px', borderRadius: 4,
                            background: `${segColor}15`, color: segColor,
                            fontSize: 9, fontWeight: 700,
                          }}>
                            #{idx + 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Promote action (only if not already promoted) */}
                  {comp.status !== 'promoted' && (
                    <div style={{
                      padding: 12, borderRadius: 10,
                      background: 'rgba(139,92,246,0.06)',
                      border: '1px solid rgba(139,92,246,0.15)',
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Crown size={12} /> Promover a ruta oficial
                      </p>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input
                          type="text"
                          placeholder="Origen (ej: Centro)"
                          value={promoteForm.origen}
                          onChange={e => setPromoteForm(f => ({ ...f, origen: e.target.value }))}
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.04)', color: '#F1F5F9',
                            fontSize: 11, outline: 'none',
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Destino (ej: Norte)"
                          value={promoteForm.destino}
                          onChange={e => setPromoteForm(f => ({ ...f, destino: e.target.value }))}
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.04)', color: '#F1F5F9',
                            fontSize: 11, outline: 'none',
                          }}
                        />
                      </div>
                      <button
                        onClick={() => handlePromote(comp._id)}
                        disabled={promoting === comp._id}
                        style={{
                          width: '100%', padding: '9px', borderRadius: 8, border: 'none',
                          background: promoting === comp._id
                            ? 'rgba(255,255,255,0.05)'
                            : 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                          color: promoting === comp._id ? '#64748B' : '#fff',
                          fontSize: 11, fontWeight: 700, cursor: promoting === comp._id ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          transition: 'all 0.2s',
                        }}
                      >
                        {promoting === comp._id ? (
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full"
                            style={{ animation: 'spin-slow 0.6s linear infinite' }} />
                        ) : <Zap size={12} />}
                        {promoting === comp._id ? 'Promoviendo...' : `Promover (${comp.contributorCount} contribuidores)`}
                      </button>
                    </div>
                  )}

                  {/* Promoted info */}
                  {comp.status === 'promoted' && (
                    <div style={{
                      padding: '10px 12px', borderRadius: 10,
                      background: 'rgba(16,185,129,0.06)',
                      border: '1px solid rgba(16,185,129,0.15)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <CheckCircle2 size={16} color="#10B981" />
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#34D399', margin: 0 }}>
                          Promovida a ruta oficial
                        </p>
                        <p style={{ fontSize: 9, color: '#64748B', margin: 0 }}>
                          {comp.promotedAt ? new Date(comp.promotedAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
