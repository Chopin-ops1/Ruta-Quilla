/**
 * ============================================
 * RutaQuilla - Admin Reports Tab
 * ============================================
 *
 * Panel de gestión de reportes para administradores:
 * - Lista con filtros (status, tipo)
 * - Estadísticas (activos, removidos, etc.)
 * - Eliminar reportes con razón
 * - Mobile-friendly con scroll
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, RefreshCw, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { reportAPI } from '../services/api';

const TYPE_META = {
  desvio:     { emoji: '🔀', label: 'Desvío',       color: '#F59E0B' },
  cancelada:  { emoji: '🚫', label: 'Cancelada',    color: '#EF4444' },
  trafico:    { emoji: '🚗', label: 'Tráfico',      color: '#F97316' },
  peligro:    { emoji: '⚠️', label: 'Peligro',      color: '#DC2626' },
  inundacion: { emoji: '🌊', label: 'Inundación',   color: '#3B82F6' },
  accidente:  { emoji: '💥', label: 'Accidente',    color: '#A855F7' },
  otro:       { emoji: '📌', label: 'Otro',         color: '#64748B' },
};

const STATUS_LABELS = {
  active:        { label: 'Activo',         color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  dismissed:     { label: 'Removido',       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  admin_removed: { label: 'Admin removió',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function ReportsTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({});
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // report._id
  const [deleteReason, setDeleteReason] = useState('');
  const [message, setMessage] = useState(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportAPI.adminGetAll({
        status: filterStatus, type: filterType, page,
      });
      setReports(res.data || []);
      setTotalPages(res.totalPages || 1);
      setStats(res.stats || {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterStatus, filterType]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleDelete = useCallback(async (id) => {
    try {
      await reportAPI.adminDelete(id, deleteReason || 'Removido por administrador');
      setMessage({ type: 'success', text: 'Reporte eliminado' });
      setDeleteConfirm(null);
      setDeleteReason('');
      loadReports();
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Error' });
    }
    setTimeout(() => setMessage(null), 3000);
  }, [deleteReason, loadReports]);

  const totalActive = stats.active || 0;
  const totalDismissed = (stats.dismissed || 0) + (stats.admin_removed || 0);

  const formatTime = (mins) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  };

  return (
    <div style={{ padding: 16, fontFamily: 'Inter, sans-serif' }}>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Activos', value: totalActive, color: '#10B981' },
          { label: 'Removidos', value: totalDismissed, color: '#F59E0B' },
          { label: 'Total', value: (stats.active || 0) + (stats.dismissed || 0) + (stats.admin_removed || 0), color: '#06B6D4' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '12px 14px', borderRadius: 12,
            background: `${s.color}08`, border: `1px solid ${s.color}20`,
          }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#64748B' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#E2E8F0', fontSize: 11,
            cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="dismissed">Removidos (comunidad)</option>
          <option value="admin_removed">Removidos (admin)</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#E2E8F0', fontSize: 11,
            cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">Todos los tipos</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
        <button onClick={() => loadReports()} style={{
          padding: '6px 10px', borderRadius: 8, border: 'none',
          background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <RefreshCw size={11} /> Refrescar
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '8px 14px', borderRadius: 10, marginBottom: 12,
          background: message.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
          color: message.type === 'error' ? '#EF4444' : '#10B981',
          fontSize: 12, fontWeight: 600,
        }}>{message.text}</div>
      )}

      {/* Reports list */}
      {loading ? (
        <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 30 }}>Cargando reportes...</p>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <AlertTriangle size={28} color="#334155" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>No hay reportes</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map(r => {
            const meta = TYPE_META[r.type] || TYPE_META.otro;
            const statusInfo = STATUS_LABELS[r.status] || STATUS_LABELS.active;

            return (
              <div key={r._id} style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{meta.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: statusInfo.bg, color: statusInfo.color,
                      }}>{statusInfo.label}</span>
                      {r.isExpired && (
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontWeight: 700 }}>
                          Expirado
                        </span>
                      )}
                    </div>

                    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#E2E8F0' }}>
                      🚌 <strong>{r.routeCodigo ? r.routeCodigo + ' — ' : ''}{r.routeName}</strong>
                    </p>

                    {r.description && (
                      <p style={{ margin: '0 0 4px', fontSize: 11, color: '#94A3B8' }}>{r.description}</p>
                    )}

                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#475569', flexWrap: 'wrap' }}>
                      <span>👤 {r.userName}</span>
                      <span>⏰ hace {formatTime(r.minutesAgo)}</span>
                      <span>✅ {r.confirmations} conf.</span>
                      <span>👎 {r.dismissals} dismiss</span>
                    </div>

                    {r.removeReason && (
                      <p style={{ margin: '4px 0 0', fontSize: 10, color: '#F59E0B' }}>
                        Razón: {r.removeReason}
                      </p>
                    )}
                  </div>

                  {/* Delete button */}
                  {r.status === 'active' && (
                    <button
                      onClick={() => { setDeleteConfirm(r._id); setDeleteReason(''); }}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0,
                        background: 'rgba(239,68,68,0.08)', color: '#EF4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      title="Eliminar reporte"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Delete confirmation inline */}
                {deleteConfirm === r._id && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#EF4444', fontWeight: 600 }}>
                      ¿Eliminar este reporte?
                    </p>
                    <input
                      type="text"
                      placeholder="Razón (opcional)"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      style={{
                        width: '100%', padding: '6px 10px', borderRadius: 6, boxSizing: 'border-box',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#E2E8F0', fontSize: 11, marginBottom: 6, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleDelete(r._id)}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                          background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >Eliminar</button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                          background: 'rgba(255,255,255,0.06)', color: '#94A3B8', fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '6px 10px', borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: page <= 1 ? '#334155' : '#94A3B8',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          ><ChevronLeft size={14} /></button>
          <span style={{ fontSize: 11, color: '#64748B' }}>
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '6px 10px', borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: page >= totalPages ? '#334155' : '#94A3B8',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          ><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
