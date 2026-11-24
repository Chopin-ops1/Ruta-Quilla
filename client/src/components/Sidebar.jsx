/**
 * ============================================
 * RutaQuilla - Sidebar v4 (Señalética Editorial)
 * ============================================
 *
 * Panel lateral con 4 tabs:
 * - Navegar: Planificador origen→destino estilo itinerario
 * - Rutas: Catálogo agrupado por empresa con placas de bus y ficha técnica
 * - Favoritos: Acceso rápido a rutas guardadas
 * - Capturar: Telemetría GPS para crowdsourcing
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Route,
  Navigation,
  MapPin,
  Bus,
  ChevronRight,
  ChevronDown,
  Crown,
  Download,
  Eye,
  EyeOff,
  Zap,
  Star,
  Clock,
  X,
  Search,
  Loader2,
  ArrowLeftRight,
  ArrowRight,
  RotateCcw,
  Radio,
  Crosshair,
  GitMerge,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mapsAPI } from '../services/api';
import { getRouteLength } from '../utils/geoUtils';
import { safeColor } from '../utils/sanitize';
import RouteNavigator from './RouteNavigator';

function ScheduleRow({ label, block }) {
  if (block === null || block === undefined) {
    return (
      <div className="flex items-center justify-between text-[11px] py-1">
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>Sin información</span>
      </div>
    );
  }
  if (block.opera === false) {
    return (
      <div className="flex items-center justify-between text-[11px] py-1">
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span className="font-mono" style={{ color: 'var(--carnaval)', fontWeight: 600 }}>No opera</span>
      </div>
    );
  }
  const timeRange =
    block.primera_salida && block.ultima_salida
      ? `${block.primera_salida} – ${block.ultima_salida}`
      : 'Servicio activo';
  const freq = block.frecuencia_minutos;
  const freqParts = [];
  if (freq?.pico != null) freqParts.push(`pico ${freq.pico}m`);
  if (freq?.valle != null && freq.valle !== freq?.pico) freqParts.push(`valle ${freq.valle}m`);
  const freqStr = freqParts.length > 0 ? ` · ${freqParts.join(' / ')}` : '';

  return (
    <div className="flex items-start justify-between gap-2 text-[11px] py-1">
      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <div className="flex flex-col items-end leading-tight tabular-nums text-right">
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{timeRange}</span>
        {freqParts.length > 0 && (
          <span className="text-[10px]" style={{ color: 'var(--caribe)', fontWeight: 500 }}>
            {freqParts.join(' · ')}
          </span>
        )}
      </div>
    </div>
  );
}

function getRouteDisplay(route) {
  const hasCode = Boolean(route?.codigo);
  const nameDiffersFromCode = Boolean(route?.nombre && route.nombre !== route?.codigo);
  const title = nameDiffersFromCode
    ? route.nombre
    : route?.descripcion || route?.operador || route?.nombre || 'Ruta';
  const showSubtitle =
    Boolean(route?.descripcion) &&
    route.descripcion !== title &&
    route.descripcion !== route?.nombre;
  const km = Number(route?.distanciaKm) || getRouteLength(route?.ida?.trazado?.coordinates);
  const peakMin = route?.horarios?.lunes_a_viernes?.frecuencia_minutos?.pico;
  const hasReturn = Boolean(route?.tieneRegreso || route?.regreso?.trazado?.coordinates?.length > 1);
  return { hasCode, title, showSubtitle, km, peakMin, hasReturn };
}

function RoutePassCard({
  route,
  isSelected,
  isLoading,
  isFav,
  isAffected,
  showOperator = false,
  onSelect,
  onToggleFavorite,
}) {
  const routeColor = safeColor(route?.color, '#FFC21A');
  const { hasCode, title, showSubtitle, km, peakMin, hasReturn } = getRouteDisplay(route);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(route)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(route);
        }
      }}
      className={`route-pass-card${isSelected ? ' active' : ''}`}
      style={{ '--route-color': routeColor }}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {hasCode && (
              <span className="transit-code flex-shrink-0">{route.codigo}</span>
            )}
            <span
              className="font-display text-[13px] font-bold truncate block"
              style={{ color: 'var(--text-primary)' }}
              title={title}
            >
              {title}
            </span>
          </div>

          {(showSubtitle || (showOperator && title !== route.operador)) && (
            <p
              className="text-[11px] truncate m-0 mt-0.5"
              style={{ color: 'var(--text-secondary)' }}
              title={showSubtitle ? route.descripcion : route.operador}
            >
              {showOperator && title !== route.operador ? route.operador : ''}
              {showOperator && title !== route.operador && showSubtitle ? ' · ' : ''}
              {showSubtitle ? route.descripcion : ''}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {route.sistema === 'masivo' && (
              <span
                className="font-mono text-[9.5px] px-1.5 py-0.5 rounded font-semibold uppercase"
                style={{
                  background: 'var(--caribe-soft)',
                  color: 'var(--caribe)',
                  border: '1px solid color-mix(in srgb, var(--caribe) 28%, transparent)',
                }}
              >
                Transmetro
              </span>
            )}
            {route.esIntermunicipal && (
              <span
                className="font-mono text-[9.5px] px-1.5 py-0.5 rounded font-semibold uppercase"
                style={{
                  background: 'var(--brand-soft)',
                  color: 'var(--brand)',
                  border: '1px solid color-mix(in srgb, var(--brand) 34%, transparent)',
                }}
              >
                Intermunicipal
              </span>
            )}
            {route.type === 'community' && (
              <span className="badge badge-community" style={{ fontSize: '9px', padding: '1px 6px' }}>
                Comunidad
              </span>
            )}
            {km > 0 && (
              <span
                className="inline-flex items-center text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {km.toFixed(1)} km
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              {hasReturn ? <ArrowLeftRight size={9} /> : <ArrowRight size={9} />}
              {hasReturn ? 'Ida y reg.' : 'Lineal'}
            </span>
            {peakMin != null && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold tabular-nums"
                style={{
                  background: 'var(--mangle-soft)',
                  color: 'var(--mangle)',
                  border: '1px solid color-mix(in srgb, var(--mangle) 28%, transparent)',
                }}
              >
                <Zap size={9} />
                {peakMin}m
              </span>
            )}
            {isAffected && (
              <span
                className="inline-flex items-center gap-1 font-mono text-[9.5px] px-1.5 py-0.5 rounded font-bold uppercase"
                style={{
                  background: 'var(--carnaval-soft)',
                  color: 'var(--carnaval)',
                  border: '1px solid color-mix(in srgb, var(--carnaval) 32%, transparent)',
                }}
              >
                <AlertTriangle size={9} /> Reporte
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
          {isLoading && <Loader2 size={14} className="animate-spin" color="var(--brand)" />}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(route._id);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <Star
              size={14}
              fill={isFav ? 'var(--brand)' : 'none'}
              color={isFav ? 'var(--brand)' : 'var(--text-muted)'}
            />
          </button>
          <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </div>
  );
}

function SelectedRouteFicha({
  route,
  isLoading,
  onClose,
  onFocusStop,
}) {
  const [showStopsList, setShowStopsList] = useState(false);
  const [stopDirFilter, setStopDirFilter] = useState('all');
  const [showAllZones, setShowAllZones] = useState(false);

  if (!route) return null;

  const routeColor = safeColor(route.color, '#FFC21A');
  const { hasCode, title, showSubtitle, km, hasReturn } = getRouteDisplay(route);
  const stops = Array.isArray(route.paradas) ? route.paradas : [];
  const hasIdaStops = stops.some((p) => p.sentido !== 'regreso');
  const hasRegStops = stops.some((p) => p.sentido === 'regreso');
  const filteredStops = stops.filter((p) => {
    if (stopDirFilter === 'all') return true;
    const dir = p.sentido === 'regreso' ? 'regreso' : 'ida';
    return dir === stopDirFilter;
  });
  const zones = Array.isArray(route.barriosCubiertos) ? route.barriosCubiertos : [];
  const visibleZones = showAllZones ? zones : zones.slice(0, 8);

  return (
    <div
      className="mx-3 mt-3 rq-card overflow-hidden animate-fade-in"
      style={{
        '--route-color': routeColor,
        borderColor: `color-mix(in srgb, ${routeColor} 55%, var(--border-color))`,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ height: 3, background: routeColor }} />

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {hasCode && <span className="transit-code">{route.codigo}</span>}
              <span
                className="font-mono text-[9.5px] px-2 py-0.5 rounded font-semibold uppercase"
                style={{
                  background:
                    route.sistema === 'masivo'
                      ? 'var(--caribe-soft)'
                      : route.esIntermunicipal
                      ? 'var(--brand-soft)'
                      : 'var(--bg-surface)',
                  color:
                    route.sistema === 'masivo'
                      ? 'var(--caribe)'
                      : route.esIntermunicipal
                      ? 'var(--brand)'
                      : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {route.sistema === 'masivo'
                  ? 'Transmetro'
                  : route.esIntermunicipal
                  ? 'Intermunicipal'
                  : 'Bus Urbano'}
              </span>
            </div>

            <h4 className="font-display text-[15px] font-bold leading-snug m-0" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h4>

            {showSubtitle && (
              <p className="text-[11.5px] mt-0.5 mb-0" style={{ color: 'var(--text-secondary)' }}>
                {route.descripcion}
              </p>
            )}

            {route.operador && title !== route.operador && (
              <p className="text-[11px] mt-1 mb-0 font-semibold" style={{ color: routeColor }}>
                {route.operador}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Cerrar ficha de ruta"
            title="Cerrar ruta"
            className="rq-icon-btn"
            style={{ width: 28, height: 28 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Matriz 3 datos clave */}
        <div
          className="grid grid-cols-3 gap-1.5 mt-3 p-2 rounded-lg"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
        >
          <div className="text-center">
            <div className="rq-section-label">Distancia</div>
            <div className="text-[12px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {km > 0 ? `${km.toFixed(1)} km` : '—'}
            </div>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
            <div className="rq-section-label">Trazado</div>
            <div className="text-[11.5px] font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {hasReturn ? 'Ida y reg.' : 'Lineal'}
            </div>
          </div>
          <div className="text-center">
            <div className="rq-section-label">Tarifa</div>
            <div className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--brand)' }}>
              $3.7k / $3.8k
            </div>
          </div>
        </div>

        {/* Horarios */}
        <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={11} color="var(--brand)" />
            <span className="rq-section-label">Horarios y frecuencias</span>
          </div>
          {route.horarios ? (
            <div>
              <ScheduleRow label="Lun – Vie" block={route.horarios.lunes_a_viernes} />
              <ScheduleRow label="Sábado" block={route.horarios.sabado} />
              <ScheduleRow label="Dom / Fest" block={route.horarios.domingo_y_festivos} />
            </div>
          ) : (
            <p className="text-[11px] m-0 py-0.5" style={{ color: 'var(--text-muted)' }}>
              Sin información de horarios
            </p>
          )}
        </div>

        {/* Métodos de pago */}
        <div
          className="mt-2.5 pt-2.5 flex items-center justify-between gap-2 flex-wrap"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <span className="rq-section-label">Medios de pago</span>
          <div className="flex items-center gap-1 flex-wrap">
            {(route.metodosPago?.length ? route.metodosPago : ['Efectivo']).map((m) => (
              <span
                key={m}
                className="text-[10px] px-2 py-0.5 rounded font-medium"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Paradas interactivas */}
        {(stops.length > 0 || (route.tieneParadas && isLoading)) && (
          <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border-color)' }}>
            {stops.length > 0 ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-1 rounded-md"
                    style={{
                      background: 'var(--mangle-soft)',
                      color: 'var(--mangle)',
                      border: '1px solid color-mix(in srgb, var(--mangle) 28%, transparent)',
                    }}
                  >
                    <MapPin size={11} />
                    <span className="tabular-nums">{stops.length} paradas nombradas</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowStopsList((v) => !v)}
                    className="rq-chip"
                  >
                    <span>{showStopsList ? 'Ocultar lista' : 'Ver paradas'}</span>
                    <ChevronDown
                      size={12}
                      style={{
                        transform: showStopsList ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s ease',
                      }}
                    />
                  </button>
                </div>

                {showStopsList && (
                  <div className="mt-2 space-y-1.5 animate-fade-in">
                    {hasIdaStops && hasRegStops && (
                      <div className="flex items-center gap-1">
                        {[
                          { id: 'all', label: 'Todas' },
                          { id: 'ida', label: 'Ida' },
                          { id: 'regreso', label: 'Regreso' },
                        ].map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setStopDirFilter(d.id)}
                            className={`rq-chip${stopDirFilter === d.id ? ' active' : ''}`}
                            style={{ padding: '3px 8px', fontSize: 10 }}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div
                      className="max-h-44 overflow-y-auto space-y-1 p-1.5 rounded-lg"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                    >
                      {filteredStops.map((stop, idx) => {
                        const isReg = stop.sentido === 'regreso';
                        return (
                          <button
                            key={`${stop.sentido}-${stop.orden}-${idx}`}
                            type="button"
                            onClick={() => onFocusStop?.(stop)}
                            className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-md cursor-pointer transition-colors"
                            style={{ background: 'transparent', border: 'none' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--bg-card)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                            title="Centrar mapa en esta parada"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: isReg ? 'var(--carnaval)' : 'var(--mangle)' }}
                            />
                            <span
                              className="text-[10px] font-bold tabular-nums flex-shrink-0"
                              style={{ color: 'var(--text-muted)', minWidth: 22 }}
                            >
                              #{stop.orden || idx + 1}
                            </span>
                            <span className="text-[11.5px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                              {stop.nombre}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={11} className="animate-spin" color="var(--brand)" />
                <span>Cargando paradas en el mapa...</span>
              </div>
            )}
          </div>
        )}

        {/* Zonas / Barrios */}
        {zones.length > 0 && (
          <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="rq-section-label mb-1.5">Zonas cubiertas</div>
            <div className="flex flex-wrap gap-1">
              {visibleZones.map((zone, i) => (
                <span
                  key={`${zone}-${i}`}
                  className="text-[10.5px] px-2 py-0.5 rounded"
                  style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {zone}
                </span>
              ))}
              {zones.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllZones((v) => !v)}
                  className="rq-chip"
                  style={{ padding: '2px 8px', fontSize: 10 }}
                >
                  {showAllZones ? 'Ver menos' : `+${zones.length - 8} más`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({
  routes,
  isOpen,
  onRouteSelect,
  selectedRoute,
  loadingRouteId = null,
  onClearSelectedRoute,
  onFocusStop,
  onToggleLayer,
  layerVisibility,
  onStartCapture,
  isCapturing,
  // Navigation props
  onNavigate,
  onClearNavigation,
  navigationResult,
  isNavigating,
  selectedOptionIdx,
  onSelectOptionIdx,
  onSetOriginFromMap,
  onSetDestinationFromMap,
  pinMode,
  onPinModeChange,
  onPreviewOriginChange,
  onPreviewDestinationChange,
  activeReports = [],
}) {
  const { isPremium, isAuthenticated } = useAuth();
  const [filterType, setFilterType] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [activeTab, setActiveTab] = useState('navigate');
  const [searchText, setSearchText] = useState('');
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [showPremiumInfo, setShowPremiumInfo] = useState(false);
  const [downloadingOffline, setDownloadingOffline] = useState(false);
  const [offlineError, setOfflineError] = useState('');

  const affectedRouteIds = useMemo(
    () => new Set(activeReports.map((r) => r.routeId).filter(Boolean)),
    [activeReports]
  );

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rutaquilla_favorites') || '[]');
    } catch {
      return [];
    }
  });

  const toggleFavorite = (routeId) => {
    setFavorites((prev) => {
      const next = prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId];
      localStorage.setItem('rutaquilla_favorites', JSON.stringify(next));
      return next;
    });
  };

  const isFavorite = (routeId) => favorites.includes(routeId);

  useEffect(() => {
    if (onSetOriginFromMap || onSetDestinationFromMap) {
      setActiveTab('navigate');
    }
  }, [onSetOriginFromMap, onSetDestinationFromMap]);

  const layerVisibleRoutes = useMemo(
    () =>
      routes.filter((route) => {
        const routeType = route.type || 'official';
        if (routeType === 'official' && layerVisibility?.official === false) return false;
        if (routeType === 'community' && layerVisibility?.community === false) return false;
        return true;
      }),
    [routes, layerVisibility]
  );

  const systemCounts = useMemo(
    () => ({
      all: layerVisibleRoutes.length,
      masivo: layerVisibleRoutes.filter((r) => r.sistema === 'masivo').length,
      urbano: layerVisibleRoutes.filter(
        (r) => (r.sistema || 'urbano') === 'urbano' && !r.esIntermunicipal
      ).length,
      intermunicipal: layerVisibleRoutes.filter((r) => Boolean(r.esIntermunicipal)).length,
    }),
    [layerVisibleRoutes]
  );

  const filteredRoutes = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return layerVisibleRoutes.filter((route) => {
      if (filterType === 'masivo' && route.sistema !== 'masivo') return false;
      if (filterType === 'urbano' && ((route.sistema || 'urbano') !== 'urbano' || route.esIntermunicipal)) {
        return false;
      }
      if (filterType === 'intermunicipal' && !route.esIntermunicipal) return false;
      if (filterCompany !== 'all' && (route.operador || route.company) !== filterCompany) return false;
      if (q) {
        const n = (route.nombre || route.name || '').toLowerCase();
        const cod = (route.codigo || '').toLowerCase();
        const desc = (route.descripcion || '').toLowerCase();
        const c = (route.operador || route.company || '').toLowerCase();
        const zonas = (route.barriosCubiertos || []).join(' ').toLowerCase();
        return n.includes(q) || cod.includes(q) || desc.includes(q) || c.includes(q) || zonas.includes(q);
      }
      return true;
    });
  }, [layerVisibleRoutes, filterType, filterCompany, searchText]);

  const companies = useMemo(() => {
    const unique = [...new Set(routes.map((r) => r.operador || r.company).filter(Boolean))];
    return unique.sort((a, b) => {
      if (a === 'Transmetro') return -1;
      if (b === 'Transmetro') return 1;
      return a.localeCompare(b, 'es');
    });
  }, [routes]);

  const groupedOperators = useMemo(() => {
    const grouped = new Map();
    for (const route of filteredRoutes) {
      const co = route.operador || 'Otra';
      if (!grouped.has(co)) grouped.set(co, []);
      grouped.get(co).push(route);
    }
    return [...grouped.entries()].sort(([a], [b]) => {
      if (a === 'Transmetro') return -1;
      if (b === 'Transmetro') return 1;
      return a.localeCompare(b, 'es');
    });
  }, [filteredRoutes]);

  const hasActiveFilters = filterType !== 'all' || filterCompany !== 'all' || searchText.trim().length > 0;
  const forceExpandAll = searchText.trim().length > 0 || filterCompany !== 'all';

  const handleResetFilters = () => {
    setFilterType('all');
    setFilterCompany('all');
    setSearchText('');
  };

  const handleUpgrade = () => {
    setShowPremiumInfo((prev) => !prev);
  };

  const handleDownloadOffline = async () => {
    if (downloadingOffline) return;
    setDownloadingOffline(true);
    setOfflineError('');
    try {
      const geojson = await mapsAPI.downloadOffline();
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'rutaquilla-offline.geojson';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Error descargando mapa offline:', err);
      setOfflineError(err?.message || 'No se pudo descargar el mapa offline');
    } finally {
      setDownloadingOffline(false);
    }
  };

  return (
    <aside
      style={{
        position: 'fixed',
        top: 56,
        left: 0,
        bottom: 0,
        zIndex: 1050,
        width: '88vw',
        maxWidth: '22.5rem',
        overflow: 'hidden',
        transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
        boxShadow: isOpen ? 'var(--shadow-lg)' : 'none',
      }}
    >
      <div className="h-full flex flex-col">
        {/* Tabs — Riel editorial con indicador sólido */}
        <div
          style={{
            padding: '10px 10px 8px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 4,
              padding: 3,
              borderRadius: 10,
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-color)',
            }}
          >
            {[
              { id: 'navigate', icon: Navigation, label: 'Navegar' },
              { id: 'routes', icon: Route, label: 'Rutas' },
              { id: 'favorites', icon: Star, label: 'Favoritos', badge: favorites.length },
              { id: 'capture', icon: Radio, label: 'Capturar' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  id={`tab-${tab.id}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    padding: '8px 4px 7px',
                    borderRadius: 7,
                    border: `1px solid ${active ? 'var(--border-color)' : 'transparent'}`,
                    cursor: 'pointer',
                    position: 'relative',
                    background: active ? 'var(--bg-card)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <tab.icon
                      size={15}
                      color={active ? 'var(--brand)' : 'var(--text-muted)'}
                    />
                    {tab.badge > 0 && (
                      <span
                        className="tabular-nums"
                        style={{
                          position: 'absolute',
                          top: -5,
                          right: -10,
                          fontSize: 8.5,
                          fontWeight: 700,
                          padding: '0 4px',
                          borderRadius: 999,
                          background: 'var(--brand)',
                          color: 'var(--brand-ink)',
                          lineHeight: '13px',
                        }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      lineHeight: 1,
                    }}
                  >
                    {tab.label}
                  </span>
                  {active && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 1,
                        width: 18,
                        height: 2,
                        borderRadius: 999,
                        background: 'var(--brand)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* ---- Tab: Navegar ---- */}
          {activeTab === 'navigate' && (
            <RouteNavigator
              onNavigate={onNavigate}
              onClear={onClearNavigation}
              navigationResult={navigationResult}
              isNavigating={isNavigating}
              onSetOriginFromMap={onSetOriginFromMap}
              onSetDestinationFromMap={onSetDestinationFromMap}
              pinMode={pinMode}
              onPinModeChange={onPinModeChange}
              selectedOptionIdx={selectedOptionIdx}
              onSelectOptionIdx={onSelectOptionIdx}
              onPreviewOriginChange={onPreviewOriginChange}
              onPreviewDestinationChange={onPreviewDestinationChange}
            />
          )}

          {/* ---- Tab: Rutas ---- */}
          {activeTab === 'routes' && (
            <div className="animate-fade-in">
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)' }}>
                {/* Live summary */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {filteredRoutes.length} {filteredRoutes.length === 1 ? 'ruta' : 'rutas'}
                    </span>
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      · {groupedOperators.length} {groupedOperators.length === 1 ? 'empresa' : 'empresas'}
                    </span>
                  </div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="rq-chip"
                      style={{
                        padding: '3px 8px',
                        fontSize: 10.5,
                        color: 'var(--brand)',
                        borderColor: 'color-mix(in srgb, var(--brand) 38%, var(--border-color))',
                      }}
                    >
                      <RotateCcw size={10} />
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Buscador */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 11px',
                    borderRadius: 8,
                    marginBottom: 10,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Buscar código, ruta, empresa o zona..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: 'var(--text-primary)', fontSize: 12.5, minWidth: 0 }}
                  />
                  {searchText && (
                    <button
                      type="button"
                      onClick={() => setSearchText('')}
                      aria-label="Borrar búsqueda"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Filtros por sistema */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[
                    { value: 'all', label: 'Todas', count: systemCounts.all },
                    { value: 'masivo', label: 'Transmetro', count: systemCounts.masivo },
                    { value: 'urbano', label: 'Urbano', count: systemCounts.urbano },
                    { value: 'intermunicipal', label: 'Intermunic.', count: systemCounts.intermunicipal },
                  ].map((opt) => {
                    const isActive = filterType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFilterType(opt.value)}
                        className={`rq-chip${isActive ? ' active' : ''}`}
                        style={{ padding: '4px 9px', fontSize: 11 }}
                      >
                        <span>{opt.label}</span>
                        <span className="tabular-nums text-[9.5px] opacity-80" style={{ fontWeight: 700 }}>
                          {opt.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selector de empresa */}
                {companies.length > 1 && (
                  <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    aria-label="Filtrar por empresa operadora"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      outline: 'none',
                      marginBottom: 9,
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      Todas las empresas ({routes.length})
                    </option>
                    {companies.map((c) => (
                      <option
                        key={c}
                        value={c}
                        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      >
                        {c} ({routes.filter((r) => (r.operador || r.company) === c).length})
                      </option>
                    ))}
                  </select>
                )}

                {/* Toggles Oficial / Comunidad */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onToggleLayer?.('official')}
                    className="rq-chip"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      padding: '6px 8px',
                      background: layerVisibility?.official ? 'var(--mangle-soft)' : 'var(--bg-card)',
                      color: layerVisibility?.official ? 'var(--mangle)' : 'var(--text-muted)',
                      borderColor: layerVisibility?.official
                        ? 'color-mix(in srgb, var(--mangle) 35%, transparent)'
                        : 'var(--border-color)',
                    }}
                  >
                    {layerVisibility?.official ? <Eye size={12} /> : <EyeOff size={12} />}
                    Oficiales
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleLayer?.('community')}
                    className="rq-chip"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      padding: '6px 8px',
                      background: layerVisibility?.community ? 'var(--caribe-soft)' : 'var(--bg-card)',
                      color: layerVisibility?.community ? 'var(--caribe)' : 'var(--text-muted)',
                      borderColor: layerVisibility?.community
                        ? 'color-mix(in srgb, var(--caribe) 35%, transparent)'
                        : 'var(--border-color)',
                    }}
                  >
                    {layerVisibility?.community ? <Eye size={12} /> : <EyeOff size={12} />}
                    Comunidad
                  </button>
                </div>
              </div>

              {/* Ficha de ruta seleccionada */}
              {selectedRoute && (
                <SelectedRouteFicha
                  key={selectedRoute._id}
                  route={selectedRoute}
                  isLoading={loadingRouteId === selectedRoute._id}
                  onClose={() => onClearSelectedRoute?.()}
                  onFocusStop={onFocusStop}
                />
              )}

              {/* Lista agrupada por empresa */}
              <div className="p-2.5 space-y-1.5">
                {groupedOperators.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Bus size={30} style={{ color: 'var(--text-muted)', margin: '0 auto', opacity: 0.55 }} />
                    <p className="text-xs font-semibold mt-2" style={{ color: 'var(--text-secondary)' }}>
                      No se encontraron rutas con ese filtro
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="rq-btn-ghost mt-3"
                        style={{ padding: '6px 12px', fontSize: 11.5 }}
                      >
                        Restablecer filtros
                      </button>
                    )}
                  </div>
                ) : (
                  groupedOperators.map(([operador, operadorRoutes]) => {
                    const opColor = safeColor(operadorRoutes[0]?.color, '#FFC21A');
                    const isExpanded = forceExpandAll || expandedCompany === operador;
                    const isTransmetro = operador === 'Transmetro';

                    return (
                      <div key={operador}>
                        <button
                          type="button"
                          onClick={() => {
                            if (forceExpandAll) return;
                            setExpandedCompany(expandedCompany === operador ? null : operador);
                          }}
                          className={`operator-group-btn${isExpanded ? ' expanded' : ''}`}
                          style={{ '--op-color': opColor }}
                        >
                          <div
                            style={{
                              width: 4,
                              height: 20,
                              borderRadius: 2,
                              background: opColor,
                              flexShrink: 0,
                            }}
                          />
                          <div className="flex-1 min-w-0 text-left flex items-center gap-1.5">
                            <span
                              className="font-display text-[13px] font-bold truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {operador}
                            </span>
                            {isTransmetro && (
                              <span
                                className="font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex-shrink-0"
                                style={{
                                  background: 'var(--caribe-soft)',
                                  color: 'var(--caribe)',
                                  border: '1px solid color-mix(in srgb, var(--caribe) 32%, transparent)',
                                }}
                              >
                                BRT
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[10.5px] px-2 py-0.5 rounded font-semibold tabular-nums flex-shrink-0"
                            style={{
                              background: 'var(--bg-surface)',
                              color: isExpanded ? 'var(--text-primary)' : 'var(--text-muted)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            {operadorRoutes.length}
                          </span>
                          <ChevronRight
                            size={14}
                            style={{
                              color: 'var(--text-muted)',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.16s ease',
                              flexShrink: 0,
                            }}
                          />
                        </button>

                        {isExpanded && (
                          <div className="pl-2 pr-0.5 space-y-1.5 mt-1.5 mb-2 animate-fade-in">
                            {operadorRoutes.map((route) => (
                              <RoutePassCard
                                key={route._id}
                                route={route}
                                isSelected={selectedRoute?._id === route._id}
                                isLoading={loadingRouteId === route._id}
                                isFav={isFavorite(route._id)}
                                isAffected={affectedRouteIds.has(route._id)}
                                onSelect={onRouteSelect}
                                onToggleFavorite={toggleFavorite}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ---- Tab: Favoritos ---- */}
          {activeTab === 'favorites' && (
            <div className="animate-fade-in p-3">
              {(() => {
                const favRoutes = routes.filter((r) => isFavorite(r._id));
                if (favRoutes.length === 0) {
                  return (
                    <div className="text-center py-10 px-4">
                      <div
                        className="mx-auto mb-3 flex items-center justify-center"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <Star size={20} style={{ color: 'var(--brand)' }} />
                      </div>
                      <p className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        Sin rutas favoritas
                      </p>
                      <p
                        className="text-xs mt-1 leading-relaxed"
                        style={{ color: 'var(--text-muted)', maxWidth: 230, margin: '4px auto 0' }}
                      >
                        Marca con estrella cualquier ruta del catálogo para tenerla aquí a un toque.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-1.5">
                    <div className="rq-section-label mb-2">
                      {favRoutes.length} {favRoutes.length === 1 ? 'ruta guardada' : 'rutas guardadas'}
                    </div>
                    {favRoutes.map((route) => (
                      <RoutePassCard
                        key={route._id}
                        route={route}
                        isSelected={selectedRoute?._id === route._id}
                        isLoading={loadingRouteId === route._id}
                        isFav={true}
                        isAffected={affectedRouteIds.has(route._id)}
                        showOperator={true}
                        onSelect={onRouteSelect}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ---- Tab: Captura GPS ---- */}
          {activeTab === 'capture' && (
            <div className="animate-fade-in p-3.5 space-y-3">
              {/* Tarjeta principal modo cartógrafo */}
              <div className="rq-card p-4">
                <div className="flex items-start gap-3">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9,
                      background: 'var(--plate-bg)',
                      color: 'var(--brand)',
                      border: '1px solid rgba(255, 194, 26, 0.28)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Radio size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="rq-section-label mb-0.5">Crowdsourcing GPS</div>
                    <h3 className="font-display text-[15px] font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                      Registrar recorrido en vivo
                    </h3>
                    <p className="text-[11.5px] mt-1 mb-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      Graba el trazado mientras viajas en bus para aportar o actualizar rutas de la ciudad.
                    </p>
                  </div>
                </div>
              </div>

              {/* Telemetría / Reglas técnicas */}
              <div className="rq-card p-3.5">
                <div className="flex items-center justify-between pb-2.5 mb-2.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <div className={`gps-dot ${isCapturing ? 'recording' : 'inactive'}`} />
                    <span
                      className="text-xs font-bold"
                      style={{ color: isCapturing ? 'var(--carnaval)' : 'var(--text-primary)' }}
                    >
                      {isCapturing ? 'Grabación en curso' : 'GPS en espera'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    5s · ≤ 20m
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { icon: Clock, color: 'var(--brand)', text: 'Muestreo automático cada 5 segundos' },
                    { icon: Crosshair, color: 'var(--mangle)', text: 'Filtro de precisión mínima ≤ 20 metros' },
                    { icon: GitMerge, color: 'var(--caribe)', text: 'Fusión colaborativa con otros aportes' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                      <item.icon size={13} color={item.color} className="flex-shrink-0" />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onStartCapture?.()}
                id="capture-btn"
                className={isCapturing ? 'rq-btn-ghost' : 'rq-btn-primary'}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 13.5,
                  ...(isCapturing
                    ? {
                        background: 'var(--carnaval)',
                        color: '#FFFFFF',
                        borderColor: 'var(--carnaval)',
                      }
                    : {}),
                }}
              >
                {isCapturing ? <Navigation size={16} /> : <Radio size={16} />}
                {isCapturing ? 'Detener captura' : 'Iniciar captura GPS'}
              </button>

              {!isAuthenticated && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-lg text-[11px]"
                  style={{
                    background: 'var(--brand-soft)',
                    border: '1px solid color-mix(in srgb, var(--brand) 32%, transparent)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <AlertTriangle size={13} color="var(--brand)" className="flex-shrink-0" />
                  <span>Inicia sesión para guardar capturas y ganar XP.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: Quilla-Pass */}
        {isAuthenticated && !isPremium && (
          <div className="p-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={handleUpgrade}
              id="upgrade-btn"
              className="rq-card w-full p-2.5 flex items-center gap-2.5 cursor-pointer text-left transition-colors"
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Crown size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                  Quilla-Pass
                </p>
                <p className="text-[10.5px] m-0" style={{ color: 'var(--text-muted)' }}>
                  Sin publicidad · Descarga offline
                </p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
            {showPremiumInfo && (
              <div
                className="animate-fade-in mt-2 p-2.5 rounded-lg text-[11px] leading-relaxed"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
              >
                Activa Quilla-Pass escribiendo a{' '}
                <strong style={{ color: 'var(--brand)' }}>@ruta.quilla</strong>. Con{' '}
                <strong style={{ color: 'var(--brand)' }}>500 XP</strong> tienes 30% de descuento.
              </div>
            )}
          </div>
        )}

        {isPremium && (
          <div className="p-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={handleDownloadOffline}
              disabled={downloadingOffline}
              className="rq-btn-ghost w-full text-xs"
              id="download-offline-btn"
            >
              <Download size={14} /> {downloadingOffline ? 'Descargando...' : 'Descargar mapa offline'}
            </button>
            {offlineError && (
              <p className="text-[10.5px] mt-1.5 text-center" style={{ color: 'var(--carnaval)' }}>
                {offlineError}
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
