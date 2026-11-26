import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Undo2,
  Zap,
  Edit3,
  RotateCcw,
  Search,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeftRight,
  List,
  Map as MapIcon,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { routesAPI, adminRoutesAPI } from '../../services/api';
import { snapToRoads } from '../../services/routingService';
import { safeColor } from '../../utils/sanitize';
import AdminVectorMap from './AdminVectorMap';

const OPERATOR_COLORS = {
  Transmetro: '#0EA5E9',
  Coolitoral: '#06B6D4',
  Sobusa: '#F59E0B',
  Sobrusa: '#F59E0B',
  Transmecar: '#10B981',
  Cootransnorte: '#8B5CF6',
  Embusa: '#EC4899',
  'Flota Angulo': '#F97316',
  Sodis: '#A855F7',
  Lolaya: '#EF4444',
  'Lucero San Felipe': '#F472B6',
  Coochofal: '#14B8A6',
  Cootrasol: '#22D3EE',
  'La Carolina': '#818CF8',
  Excolcar: '#3B82F6',
};

export default function RoutesManagerTab({
  refreshTick = 0,
  initialFilter = 'all',
  seedCapture = null,
  onClearSeedCapture,
  onRoutesMutated,
}) {
  const toast = useToast();

  // Catalog state (lightweight metadata list)
  const [routes, setRoutes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter || 'all');
  const [togglingId, setTogglingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Responsive mobile view switcher: 'catalog' | 'editor'
  const [mobileView, setMobileView] = useState('catalog');

  // Editor form & geometry state
  const [loadingRouteGeo, setLoadingRouteGeo] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [editMode, setEditMode] = useState('idle'); // 'idle' | 'ida' | 'regreso'
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [operador, setOperador] = useState('Coolitoral');
  const [sistema, setSistema] = useState('urbano');
  const [esIntermunicipal, setEsIntermunicipal] = useState(false);
  const [tipoRecorrido, setTipoRecorrido] = useState('circular');
  const [fare, setFare] = useState(3700);
  const [color, setColor] = useState('#06B6D4');
  const [activa, setActiva] = useState(true);
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [revisadoManualmente, setRevisadoManualmente] = useState(true);

  const [idaPoints, setIdaPoints] = useState([]);
  const [regresoPoints, setRegresoPoints] = useState([]);
  const [snappedIda, setSnappedIda] = useState([]);
  const [snappedRegreso, setSnappedRegreso] = useState([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);

  useEffect(() => {
    if (initialFilter) setStatusFilter(initialFilter);
  }, [initialFilter]);

  const loadRoutes = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await routesAPI.getAll({ includeInactive: 'true' });
      setRoutes(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar el catálogo de rutas');
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes, refreshTick]);

  // Seed editor from CapturesTab ("Usar trazado en Editor")
  useEffect(() => {
    if (!seedCapture) return;
    const coords = (seedCapture.geometry?.coordinates || []).map((c) => ({ lat: c[1], lng: c[0] }));
    setEditingRouteId(null);
    setCodigo('');
    setNombre(seedCapture.routeName || '');
    setOperador(seedCapture.company || 'Coolitoral');
    setColor(OPERATOR_COLORS[seedCapture.company] || '#06B6D4');
    setSistema(seedCapture.company === 'Transmetro' ? 'masivo' : 'urbano');
    setEsIntermunicipal(false);
    setFare(3700);
    setActiva(true);
    setOrigen('');
    setDestino('');
    setDescripcion(`Importada desde captura GPS de ${seedCapture.userName || 'comunidad'}`);
    setRevisadoManualmente(true);

    if (seedCapture.direction === 'vuelta') {
      setIdaPoints([]);
      setRegresoPoints(coords);
      setTipoRecorrido('circular');
      setEditMode('regreso');
    } else {
      setIdaPoints(coords);
      setRegresoPoints([]);
      setTipoRecorrido('lineal');
      setEditMode('ida');
    }
    setSnappedIda([]);
    setSnappedRegreso([]);
    setMobileView('editor');
    setFitTrigger((n) => n + 1);
    onClearSeedCapture?.();
  }, [seedCapture, onClearSeedCapture]);

  const resetEditor = useCallback(() => {
    setEditingRouteId(null);
    setEditMode('idle');
    setCodigo('');
    setNombre('');
    setOperador('Coolitoral');
    setColor('#06B6D4');
    setSistema('urbano');
    setEsIntermunicipal(false);
    setTipoRecorrido('circular');
    setFare(3700);
    setActiva(true);
    setOrigen('');
    setDestino('');
    setDescripcion('');
    setRevisadoManualmente(true);
    setIdaPoints([]);
    setRegresoPoints([]);
    setSnappedIda([]);
    setSnappedRegreso([]);
  }, []);

  const handleStartNew = () => {
    resetEditor();
    setEditMode('ida');
    setMobileView('editor');
  };

  const handleSelectEdit = async (routeSummary) => {
    setLoadingRouteGeo(true);
    setMobileView('editor');
    try {
      const res = await routesAPI.getById(routeSummary._id);
      const r = res.data || routeSummary;
      setEditingRouteId(r._id);
      setCodigo(r.codigo || '');
      setNombre(r.nombre || '');
      setOperador(r.operador || 'Coolitoral');
      setColor(safeColor(r.color, '#06B6D4'));
      setSistema(r.sistema || 'urbano');
      setEsIntermunicipal(Boolean(r.esIntermunicipal));
      setTipoRecorrido(r.tipoRecorrido || (r.regreso?.trazado?.coordinates?.length > 1 ? 'circular' : 'lineal'));
      setFare(r.fare || 3700);
      setActiva(r.activa !== false);
      setOrigen(r.origen || '');
      setDestino(r.destino || '');
      setDescripcion(r.descripcion || '');
      setRevisadoManualmente(true);
      setIdaPoints((r.ida?.trazado?.coordinates || []).map((c) => ({ lat: c[1], lng: c[0] })));
      setRegresoPoints((r.regreso?.trazado?.coordinates || []).map((c) => ({ lat: c[1], lng: c[0] })));
      setSnappedIda([]);
      setSnappedRegreso([]);
      setEditMode('ida');
      setFitTrigger((n) => n + 1);
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar la geometría de la ruta');
    } finally {
      setLoadingRouteGeo(false);
    }
  };

  const handleToggleActive = async (route) => {
    setTogglingId(route._id);
    try {
      const res = await adminRoutesAPI.toggleActive(route._id, !route.activa);
      const nextActive = res.data?.activa ?? !route.activa;
      setRoutes((prev) => prev.map((r) => (r._id === route._id ? { ...r, activa: nextActive } : r)));
      if (editingRouteId === route._id) setActiva(nextActive);
      toast.success(nextActive ? `Ruta "${route.nombre}" activada` : `Ruta "${route.nombre}" pausada`);
      onRoutesMutated?.();
    } catch (err) {
      toast.error(err.message || 'Error cambiando el estado de la ruta');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminRoutesAPI.delete(id);
      setDeleteConfirmId(null);
      if (editingRouteId === id) resetEditor();
      toast.success('Ruta eliminada');
      loadRoutes();
      onRoutesMutated?.();
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar la ruta');
    }
  };

  const activePoints = editMode === 'regreso' ? regresoPoints : idaPoints;
  const setActivePoints = editMode === 'regreso' ? setRegresoPoints : setIdaPoints;

  const handleAddPoint = useCallback(
    (point) => {
      if (editMode === 'idle') return;
      setActivePoints((prev) => [...prev, point]);
      if (editMode === 'ida') setSnappedIda([]);
      else setSnappedRegreso([]);
    },
    [editMode, setActivePoints]
  );

  const handlePointDrag = useCallback((index, direction, newLatLng) => {
    const setter = direction === 'ida' ? setIdaPoints : setRegresoPoints;
    setter((prev) => {
      const updated = [...prev];
      updated[index] = { lat: newLatLng.lat, lng: newLatLng.lng };
      return updated;
    });
    if (direction === 'ida') setSnappedIda([]);
    else setSnappedRegreso([]);
  }, []);

  const handlePointRemove = useCallback((index, direction) => {
    const setter = direction === 'ida' ? setIdaPoints : setRegresoPoints;
    setter((prev) => prev.filter((_, idx) => idx !== index));
    if (direction === 'ida') setSnappedIda([]);
    else setSnappedRegreso([]);
  }, []);

  const handleUndo = () => {
    setActivePoints((prev) => prev.slice(0, -1));
    if (editMode === 'ida') setSnappedIda([]);
    else setSnappedRegreso([]);
  };

  const handleReverseSegment = () => {
    setActivePoints((prev) => [...prev].reverse());
    if (editMode === 'ida') setSnappedIda([]);
    else setSnappedRegreso([]);
  };

  const handleClearSegment = () => {
    setActivePoints([]);
    if (editMode === 'ida') setSnappedIda([]);
    else setSnappedRegreso([]);
  };

  const handleSnapToRoads = async () => {
    const points = editMode === 'ida' ? idaPoints : regresoPoints;
    if (points.length < 2) return;
    setIsSnapping(true);
    try {
      const snapped = await snapToRoads(points, true);
      if (editMode === 'ida') setSnappedIda(snapped);
      else setSnappedRegreso(snapped);
      toast.success('Trazado ajustado a las calles');
    } catch {
      toast.error('No se pudo ajustar a calles con OSRM');
    } finally {
      setIsSnapping(false);
    }
  };

  const handleSave = async () => {
    if (!nombre.trim() || !operador.trim()) {
      toast.warning('Nombre y operador son obligatorios');
      return;
    }
    const idaCoords = (snappedIda.length > 1 ? snappedIda : idaPoints).map((p) => [p.lng, p.lat]);
    const regresoCoords = (snappedRegreso.length > 1 ? snappedRegreso : regresoPoints).map((p) => [p.lng, p.lat]);
    if (idaCoords.length < 2) {
      toast.warning('Se requieren al menos 2 puntos en el trazado de Ida');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        operador: operador.trim(),
        color: safeColor(color, '#06B6D4'),
        sistema,
        esIntermunicipal,
        tipoRecorrido,
        fare: Number(fare) || 3700,
        activa,
        origen: origen.trim(),
        destino: destino.trim(),
        descripcion: descripcion.trim(),
        revisadoManualmente,
        ida: { trazado: { coordinates: idaCoords } },
      };

      if (regresoCoords.length >= 2) {
        payload.regreso = { trazado: { coordinates: regresoCoords } };
      } else if (editingRouteId && tipoRecorrido === 'lineal') {
        payload.clearRegreso = true;
      }

      if (editingRouteId) {
        await adminRoutesAPI.update(editingRouteId, payload);
        toast.success('Ruta actualizada correctamente');
      } else {
        await adminRoutesAPI.create(payload);
        toast.success('Nueva ruta creada');
      }
      resetEditor();
      loadRoutes();
      onRoutesMutated?.();
    } catch (err) {
      toast.error(err.message || 'Error al guardar la ruta');
    } finally {
      setSaving(false);
    }
  };

  const filteredRoutes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return routes.filter((r) => {
      if (statusFilter === 'active' && r.activa === false) return false;
      if (statusFilter === 'inactive' && r.activa !== false) return false;
      if (statusFilter === 'masivo' && r.sistema !== 'masivo') return false;
      if (statusFilter === 'urbano' && ((r.sistema || 'urbano') !== 'urbano' || r.esIntermunicipal)) return false;
      if (statusFilter === 'intermunicipal' && !r.esIntermunicipal) return false;
      if (statusFilter === 'audit' && !r.trazadoIncompleto && r.geometriaOSM !== false) return false;
      if (!q) return true;
      return (
        (r.nombre || '').toLowerCase().includes(q) ||
        (r.codigo || '').toLowerCase().includes(q) ||
        (r.operador || '').toLowerCase().includes(q)
      );
    });
  }, [routes, search, statusFilter]);

  const idaCoordsLngLat = useMemo(
    () => (snappedIda.length > 1 ? snappedIda : idaPoints).map((p) => [p.lng, p.lat]),
    [snappedIda, idaPoints]
  );
  const regresoCoordsLngLat = useMemo(
    () => (snappedRegreso.length > 1 ? snappedRegreso : regresoPoints).map((p) => [p.lng, p.lat]),
    [snappedRegreso, regresoPoints]
  );

  const mapPolylines = useMemo(() => {
    const list = [];
    if (idaCoordsLngLat.length > 1) {
      list.push({
        id: 'ida',
        coordinates: idaCoordsLngLat,
        color: '#1F9D6B',
        width: 4.5,
        opacity: 0.94,
        dashed: snappedIda.length <= 1 && !editingRouteId,
        showArrows: true,
        label: 'Sentido Ida',
      });
    }
    if (regresoCoordsLngLat.length > 1) {
      list.push({
        id: 'regreso',
        coordinates: regresoCoordsLngLat,
        color: '#E5484D',
        width: 4,
        opacity: 0.9,
        dashed: snappedRegreso.length <= 1 && !editingRouteId,
        showArrows: true,
        label: 'Sentido Regreso',
      });
    }
    return list;
  }, [idaCoordsLngLat, regresoCoordsLngLat, snappedIda.length, snappedRegreso.length, editingRouteId]);

  const mapEndpoints = useMemo(() => {
    const pts = [];
    if (idaCoordsLngLat.length >= 2) {
      pts.push({ lng: idaCoordsLngLat[0][0], lat: idaCoordsLngLat[0][1], color: '#1F9D6B', label: 'Inicio Ida' });
      const last = idaCoordsLngLat[idaCoordsLngLat.length - 1];
      pts.push({ lng: last[0], lat: last[1], color: '#FFC21A', label: 'Fin Ida' });
    }
    return pts;
  }, [idaCoordsLngLat]);

  const fitCoordinates = useMemo(() => {
    if (editMode === 'regreso' && regresoCoordsLngLat.length > 0) return regresoCoordsLngLat;
    if (idaCoordsLngLat.length > 0) return idaCoordsLngLat;
    return regresoCoordsLngLat;
  }, [editMode, idaCoordsLngLat, regresoCoordsLngLat]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Conmutador móvil Catálogo / Editor */}
      <div
        className="md:hidden flex items-center gap-1.5 p-2 flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}
      >
        <button
          type="button"
          onClick={() => setMobileView('catalog')}
          className={`rq-chip flex-1 justify-center${mobileView === 'catalog' ? ' active' : ''}`}
          style={{ padding: '7px 10px' }}
        >
          <List size={13} />
          <span>Catálogo ({filteredRoutes.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView('editor')}
          className={`rq-chip flex-1 justify-center${mobileView === 'editor' ? ' active' : ''}`}
          style={{ padding: '7px 10px' }}
        >
          <MapIcon size={13} />
          <span>{editingRouteId ? 'Editando ruta' : 'Editor y Mapa'}</span>
        </button>
      </div>

      <div className="admin-split-layout flex-1 min-h-0">
        {/* Columna Izquierda: Catálogo de rutas + Formulario cuando editas/creas */}
        <div
          className={`admin-list-pane${mobileView === 'editor' ? ' hidden md:block' : ''}`}
        >
          <div className="p-3 space-y-2.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="rq-section-label">
                Catálogo ({routes.length})
              </span>
              <button
                type="button"
                onClick={handleStartNew}
                className="rq-btn-primary text-[11.5px]"
                style={{ padding: '6px 11px' }}
              >
                <Plus size={13} />
                <span>Nueva ruta</span>
              </button>
            </div>

            <div
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <Search size={13} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Código, ruta o empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-xs"
                style={{ color: 'var(--text-primary)', minWidth: 0 }}
              />
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'active', label: 'Activas' },
                { id: 'inactive', label: 'Pausadas' },
                { id: 'masivo', label: 'Transmetro' },
                { id: 'urbano', label: 'Urbanas' },
                { id: 'intermunicipal', label: 'Intermunic.' },
                { id: 'audit', label: 'Incompletas' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rq-chip${statusFilter === f.id ? ' active' : ''}`}
                  style={{ padding: '3px 8px', fontSize: 10.5 }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 space-y-1.5">
            {loadingList ? (
              <div className="py-10 text-center text-xs flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={14} className="animate-spin" color="var(--brand)" />
                <span>Cargando catálogo...</span>
              </div>
            ) : filteredRoutes.length === 0 ? (
              <p className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                Sin rutas con este filtro.
              </p>
            ) : (
              filteredRoutes.map((route) => {
                const isSelected = editingRouteId === route._id;
                const rCol = safeColor(route.color, '#FFC21A');
                const isActive = route.activa !== false;
                return (
                  <div
                    key={route._id}
                    className={`route-pass-card${isSelected ? ' active' : ''}`}
                    style={{ '--route-color': rCol, padding: '9px 10px 9px 12px' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {route.codigo && <span className="transit-code flex-shrink-0">{route.codigo}</span>}
                          <span className="font-display text-[12.5px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                            {route.nombre}
                          </span>
                        </div>
                        <div className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                          {route.operador}
                          {route.distanciaKm > 0 ? ` · ${route.distanciaKm.toFixed(1)} km` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={togglingId === route._id}
                        onClick={() => handleToggleActive(route)}
                        className="rq-chip flex-shrink-0"
                        style={{
                          padding: '3px 7px',
                          fontSize: 10,
                          background: isActive ? 'var(--mangle-soft)' : 'var(--carnaval-soft)',
                          color: isActive ? 'var(--mangle)' : 'var(--carnaval)',
                          borderColor: isActive
                            ? 'color-mix(in srgb, var(--mangle) 35%, transparent)'
                            : 'color-mix(in srgb, var(--carnaval) 35%, transparent)',
                        }}
                        title={isActive ? 'Pausar ruta' : 'Reactivar ruta'}
                      >
                        {isActive ? <Eye size={10} /> : <EyeOff size={10} />}
                        <span>{isActive ? 'Activa' : 'Pausada'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => handleSelectEdit(route)}
                        className="rq-btn-ghost flex-1 text-[11px]"
                        style={{ padding: '5px 8px' }}
                      >
                        <Edit3 size={11} />
                        <span>Editar trazado</span>
                      </button>

                      {deleteConfirmId === route._id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDelete(route._id)}
                            className="rq-chip"
                            style={{
                              padding: '5px 9px',
                              fontSize: 10.5,
                              background: 'var(--carnaval)',
                              color: '#FFFFFF',
                              borderColor: 'var(--carnaval)',
                            }}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rq-chip"
                            style={{ padding: '5px 8px', fontSize: 10.5 }}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(route._id)}
                          className="rq-icon-btn"
                          style={{ width: 28, height: 28, color: 'var(--carnaval)' }}
                          title="Eliminar ruta"
                          aria-label="Eliminar ruta"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Formulario compacto + Mapa Leaflet */}
        <div
          className={`admin-detail-pane${mobileView === 'catalog' ? ' hidden md:flex' : ''}`}
        >
          {/* Barra superior de edición */}
          <div
            className="p-2.5 sm:p-3 space-y-2 flex-shrink-0 overflow-y-auto max-h-[48vh] md:max-h-[38vh]"
            style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="rq-section-label">
                  {editingRouteId ? 'Editando ruta' : editMode === 'idle' ? 'Vista general de mapa' : 'Nueva ruta'}
                </span>
                {loadingRouteGeo && <Loader2 size={13} className="animate-spin" color="var(--brand)" />}
              </div>

              <div className="flex items-center gap-1.5">
                {editMode !== 'idle' && (
                  <button
                    type="button"
                    onClick={resetEditor}
                    className="rq-chip"
                    style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--carnaval)' }}
                  >
                    <RotateCcw size={11} />
                    <span>Cancelar</span>
                  </button>
                )}
                {editMode === 'idle' && (
                  <button
                    type="button"
                    onClick={handleStartNew}
                    className="rq-btn-primary text-[11px]"
                    style={{ padding: '5px 10px' }}
                  >
                    <Plus size={12} />
                    <span>Trazar nueva</span>
                  </button>
                )}
              </div>
            </div>

            {editMode !== 'idle' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Nombre de la ruta *"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="rq-input px-2.5 py-1.5 text-xs sm:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="Código (ej. A1-2, C20)"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="rq-input px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <select
                    value={Object.keys(OPERATOR_COLORS).includes(operador) ? operador : 'Otra'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOperador(val);
                      if (OPERATOR_COLORS[val]) setColor(OPERATOR_COLORS[val]);
                      if (val === 'Transmetro') setSistema('masivo');
                    }}
                    className="rq-input px-2 py-1.5 text-xs"
                  >
                    {Object.keys(OPERATOR_COLORS).map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                    <option value="Otra">Otra empresa</option>
                  </select>

                  <select
                    value={sistema}
                    onChange={(e) => setSistema(e.target.value)}
                    className="rq-input px-2 py-1.5 text-xs"
                  >
                    <option value="urbano">Urbano</option>
                    <option value="masivo">Transmetro</option>
                  </select>

                  <select
                    value={tipoRecorrido}
                    onChange={(e) => setTipoRecorrido(e.target.value)}
                    className="rq-input px-2 py-1.5 text-xs"
                  >
                    <option value="circular">Ida y reg.</option>
                    <option value="lineal">Lineal</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Tarifa"
                    value={fare}
                    onChange={(e) => setFare(parseInt(e.target.value, 10) || 0)}
                    className="rq-input px-2 py-1.5 text-xs font-mono"
                  />

                  <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                    <input
                      type="color"
                      value={safeColor(color, '#06B6D4')}
                      onChange={(e) => setColor(e.target.value)}
                      style={{ width: 32, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      aria-label="Color de ruta"
                    />
                    <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={esIntermunicipal}
                        onChange={(e) => setEsIntermunicipal(e.target.checked)}
                      />
                      <span>Interm.</span>
                    </label>
                  </div>
                </div>

                {(!Object.keys(OPERATOR_COLORS).includes(operador) || operador === 'Otra') && (
                  <input
                    type="text"
                    placeholder="Nombre de la empresa operadora *"
                    value={operador === 'Otra' ? '' : operador}
                    onChange={(e) => setOperador(e.target.value)}
                    className="rq-input px-2.5 py-1.5 text-xs w-full"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Origen (ej. Portal Soledad)"
                    value={origen}
                    onChange={(e) => setOrigen(e.target.value)}
                    className="rq-input px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Destino (ej. Centro / Prado)"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    className="rq-input px-2.5 py-1.5 text-xs"
                  />
                </div>

                {/* Controles de trazado */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEditMode('ida')}
                      className="rq-chip"
                      style={{
                        padding: '4px 9px',
                        fontSize: 11,
                        background: editMode === 'ida' ? 'var(--mangle-soft)' : 'var(--bg-card)',
                        color: editMode === 'ida' ? 'var(--mangle)' : 'var(--text-secondary)',
                        borderColor: editMode === 'ida' ? 'var(--mangle)' : 'var(--border-color)',
                      }}
                    >
                      Ida ({idaPoints.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode('regreso')}
                      className="rq-chip"
                      style={{
                        padding: '4px 9px',
                        fontSize: 11,
                        background: editMode === 'regreso' ? 'var(--carnaval-soft)' : 'var(--bg-card)',
                        color: editMode === 'regreso' ? 'var(--carnaval)' : 'var(--text-secondary)',
                        borderColor: editMode === 'regreso' ? 'var(--carnaval)' : 'var(--border-color)',
                      }}
                    >
                      Regreso ({regresoPoints.length})
                    </button>

                    <button type="button" onClick={handleUndo} disabled={!activePoints.length} className="rq-chip" style={{ padding: '4px 8px', fontSize: 10.5, opacity: activePoints.length ? 1 : 0.4 }}>
                      <Undo2 size={11} /> Deshacer
                    </button>
                    <button type="button" onClick={handleReverseSegment} disabled={activePoints.length < 2} className="rq-chip" style={{ padding: '4px 8px', fontSize: 10.5, opacity: activePoints.length >= 2 ? 1 : 0.4 }}>
                      <ArrowLeftRight size={11} /> Invertir
                    </button>
                    <button type="button" onClick={handleSnapToRoads} disabled={activePoints.length < 2 || isSnapping} className="rq-chip" style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--brand)', opacity: activePoints.length >= 2 ? 1 : 0.4 }}>
                      <Zap size={11} /> {isSnapping ? 'Ajustando...' : 'Snap calles'}
                    </button>
                    <button type="button" onClick={handleClearSegment} disabled={!activePoints.length} className="rq-chip" style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--carnaval)', opacity: activePoints.length ? 1 : 0.4 }}>
                      Limpiar tramo
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || idaPoints.length < 2 || !nombre.trim()}
                    className="rq-btn-primary text-xs"
                    style={{
                      padding: '7px 14px',
                      opacity: saving || idaPoints.length < 2 || !nombre.trim() ? 0.45 : 1,
                    }}
                  >
                    <Save size={13} />
                    <span>{saving ? 'Guardando...' : editingRouteId ? 'Actualizar' : 'Guardar ruta'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mapa Vectorial MapLibre GL (idéntico al de la app normal) */}
          <div className="flex-1 relative min-h-[220px]">
            <AdminVectorMap
              polylines={mapPolylines}
              endpoints={mapEndpoints}
              editablePoints={editMode === 'ida' ? idaPoints : editMode === 'regreso' ? regresoPoints : []}
              editableColor={editMode === 'regreso' ? '#E5484D' : '#1F9D6B'}
              onPointDrag={(idx, ll) => handlePointDrag(idx, editMode === 'regreso' ? 'regreso' : 'ida', ll)}
              onPointRemove={(idx) => handlePointRemove(idx, editMode === 'regreso' ? 'regreso' : 'ida')}
              interactiveClick={editMode !== 'idle'}
              onMapClick={handleAddPoint}
              fitCoordinates={fitCoordinates}
              fitTrigger={fitTrigger}
              resizeKey={`${mobileView}-${editMode}`}
            />

            {editMode !== 'idle' && (
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 900,
                  background: 'var(--plate-bg)',
                  color: '#F2EFE8',
                  border: '1px solid rgba(255, 194, 26, 0.3)',
                  borderLeft: `4px solid ${editMode === 'ida' ? '#1F9D6B' : '#E5484D'}`,
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                Toca el mapa para agregar · Arrastra para mover ({activePoints.length} pts)
              </div>
            )}

            {editMode === 'idle' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 900,
                  background: 'var(--panel-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '7px 14px',
                  borderRadius: 10,
                  fontSize: 11.5,
                  fontWeight: 600,
                  boxShadow: 'var(--shadow-md)',
                  whiteSpace: 'nowrap',
                }}
              >
                Selecciona una ruta del catálogo o pulsa «Trazar nueva»
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
