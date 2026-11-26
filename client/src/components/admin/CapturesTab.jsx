import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bus,
  CheckCircle2,
  XCircle,
  GitCompare,
  ArrowLeft,
  Search,
  Trash2,
  Map as MapIcon,
  Loader2,
} from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import AdminVectorMap from './AdminVectorMap';

const COLORS = ['#FFC21A', '#3B8BF0', '#1F9D6B', '#E5484D', '#8B7CF6', '#EC4899', '#F97316'];

export default function CapturesTab({ refreshTick = 0, onUseInEditor, onCapturesMutated }) {
  const toast = useToast();
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [comparing, setComparing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCaptures(filter ? { status: filter } : {});
      setCaptures(res.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar capturas');
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  const handleReview = async (id, status) => {
    setSaving(true);
    try {
      await adminAPI.reviewCapture(id, { status, adminNotes: reviewNotes });
      setReviewNotes('');
      setSelected(null);
      toast.success(status === 'approved' ? 'Captura aprobada (+50 XP al usuario)' : 'Captura rechazada');
      load();
      onCapturesMutated?.();
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar la revisión');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCapture = async (id) => {
    setSaving(true);
    try {
      await adminAPI.deleteCapture(id);
      setDeleteConfirm(false);
      setSelected(null);
      toast.success('Captura eliminada');
      load();
      onCapturesMutated?.();
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  };

  const handleCompare = async (routeName) => {
    try {
      const res = await adminAPI.compareCaptures(routeName);
      setComparing({ routeName, captures: res.data || [] });
      setFitTrigger((n) => n + 1);
    } catch (e) {
      toast.error('No se pudieron comparar capturas');
    }
  };

  const handleSelect = async (capture) => {
    setComparing(null);
    setDeleteConfirm(false);
    if (capture.geometry?.coordinates?.length > 0) {
      setSelected(capture);
      setFitTrigger((n) => n + 1);
      return;
    }
    try {
      const res = await adminAPI.getCaptureById(capture._id);
      setSelected(res.data || capture);
      setFitTrigger((n) => n + 1);
    } catch {
      setSelected(capture);
      setFitTrigger((n) => n + 1);
    }
  };

  const filteredCaptures = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return captures;
    return captures.filter(
      (c) =>
        (c.routeName || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.userName || '').toLowerCase().includes(q)
    );
  }, [captures, search]);

  const selectedCoords = selected?.geometry?.coordinates || [];
  const hasDetail = Boolean(selected || comparing);

  const mapPolylines = useMemo(() => {
    if (comparing) {
      return comparing.captures
        .filter((cap) => cap.geometry?.coordinates?.length >= 2)
        .map((cap, i) => ({
          id: cap._id || `cmp-${i}`,
          coordinates: cap.geometry.coordinates,
          color: COLORS[i % COLORS.length],
          width: 4,
          opacity: 0.88,
          showArrows: true,
          label: `${cap.userName} · ${cap.direction}`,
        }));
    }
    if (selectedCoords.length >= 2) {
      return [
        {
          id: selected?._id || 'selected',
          coordinates: selectedCoords,
          color: '#FFC21A',
          width: 4.5,
          opacity: 0.94,
          showArrows: true,
          label: `${selected?.routeName || 'Captura'} · ${selected?.userName || ''}`,
        },
      ];
    }
    return [];
  }, [comparing, selected, selectedCoords]);

  const mapEndpoints = useMemo(() => {
    if (comparing || selectedCoords.length < 2) return [];
    const first = selectedCoords[0];
    const last = selectedCoords[selectedCoords.length - 1];
    return [
      { lng: first[0], lat: first[1], color: '#1F9D6B', label: 'Inicio de captura' },
      { lng: last[0], lat: last[1], color: '#E5484D', label: 'Fin de captura' },
    ];
  }, [comparing, selectedCoords]);

  const fitCoordinates = useMemo(() => {
    if (comparing) {
      return comparing.captures.flatMap((cap) => cap.geometry?.coordinates || []);
    }
    return selectedCoords;
  }, [comparing, selectedCoords]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filtros + Buscador */}
      <div
        className="p-3 flex items-center justify-between gap-2 flex-wrap flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { v: 'pending', l: 'Pendientes' },
            { v: 'approved', l: 'Aprobadas' },
            { v: 'rejected', l: 'Rechazadas' },
            { v: '', l: 'Todas' },
          ].map((f) => (
            <button
              key={f.v}
              type="button"
              onClick={() => {
                setFilter(f.v);
                setSelected(null);
                setComparing(null);
              }}
              className={`rq-chip${filter === f.v ? ' active' : ''}`}
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              {f.l}
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-full sm:w-56"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Filtrar ruta o usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--text-primary)', minWidth: 0 }}
          />
        </div>
      </div>

      {/* Split responsivo */}
      <div className="admin-split-layout flex-1 min-h-0">
        {/* Lista */}
        <div className={`admin-list-pane${hasDetail ? ' hidden md:block' : ''}`} style={{ width: hasDetail ? undefined : '100%' }}>
          <div className="p-2.5 space-y-1.5">
            {loading ? (
              <div className="py-10 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" color="var(--brand)" />
                <span>Cargando capturas...</span>
              </div>
            ) : filteredCaptures.length === 0 ? (
              <p className="py-10 text-center text-xs m-0" style={{ color: 'var(--text-muted)' }}>
                No hay capturas en esta vista.
              </p>
            ) : (
              filteredCaptures.map((c) => {
                const stColor =
                  c.status === 'pending'
                    ? 'var(--brand)'
                    : c.status === 'approved'
                    ? 'var(--mangle)'
                    : 'var(--carnaval)';
                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`route-pass-card${selected?._id === c._id ? ' active' : ''}`}
                    style={{ '--route-color': stColor }}
                  >
                    <div className="flex items-center gap-2">
                      <Bus size={13} color="var(--brand)" className="flex-shrink-0" />
                      <span className="font-display text-[13px] font-bold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                        {c.routeName}
                      </span>
                      <span
                        className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0"
                        style={{
                          background: c.direction === 'ida' ? 'var(--mangle-soft)' : 'var(--caribe-soft)',
                          color: c.direction === 'ida' ? 'var(--mangle)' : 'var(--caribe)',
                        }}
                      >
                        {c.direction}
                      </span>
                    </div>
                    <div className="text-[10.5px] mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-secondary)' }}>
                      <span>{c.userName}</span>
                      <span>· {c.company}</span>
                      <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                        · {new Date(c.createdAt).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detalle + Mapa */}
        {hasDetail && (
          <div className="admin-detail-pane">
            {/* Volver en móvil */}
            <div
              className="md:hidden flex items-center justify-between gap-2 px-3 py-2 flex-shrink-0"
              style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setComparing(null);
                }}
                className="rq-chip"
                style={{ padding: '4px 9px', fontSize: 11 }}
              >
                <ArrowLeft size={12} />
                <span>Volver a la lista</span>
              </button>
              <span className="font-display text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {comparing ? comparing.routeName : selected?.routeName}
              </span>
            </div>

            <div className="h-[46%] min-h-[190px] relative">
              <AdminVectorMap
                polylines={mapPolylines}
                endpoints={mapEndpoints}
                fitCoordinates={fitCoordinates}
                fitTrigger={fitTrigger}
                resizeKey={`${selected?._id || ''}-${comparing?.routeName || ''}`}
              />

              {comparing && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 900,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'var(--panel-bg)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <div className="text-[11px] font-bold" style={{ color: 'var(--brand)' }}>
                    Comparando {comparing.captures.length} capturas
                  </div>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {comparing.captures.map((cap, i) => (
                      <span key={cap._id} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                        {cap.userName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selected && !comparing && (
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3" style={{ background: 'var(--bg-dark)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                      {selected.routeName}
                    </h3>
                    <div className="text-[11.5px] mt-1 flex flex-wrap gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span>{selected.company}</span>
                      <span>· {selected.userName}</span>
                      <span className="font-mono">· {selected.pointCount || selectedCoords.length} pts</span>
                      <span className="font-mono">· ±{selected.averageAccuracy?.toFixed(0) || '?'} m</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rq-icon-btn hidden md:flex"
                    style={{ width: 28, height: 28 }}
                    title="Cerrar detalle"
                  >
                    <XCircle size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCompare(selected.routeName)}
                    className="rq-btn-ghost text-xs"
                    style={{ padding: '7px 10px' }}
                  >
                    <GitCompare size={13} color="var(--caribe)" />
                    <span>Comparar similares</span>
                  </button>

                  {onUseInEditor && selectedCoords.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => onUseInEditor(selected)}
                      className="rq-btn-ghost text-xs"
                      style={{ padding: '7px 10px' }}
                    >
                      <MapIcon size={13} color="var(--brand)" />
                      <span>Abrir en Editor de Rutas</span>
                    </button>
                  )}
                </div>

                {selected.status === 'pending' ? (
                  <div className="rq-card p-3 space-y-2.5">
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Notas para el contribuidor (opcional)..."
                      rows={2}
                      className="rq-input w-full p-2 text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleReview(selected._id, 'approved')}
                        className="flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{
                          background: 'var(--mangle-soft)',
                          color: 'var(--mangle)',
                          border: '1px solid color-mix(in srgb, var(--mangle) 40%, transparent)',
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Aprobar (+50 XP)</span>
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleReview(selected._id, 'rejected')}
                        className="flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{
                          background: 'var(--carnaval-soft)',
                          color: 'var(--carnaval)',
                          border: '1px solid color-mix(in srgb, var(--carnaval) 40%, transparent)',
                        }}
                      >
                        <XCircle size={14} />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-2.5 rounded-lg text-xs"
                    style={{
                      background: selected.status === 'approved' ? 'var(--mangle-soft)' : 'var(--carnaval-soft)',
                      color: selected.status === 'approved' ? 'var(--mangle)' : 'var(--carnaval)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <strong>{selected.status === 'approved' ? 'Aprobada' : 'Rechazada'}</strong>
                    {selected.adminNotes && <p className="m-0 mt-1 text-[11px]">{selected.adminNotes}</p>}
                  </div>
                )}

                <div className="pt-1">
                  {deleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleDeleteCapture(selected._id)}
                        className="rq-chip"
                        style={{ background: 'var(--carnaval)', color: '#fff', borderColor: 'var(--carnaval)', padding: '6px 12px' }}
                      >
                        Confirmar eliminación
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(false)}
                        className="rq-chip"
                        style={{ padding: '6px 12px' }}
                      >
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
                      <span>Eliminar captura</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {comparing && (
              <div className="p-3 flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)' }}>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Mostrando {comparing.captures.length} trazados de {comparing.routeName}
                </span>
                <button type="button" onClick={() => setComparing(null)} className="rq-chip" style={{ padding: '4px 10px', fontSize: 11 }}>
                  Volver al detalle
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
