import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitMerge,
  Users,
  CheckCircle2,
  Zap,
  Crown,
  Bus,
  ArrowLeft,
  Trash2,
  Loader2,
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import AdminVectorMap from './AdminVectorMap';

const SEG_COLORS = ['#3B8BF0', '#FFC21A', '#1F9D6B', '#8B7CF6', '#EC4899', '#F97316'];

const STATUS_CONFIG = {
  building: { label: 'En curso', color: 'var(--brand)', bg: 'var(--brand-soft)' },
  complete: { label: 'Completa', color: 'var(--mangle)', bg: 'var(--mangle-soft)' },
  promoted: { label: 'Promovida', color: 'var(--caribe)', bg: 'var(--caribe-soft)' },
};

export default function CompositesTab({ refreshTick = 0, onCompositesMutated }) {
  const toast = useToast();
  const [composites, setComposites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [promoting, setPromoting] = useState(null);
  const [promoteForm, setPromoteForm] = useState({ codigo: '', origen: '', destino: '', fare: 3700 });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);

  const loadComposites = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus !== 'all') filters.status = filterStatus;
      const res = await adminAPI.getComposites(filters);
      setComposites(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar rutas colaborativas');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, toast]);

  useEffect(() => {
    loadComposites();
  }, [loadComposites, refreshTick]);

  const handleSelect = async (comp) => {
    setDeleteConfirm(false);
    try {
      const res = await adminAPI.getCompositeById(comp._id);
      setSelected(res.data || comp);
      setFitTrigger((n) => n + 1);
    } catch {
      setSelected(comp);
      setFitTrigger((n) => n + 1);
    }
  };

  const handlePromote = async (id) => {
    try {
      setPromoting(id);
      await adminAPI.promoteComposite(id, promoteForm);
      toast.success('Ruta colaborativa promovida a oficial');
      setPromoteForm({ codigo: '', origen: '', destino: '', fare: 3700 });
      setSelected(null);
      loadComposites();
      onCompositesMutated?.();
    } catch (err) {
      toast.error(err.message || 'Error al promover');
    } finally {
      setPromoting(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteComposite(id);
      setSelected(null);
      setDeleteConfirm(false);
      toast.success('Ruta colaborativa eliminada');
      loadComposites();
      onCompositesMutated?.();
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar');
    }
  };

  const mergedCoords = selected?.mergedGeometry?.coordinates || [];

  const mapPolylines = useMemo(() => {
    const lines = [];
    if (mergedCoords.length >= 2) {
      lines.push({
        id: 'merged',
        coordinates: mergedCoords,
        color: '#FFC21A',
        width: 5,
        opacity: 0.55,
        dashed: true,
        showArrows: false,
        label: `${selected?.routeName || 'Fusionada'} (trazo combinado)`,
      });
    }
    (selected?.segments || []).forEach((seg, i) => {
      const coords = seg.captureId?.geometry?.coordinates;
      if (coords && coords.length >= 2) {
        lines.push({
          id: seg._id || `seg-${i}`,
          coordinates: coords,
          color: SEG_COLORS[i % SEG_COLORS.length],
          width: 3.5,
          opacity: 0.92,
          showArrows: true,
          label: `${seg.userName || 'Contribuidor'} · ${seg.pointCount || coords.length} pts`,
        });
      }
    });
    return lines;
  }, [selected, mergedCoords]);

  const mapEndpoints = useMemo(() => {
    if (mergedCoords.length < 2) return [];
    const first = mergedCoords[0];
    const last = mergedCoords[mergedCoords.length - 1];
    return [
      { lng: first[0], lat: first[1], color: '#1F9D6B', label: 'Inicio' },
      { lng: last[0], lat: last[1], color: '#E5484D', label: 'Fin' },
    ];
  }, [mergedCoords]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header + filters */}
      <div
        className="p-3 flex items-center justify-between gap-2 flex-wrap flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center gap-2">
          <GitMerge size={15} color="var(--brand)" />
          <span className="font-display text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Rutas Colaborativas ({composites.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'building', 'complete', 'promoted'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setFilterStatus(s);
                setSelected(null);
              }}
              className={`rq-chip${filterStatus === s ? ' active' : ''}`}
              style={{ padding: '4px 9px', fontSize: 11 }}
            >
              {s === 'all' ? 'Todas' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Split responsivo */}
      <div className="admin-split-layout flex-1 min-h-0">
        <div className={`admin-list-pane${selected ? ' hidden md:block' : ''}`} style={{ width: selected ? undefined : '100%' }}>
          <div className="p-2.5 space-y-1.5">
            {loading ? (
              <div className="py-10 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" color="var(--brand)" />
                <span>Cargando colaborativas...</span>
              </div>
            ) : composites.length === 0 ? (
              <div className="text-center py-10 px-4">
                <GitMerge size={30} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', opacity: 0.45 }} />
                <p className="text-xs m-0" style={{ color: 'var(--text-muted)' }}>
                  Sin rutas colaborativas en esta categoría
                </p>
              </div>
            ) : (
              composites.map((comp) => {
                const st = STATUS_CONFIG[comp.status] || STATUS_CONFIG.building;
                return (
                  <button
                    key={comp._id}
                    type="button"
                    onClick={() => handleSelect(comp)}
                    className={`route-pass-card${selected?._id === comp._id ? ' active' : ''}`}
                    style={{ '--route-color': st.color }}
                  >
                    <div className="flex items-center gap-2">
                      <Bus size={13} color={st.color} className="flex-shrink-0" />
                      <span className="font-display text-[13px] font-bold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                        {comp.routeName}
                      </span>
                      <span
                        className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="text-[10.5px] mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-secondary)' }}>
                      <span>{comp.company}</span>
                      <span className="font-mono" style={{ color: comp.direction === 'ida' ? 'var(--mangle)' : 'var(--caribe)' }}>
                        · {comp.direction?.toUpperCase()}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Users size={10} /> {comp.contributorCount}
                      </span>
                      <span className="font-mono tabular-nums">{comp.completionEstimate}%</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selected && (
          <div className="admin-detail-pane">
            <div
              className="md:hidden flex items-center justify-between gap-2 px-3 py-2 flex-shrink-0"
              style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}
            >
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rq-chip"
                style={{ padding: '4px 9px', fontSize: 11 }}
              >
                <ArrowLeft size={12} />
                <span>Volver a la lista</span>
              </button>
              <span className="font-display text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {selected.routeName}
              </span>
            </div>

            <div className="h-[44%] min-h-[180px] relative">
              <AdminVectorMap
                polylines={mapPolylines}
                endpoints={mapEndpoints}
                fitCoordinates={mergedCoords}
                fitTrigger={fitTrigger}
                resizeKey={selected._id}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3" style={{ background: 'var(--bg-dark)' }}>
              <div>
                <h3 className="font-display text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                  {selected.routeName}
                </h3>
                <div className="text-[11.5px] mt-1 flex flex-wrap gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span>{selected.company}</span>
                  <span>· {selected.direction?.toUpperCase()}</span>
                  <span className="font-mono">· {selected.contributorCount} contribuidores</span>
                  <span className="font-mono">
                    · {selected.totalLength ? `${(selected.totalLength / 1000).toFixed(1)} km` : '—'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: 'var(--text-secondary)' }}>Completitud estimada</span>
                  <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--mangle)' }}>
                    {selected.completionEstimate}%
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 99, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${selected.completionEstimate}%`,
                      height: '100%',
                      background: 'var(--mangle)',
                    }}
                  />
                </div>
              </div>

              {selected.status !== 'promoted' ? (
                <div className="rq-card p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--brand)' }}>
                    <Crown size={13} />
                    <span>Promover a ruta oficial (+100 XP c/u)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Código (opcional)"
                      value={promoteForm.codigo}
                      onChange={(e) => setPromoteForm((f) => ({ ...f, codigo: e.target.value }))}
                      className="rq-input px-2.5 py-1.5 text-xs font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Tarifa"
                      value={promoteForm.fare}
                      onChange={(e) => setPromoteForm((f) => ({ ...f, fare: parseInt(e.target.value, 10) || 3700 }))}
                      className="rq-input px-2.5 py-1.5 text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Origen"
                      value={promoteForm.origen}
                      onChange={(e) => setPromoteForm((f) => ({ ...f, origen: e.target.value }))}
                      className="rq-input px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Destino"
                      value={promoteForm.destino}
                      onChange={(e) => setPromoteForm((f) => ({ ...f, destino: e.target.value }))}
                      className="rq-input px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePromote(selected._id)}
                    disabled={promoting === selected._id}
                    className="rq-btn-primary w-full text-xs"
                    style={{ padding: '9px 12px' }}
                  >
                    <Zap size={13} />
                    <span>{promoting === selected._id ? 'Promoviendo...' : 'Promover a oficial'}</span>
                  </button>
                </div>
              ) : (
                <div
                  className="p-2.5 rounded-lg flex items-center gap-2 text-xs"
                  style={{ background: 'var(--mangle-soft)', color: 'var(--mangle)', border: '1px solid var(--border-color)' }}
                >
                  <CheckCircle2 size={15} />
                  <span>Promovida a ruta oficial</span>
                </div>
              )}

              <div>
                {deleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(selected._id)}
                      className="rq-chip"
                      style={{ background: 'var(--carnaval)', color: '#fff', borderColor: 'var(--carnaval)', padding: '6px 12px' }}
                    >
                      Confirmar eliminación
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm(false)} className="rq-chip" style={{ padding: '6px 12px' }}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="rq-chip"
                    style={{ color: 'var(--carnaval)', padding: '5px 10px', fontSize: 11 }}
                  >
                    <Trash2 size={12} />
                    <span>Eliminar colaborativa</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
