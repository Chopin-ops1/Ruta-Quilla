/**
 * ============================================
 * RutaQuilla - Admin Reports Tab v4
 * ============================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Ban,
  Car,
  ShieldAlert,
  CloudRain,
  AlertOctagon,
  Flag,
  Loader2,
} from 'lucide-react';
import { reportAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

const TYPE_META = {
  desvio:     { icon: GitBranch,    label: 'Desvío',      color: '#D99B00' },
  cancelada:  { icon: Ban,          label: 'Cancelada',   color: '#E5484D' },
  trafico:    { icon: Car,          label: 'Tráfico',     color: '#E0701D' },
  peligro:    { icon: ShieldAlert,  label: 'Peligro',     color: '#C83232' },
  inundacion: { icon: CloudRain,    label: 'Inundación',  color: '#3B8BF0' },
  accidente:  { icon: AlertOctagon, label: 'Accidente',   color: '#8F52D9' },
  otro:       { icon: Flag,         label: 'Otro',        color: '#6E7581' },
};

const STATUS_LABELS = {
  active:        { label: 'Activo',         color: 'var(--mangle)',   bg: 'var(--mangle-soft)' },
  dismissed:     { label: 'Comunidad',      color: 'var(--brand)',    bg: 'var(--brand-soft)' },
  admin_removed: { label: 'Admin removió',  color: 'var(--carnaval)', bg: 'var(--carnaval-soft)' },
};

export default function ReportsTab({ refreshTick = 0, onReportsMutated }) {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({});
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportAPI.adminGetAll({
        status: filterStatus,
        type: filterType,
        page,
      });
      setReports(res.data || []);
      setTotalPages(res.totalPages || 1);
      setStats(res.stats || {});
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports, refreshTick]);

  const handleDelete = useCallback(
    async (id) => {
      try {
        await reportAPI.adminDelete(id, deleteReason || 'Removido por administrador');
        toast.success('Reporte eliminado');
        setDeleteConfirm(null);
        setDeleteReason('');
        loadReports();
        onReportsMutated?.();
      } catch (e) {
        toast.error(e.message || 'No se pudo eliminar');
      }
    },
    [deleteReason, loadReports, onReportsMutated, toast]
  );

  const totalActive = stats.active || 0;
  const totalDismissed = (stats.dismissed || 0) + (stats.admin_removed || 0);
  const totalAll = totalActive + totalDismissed;

  const formatTime = (mins) => {
    if (!Number.isFinite(mins)) return '—';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  };

  return (
    <div className="animate-fade-in p-3 sm:p-4 space-y-3.5 max-w-[1000px] mx-auto">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Activos', value: totalActive, color: 'var(--mangle)' },
          { label: 'Removidos', value: totalDismissed, color: 'var(--brand)' },
          { label: 'Total', value: totalAll, color: 'var(--caribe)' },
        ].map((s) => (
          <div
            key={s.label}
            className="rq-card p-3"
            style={{ borderLeft: `3px solid ${s.color}` }}
          >
            <div className="rq-section-label">{s.label}</div>
            <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums m-0 mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="rq-input px-2.5 py-1.5 text-xs flex-1 sm:flex-none"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="dismissed">Removidos (comunidad)</option>
          <option value="admin_removed">Removidos (admin)</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="rq-input px-2.5 py-1.5 text-xs flex-1 sm:flex-none"
        >
          <option value="all">Todos los tipos</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={loadReports}
          className="rq-chip"
          style={{ padding: '6px 10px', fontSize: 11.5 }}
        >
          <RefreshCw size={12} />
          <span>Refrescar</span>
        </button>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={14} className="animate-spin" color="var(--brand)" />
          <span>Cargando reportes...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="rq-card text-center py-10 px-4">
          <AlertTriangle size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', opacity: 0.45 }} />
          <p className="text-xs m-0" style={{ color: 'var(--text-muted)' }}>
            No hay reportes con estos filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const meta = TYPE_META[r.type] || TYPE_META.otro;
            const TypeIcon = meta.icon;
            const statusInfo = STATUS_LABELS[r.status] || STATUS_LABELS.active;

            return (
              <div
                key={r._id}
                className="rq-card p-3"
                style={{ borderLeft: `3px solid ${meta.color}` }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: `color-mix(in srgb, ${meta.color} 15%, transparent)`,
                      color: meta.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TypeIcon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="font-display text-[13px] font-bold" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      <span
                        className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase"
                        style={{ background: statusInfo.bg, color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                      {r.isExpired && (
                        <span
                          className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase"
                          style={{ background: 'var(--carnaval-soft)', color: 'var(--carnaval)' }}
                        >
                          Expirado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {r.routeCodigo && <span className="transit-code">{r.routeCodigo}</span>}
                      <span>{r.routeName}</span>
                    </div>

                    {r.description && (
                      <p className="text-[11.5px] m-0 mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {r.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[10.5px] font-mono mt-1.5 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                      <span>{r.userName}</span>
                      <span>· hace {formatTime(r.minutesAgo)}</span>
                      <span>· {r.confirmations || 0} conf.</span>
                      <span>· {r.dismissals || 0} desc.</span>
                    </div>

                    {r.removeReason && (
                      <p className="text-[11px] m-0 mt-1 font-medium" style={{ color: 'var(--brand)' }}>
                        Motivo: {r.removeReason}
                      </p>
                    )}
                  </div>

                  {r.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm(deleteConfirm === r._id ? null : r._id);
                        setDeleteReason('');
                      }}
                      className="rq-icon-btn flex-shrink-0"
                      style={{ width: 30, height: 30, color: 'var(--carnaval)' }}
                      title="Eliminar reporte"
                      aria-label="Eliminar reporte"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {deleteConfirm === r._id && (
                  <div
                    className="mt-2.5 p-2.5 rounded-lg space-y-2"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                  >
                    <input
                      type="text"
                      placeholder="Motivo de eliminación (opcional)"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      className="rq-input w-full px-2.5 py-1.5 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(r._id)}
                        className="flex-1 py-1.5 rounded-md font-bold text-xs cursor-pointer"
                        style={{ background: 'var(--carnaval)', color: '#FFFFFF', border: 'none' }}
                      >
                        Confirmar eliminación
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="rq-chip flex-1 justify-center"
                        style={{ padding: '6px 0' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rq-icon-btn"
            style={{ width: 30, height: 30, opacity: page <= 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            Página {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rq-icon-btn"
            style={{ width: 30, height: 30, opacity: page >= totalPages ? 0.4 : 1 }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
