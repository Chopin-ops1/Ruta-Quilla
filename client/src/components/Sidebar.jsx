/**
 * ============================================
 * RutaQuilla - Sidebar (Panel Lateral v3)
 * ============================================
 *
 * Panel lateral con 4 tabs:
 * - Navegar: Panel de navegación origen→destino (Google Maps style)
 * - Rutas: Catálogo moderno agrupado por empresa con filtros, búsqueda y ficha técnica
 * - Favoritos: Acceso rápido a rutas guardadas
 * - Capturar: Captura GPS para crowdsourcing
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
        <span style={{ color: '#EF4444', fontWeight: 600 }}>No opera</span>
      </div>
    );
  }
  const timeRange =
    block.primera_salida && block.ultima_salida
      ? `${block.primera_salida} – ${block.ultima_salida}`
      : 'Servicio activo';
  const freq = block.frecuencia_minutos;
  const freqParts = [];
  if (freq?.pico != null) freqParts.push(`pico ${freq.pico} min`);
  if (freq?.valle != null && freq.valle !== freq?.pico) freqParts.push(`valle ${freq.valle} min`);
  const freqStr = freqParts.length > 0 ? ` · ${freqParts.join(' / ')}` : '';

  return (
    <div className="flex items-center justify-between gap-2 text-[11px] py-1">
      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <span className="tabular-nums text-right" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
        {timeRange}
        {freqStr && <span style={{ color: 'var(--accent-cyan)', fontWeight: 500 }}>{freqStr}</span>}
      </span>
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
  const routeColor = safeColor(route?.color, '#06B6D4');
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
          <div className="flex items-center gap-1.5 min-w-0">
            {hasCode && (
              <span
                className="transit-code flex-shrink-0"
                style={{
                  background: `${routeColor}1F`,
                  color: routeColor,
                  border: `1px solid ${routeColor}45`,
                }}
              >
                {route.codigo}
              </span>
            )}
            <span
              className="text-[12.5px] font-semibold truncate block"
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

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {route.sistema === 'masivo' && (
              <span
                className="text-[9.5px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: 'rgba(6,182,212,0.12)',
                  color: '#06B6D4',
                  border: '1px solid rgba(6,182,212,0.28)',
                }}
              >
                Transmetro
              </span>
            )}
            {route.esIntermunicipal && (
              <span
                className="text-[9.5px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  color: '#F59E0B',
                  border: '1px solid rgba(245,158,11,0.28)',
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
                className="inline-flex items-center text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-md"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--subtle-border)',
                }}
              >
                {km.toFixed(1)} km
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 text-[9.5px] px-1.5 py-0.5 rounded-md font-medium"
              style={{
                background: hasReturn ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-card)',
                color: hasReturn ? '#A78BFA' : 'var(--text-muted)',
                border: `1px solid ${hasReturn ? 'rgba(139, 92, 246, 0.22)' : 'var(--subtle-border)'}`,
              }}
            >
              {hasReturn ? <ArrowLeftRight size={9} /> : <ArrowRight size={9} />}
              {hasReturn ? 'Ida y reg.' : 'Lineal'}
            </span>
            {peakMin != null && (
              <span
                className="inline-flex items-center gap-0.5 text-[9.5px] px-1.5 py-0.5 rounded-md font-medium tabular-nums"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  color: '#10B981',
                  border: '1px solid rgba(16,185,129,0.24)',
                }}
              >
                <Zap size={9} />
                {peakMin}m
              </span>
            )}
            {isAffected && (
              <span
                className="text-[9.5px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  color: '#EF4444',
                  border: '1px solid rgba(239,68,68,0.3)',
                  animation: 'pulse 2s infinite',
                }}
              >
                ⚠️ Reporte
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
          {isLoading && <Loader2 size={14} className="animate-spin" color="#06B6D4" />}
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
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <Star
              size={14}
              fill={isFav ? '#F59E0B' : 'none'}
              color={isFav ? '#F59E0B' : 'var(--text-muted)'}
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

  const routeColor = safeColor(route.color, '#06B6D4');
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
      className="mx-3 mt-3 rounded-2xl overflow-hidden animate-fade-in"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${routeColor}55`,
        boxShadow: '0 10px 28px var(--shadow-color)',
      }}
    >
      {/* Top accent strip */}
      <div style={{ height: 3, background: routeColor }} />

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {hasCode && (
                <span
                  className="transit-code"
                  style={{
                    background: `${routeColor}20`,
                    color: routeColor,
                    border: `1px solid ${routeColor}45`,
                  }}
                >
                  {route.codigo}
                </span>
              )}
              <span
                className="text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase"
                style={{
                  background:
                    route.sistema === 'masivo'
                      ? 'rgba(6,182,212,0.14)'
                      : route.esIntermunicipal
                      ? 'rgba(245,158,11,0.14)'
                      : 'var(--subtle-bg)',
                  color:
                    route.sistema === 'masivo'
                      ? '#06B6D4'
                      : route.esIntermunicipal
                      ? '#F59E0B'
                      : 'var(--text-secondary)',
                }}
              >
                {route.sistema === 'masivo'
                  ? 'Transmetro'
                  : route.esIntermunicipal
                  ? 'Intermunicipal'
                  : 'Bus Urbano'}
              </span>
            </div>

            <h4
              className="text-[14px] font-bold leading-snug m-0"
              style={{ color: 'var(--text-primary)', fontFamily: 'Outfit, Inter, sans-serif' }}
            >
              {title}
            </h4>

            {showSubtitle && (
              <p className="text-[11.5px] mt-0.5 mb-0" style={{ color: 'var(--text-secondary)' }}>
                {route.descripcion}
              </p>
            )}

            {route.operador && title !== route.operador && (
              <p className="text-[11px] mt-0.5 mb-0 font-medium" style={{ color: routeColor }}>
                {route.operador}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Cerrar ficha de ruta"
            title="Cerrar ruta"
            style={{
              background: 'var(--subtle-bg)',
              border: '1px solid var(--subtle-border)',
              borderRadius: 9,
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* 3 quick metrics strip */}
        <div
          className="grid grid-cols-3 gap-1.5 mt-3 p-2 rounded-xl"
          style={{ background: 'var(--subtle-bg)', border: '1px solid var(--subtle-border)' }}
        >
          <div className="text-center">
            <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Distancia
            </div>
            <div className="text-[12px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {km > 0 ? `${km.toFixed(1)} km` : '—'}
            </div>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid var(--subtle-border)', borderRight: '1px solid var(--subtle-border)' }}>
            <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Recorrido
            </div>
            <div className="text-[11.5px] font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {hasReturn ? 'Ida ⇄ Reg.' : 'Lineal →'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Tarifa
            </div>
            <div className="text-[11.5px] font-bold tabular-nums mt-0.5" style={{ color: '#F59E0B' }}>
              $3.700 / $3.8k
            </div>
          </div>
        </div>

        {/* Horarios */}
        <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--subtle-border)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} color="#F59E0B" />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Horarios y frecuencias
            </span>
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
          style={{ borderTop: '1px solid var(--subtle-border)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Medios de pago
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {(route.metodosPago?.length ? route.metodosPago : ['Efectivo']).map((m) => (
              <span
                key={m}
                className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                style={{
                  background: 'var(--subtle-bg)',
                  border: '1px solid var(--subtle-border)',
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
          <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--subtle-border)' }}>
            {stops.length > 0 ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-1 rounded-lg"
                    style={{
                      background: 'rgba(16,185,129,0.1)',
                      color: '#10B981',
                      border: '1px solid rgba(16,185,129,0.25)',
                    }}
                  >
                    <MapPin size={11} />
                    <span className="tabular-nums">{stops.length} paradas nombradas</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowStopsList((v) => !v)}
                    className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-lg cursor-pointer"
                    style={{
                      background: 'var(--subtle-bg)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--subtle-border)',
                    }}
                  >
                    <span>{showStopsList ? 'Ocultar lista' : 'Ver paradas'}</span>
                    <ChevronDown
                      size={12}
                      style={{
                        transform: showStopsList ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
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
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md cursor-pointer"
                            style={{
                              background: stopDirFilter === d.id ? `${routeColor}20` : 'var(--subtle-bg)',
                              color: stopDirFilter === d.id ? routeColor : 'var(--text-muted)',
                              border: `1px solid ${stopDirFilter === d.id ? `${routeColor}45` : 'var(--subtle-border)'}`,
                            }}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div
                      className="max-h-44 overflow-y-auto space-y-1 pr-1 rounded-xl p-1.5"
                      style={{ background: 'var(--subtle-bg)', border: '1px solid var(--subtle-border)' }}
                    >
                      {filteredStops.map((stop, idx) => {
                        const isReg = stop.sentido === 'regreso';
                        return (
                          <button
                            key={`${stop.sentido}-${stop.orden}-${idx}`}
                            type="button"
                            onClick={() => onFocusStop?.(stop)}
                            className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
                            style={{
                              background: 'transparent',
                              border: 'none',
                            }}
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
                              style={{ background: isReg ? '#EF4444' : '#10B981' }}
                            />
                            <span
                              className="text-[10px] font-bold tabular-nums flex-shrink-0"
                              style={{ color: 'var(--text-muted)', minWidth: 20 }}
                            >
                              #{stop.orden || idx + 1}
                            </span>
                            <span
                              className="text-[11px] flex-1 truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
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
              <div className="inline-flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={11} className="animate-spin" color="#06B6D4" />
                <span>Cargando paradas en el mapa...</span>
              </div>
            )}
          </div>
        )}

        {/* Zonas / Barrios */}
        {zones.length > 0 && (
          <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--subtle-border)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Zonas cubiertas
            </div>
            <div className="flex flex-wrap gap-1">
              {visibleZones.map((zone, i) => (
                <span
                  key={`${zone}-${i}`}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--subtle-bg)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--subtle-border)',
                  }}
                >
                  {zone}
                </span>
              ))}
              {zones.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllZones((v) => !v)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer"
                  style={{
                    background: `${routeColor}16`,
                    color: routeColor,
                    border: `1px solid ${routeColor}35`,
                  }}
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

  // Compute affected route IDs from active reports
  const affectedRouteIds = useMemo(
    () => new Set(activeReports.map((r) => r.routeId).filter(Boolean)),
    [activeReports]
  );

  // Favorites system (persisted in localStorage)
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

  // Auto-switch to navigation tab if user clicks map context menu
  useEffect(() => {
    if (onSetOriginFromMap || onSetDestinationFromMap) {
      setActiveTab('navigate');
    }
  }, [onSetOriginFromMap, onSetDestinationFromMap]);

  // Base routes visible according to layer toggles
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

  // Filter routes by system/intermunicipal filter, company, and search text
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
        top: 58,
        left: 0,
        bottom: 0,
        zIndex: 1050,
        width: '88vw',
        maxWidth: '22.5rem',
        overflow: 'hidden',
        transition: 'transform 0.3s ease-out',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        borderRight: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
      }}
    >
      <div className="h-full flex flex-col">
        {/* Tabs — Mobile-first segmented control */}
        <div
          style={{
            padding: '10px 10px 0',
            borderBottom: '1px solid var(--subtle-border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              borderRadius: 14,
              background: 'var(--subtle-bg)',
              border: '1px solid var(--subtle-border)',
            }}
          >
            {[
              { id: 'navigate', icon: Navigation, label: 'Navegar', color: '#06B6D4' },
              { id: 'routes', icon: Route, label: 'Rutas', color: '#10B981' },
              { id: 'favorites', icon: Star, label: 'Favoritos', color: '#F59E0B' },
              { id: 'capture', icon: Zap, label: 'Capturar', color: '#EC4899' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '10px 4px 8px',
                  borderRadius: 11,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  background:
                    activeTab === tab.id
                      ? `linear-gradient(135deg, ${tab.color}18, ${tab.color}08)`
                      : 'transparent',
                  boxShadow:
                    activeTab === tab.id
                      ? `0 2px 12px ${tab.color}15, inset 0 0 0 1px ${tab.color}25`
                      : 'none',
                }}
                id={`tab-${tab.id}`}
              >
                <tab.icon
                  size={activeTab === tab.id ? 17 : 15}
                  color={activeTab === tab.id ? tab.color : 'var(--text-secondary)'}
                  style={{ transition: 'all 0.2s', flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    color: activeTab === tab.id ? tab.color : 'var(--text-secondary)',
                    letterSpacing: activeTab === tab.id ? '0.02em' : '0',
                    transition: 'all 0.2s',
                    lineHeight: 1,
                  }}
                >
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 3,
                      width: 14,
                      height: 2,
                      borderRadius: 2,
                      background: tab.color,
                      boxShadow: `0 0 8px ${tab.color}80`,
                    }}
                  />
                )}
              </button>
            ))}
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
              {/* Catalog summary + Search + Filters */}
              <div style={{ padding: '12px 14px 12px', borderBottom: '1px solid var(--subtle-border)' }}>
                {/* Live summary bar */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{ color: 'var(--text-primary)' }}
                    >
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
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full cursor-pointer"
                      style={{
                        background: 'rgba(245,158,11,0.12)',
                        color: '#F59E0B',
                        border: '1px solid rgba(245,158,11,0.3)',
                      }}
                    >
                      <RotateCcw size={10} />
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Quick search input */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 11px',
                    borderRadius: 13,
                    marginBottom: 10,
                    background: 'var(--subtle-bg)',
                    border: '1px solid var(--subtle-border-strong)',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Buscar ruta, código, empresa o zona..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: 'var(--text-primary)', fontSize: 12, minWidth: 0 }}
                  />
                  {searchText && (
                    <button
                      type="button"
                      onClick={() => setSearchText('')}
                      aria-label="Borrar búsqueda"
                      style={{
                        background: 'var(--subtle-bg-hover)',
                        border: 'none',
                        borderRadius: '50%',
                        width: 18,
                        height: 18,
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

                {/* System / type filter pills with dynamic counts */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[
                    { value: 'all', label: 'Todas', count: systemCounts.all, accent: '#06B6D4' },
                    { value: 'masivo', label: 'Transmetro', count: systemCounts.masivo, accent: '#0EA5E9' },
                    { value: 'urbano', label: 'Urbano', count: systemCounts.urbano, accent: '#10B981' },
                    { value: 'intermunicipal', label: 'Intermunic.', count: systemCounts.intermunicipal, accent: '#F59E0B' },
                  ].map((opt) => {
                    const isActive = filterType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFilterType(opt.value)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 9px',
                          borderRadius: 999,
                          fontSize: 10.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.18s',
                          border: `1px solid ${isActive ? `${opt.accent}55` : 'var(--subtle-border)'}`,
                          background: isActive ? `${opt.accent}18` : 'var(--subtle-bg)',
                          color: isActive ? opt.accent : 'var(--text-secondary)',
                        }}
                      >
                        <span>{opt.label}</span>
                        <span
                          className="tabular-nums text-[9.5px] opacity-80"
                          style={{ fontWeight: 700 }}
                        >
                          {opt.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Company filter select (theme-aware) */}
                {companies.length > 1 && (
                  <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    aria-label="Filtrar por empresa operadora"
                    style={{
                      width: '100%',
                      padding: '8px 11px',
                      borderRadius: 11,
                      fontSize: 11.5,
                      fontWeight: 500,
                      outline: 'none',
                      marginBottom: 9,
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--subtle-border-strong)',
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

                {/* Layer visibility toggles */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onToggleLayer?.('official')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '7px 10px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: layerVisibility?.official ? 'rgba(16,185,129,0.1)' : 'var(--subtle-bg)',
                      color: layerVisibility?.official ? '#10B981' : 'var(--text-secondary)',
                      border: `1px solid ${layerVisibility?.official ? 'rgba(16,185,129,0.28)' : 'var(--subtle-border)'}`,
                    }}
                  >
                    {layerVisibility?.official ? <Eye size={12} /> : <EyeOff size={12} />}
                    Oficiales
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleLayer?.('community')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '7px 10px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: layerVisibility?.community ? 'rgba(139,92,246,0.1)' : 'var(--subtle-bg)',
                      color: layerVisibility?.community ? '#A78BFA' : 'var(--text-secondary)',
                      border: `1px solid ${layerVisibility?.community ? 'rgba(139,92,246,0.28)' : 'var(--subtle-border)'}`,
                    }}
                  >
                    {layerVisibility?.community ? <Eye size={12} /> : <EyeOff size={12} />}
                    Comunidad
                  </button>
                </div>
              </div>

              {/* Selected Route Ficha */}
              {selectedRoute && (
                <SelectedRouteFicha
                  key={selectedRoute._id}
                  route={selectedRoute}
                  isLoading={loadingRouteId === selectedRoute._id}
                  onClose={() => onClearSelectedRoute?.()}
                  onFocusStop={onFocusStop}
                />
              )}

              {/* Route list grouped by company */}
              <div className="p-2.5 space-y-1.5">
                {groupedOperators.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Bus size={32} style={{ color: 'var(--text-muted)', margin: '0 auto', opacity: 0.5 }} />
                    <p className="text-xs font-medium mt-2" style={{ color: 'var(--text-secondary)' }}>
                      No se encontraron rutas con ese filtro
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                        style={{
                          background: 'var(--subtle-bg)',
                          color: 'var(--accent-cyan)',
                          border: '1px solid var(--subtle-border-strong)',
                        }}
                      >
                        Restablecer filtros
                      </button>
                    )}
                  </div>
                ) : (
                  groupedOperators.map(([operador, operadorRoutes]) => {
                    const opColor = safeColor(operadorRoutes[0]?.color, '#06B6D4');
                    const isExpanded = forceExpandAll || expandedCompany === operador;
                    const isTransmetro = operador === 'Transmetro';

                    return (
                      <div key={operador}>
                        {/* Operador header accordion */}
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
                              height: 22,
                              borderRadius: 4,
                              background: opColor,
                              boxShadow: `0 0 8px ${opColor}55`,
                              flexShrink: 0,
                            }}
                          />
                          <div className="flex-1 min-w-0 text-left flex items-center gap-1.5">
                            <span
                              className="text-[12.5px] font-bold truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {operador}
                            </span>
                            {isTransmetro && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider flex-shrink-0"
                                style={{
                                  background: 'rgba(14,165,233,0.16)',
                                  color: '#0EA5E9',
                                  border: '1px solid rgba(14,165,233,0.35)',
                                }}
                              >
                                BRT
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[10.5px] px-2 py-0.5 rounded-full font-semibold tabular-nums flex-shrink-0"
                            style={{
                              background: isExpanded ? `${opColor}1A` : 'var(--subtle-bg)',
                              color: isExpanded ? opColor : 'var(--text-secondary)',
                              border: `1px solid ${isExpanded ? `${opColor}38` : 'var(--subtle-border)'}`,
                            }}
                          >
                            {operadorRoutes.length}
                          </span>
                          <ChevronRight
                            size={14}
                            style={{
                              color: 'var(--text-muted)',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                              flexShrink: 0,
                            }}
                          />
                        </button>

                        {/* Operador routes */}
                        {isExpanded && (
                          <div className="pl-2.5 pr-0.5 space-y-1.5 mt-1.5 mb-2 animate-fade-in">
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
                    <div className="text-center py-12">
                      <Star size={36} style={{ color: 'var(--text-muted)', margin: '0 auto', opacity: 0.3 }} />
                      <p className="text-sm mt-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Sin favoritos aún
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: 'var(--text-muted)', maxWidth: 230, margin: '4px auto 0' }}
                      >
                        Toca la ⭐ en cualquier ruta para guardarla aquí y acceder rápido.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-1.5">
                    <p
                      className="text-[10.5px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ⭐ {favRoutes.length} ruta{favRoutes.length > 1 ? 's' : ''} favorita
                      {favRoutes.length > 1 ? 's' : ''}
                    </p>
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
            <div className="animate-fade-in" style={{ padding: '16px 14px' }}>
              {/* Hero section */}
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px 16px 16px',
                  borderRadius: 16,
                  marginBottom: 14,
                  background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(139,92,246,0.06))',
                  border: '1px solid rgba(236,72,153,0.12)',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    margin: '0 auto 10px',
                    background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(245,158,11,0.15))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(236,72,153,0.15)',
                  }}
                >
                  <Bus size={22} color="#EC4899" />
                </div>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: '0 0 4px',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  Capturar Ruta GPS
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Sube a un bus y contribuye la ruta para toda la comunidad 🚌
                </p>
              </div>

              {/* GPS status card */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  marginBottom: 12,
                  background: 'var(--subtle-bg)',
                  border: `1px solid ${isCapturing ? 'rgba(239,68,68,0.2)' : 'var(--subtle-border)'}`,
                  transition: 'border-color 0.3s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    className={`gps-dot ${isCapturing ? 'recording' : 'inactive'}`}
                    style={{ width: 10, height: 10, flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isCapturing ? '#F87171' : '#64748B',
                    }}
                  >
                    {isCapturing ? '● Grabando ruta...' : 'GPS listo para capturar'}
                  </span>
                </div>

                {/* Feature list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { icon: '⏱️', text: 'Captura automática cada 5 segundos' },
                    { icon: '🎯', text: 'Filtro de precisión: ≤ 20 metros' },
                    { icon: '🤝', text: 'Se fusiona con capturas de otros usuarios' },
                  ].map((f, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span style={{ fontSize: 12, lineHeight: 1 }}>{f.icon}</span>
                      {f.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Capture button — large mobile-friendly */}
              <button
                onClick={() => onStartCapture?.()}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: '#fff',
                  transition: 'all 0.3s',
                  background: isCapturing
                    ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                    : 'linear-gradient(135deg, #EC4899, #8B5CF6)',
                  boxShadow: isCapturing
                    ? '0 4px 20px rgba(239,68,68,0.3)'
                    : '0 4px 20px rgba(236,72,153,0.25)',
                }}
                id="capture-btn"
              >
                {isCapturing ? <Navigation size={18} /> : <Zap size={18} />}
                {isCapturing ? 'Detener captura' : 'Iniciar captura'}
              </button>

              {!isAuthenticated && (
                <p
                  style={{
                    fontSize: 10,
                    color: '#F59E0B',
                    textAlign: 'center',
                    marginTop: 10,
                    background: 'rgba(245,158,11,0.06)',
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(245,158,11,0.1)',
                  }}
                >
                  ⚠️ Debes iniciar sesión para capturar rutas
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer: Premium upsell */}
        {isAuthenticated && !isPremium && (
          <div className="p-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={handleUpgrade}
              className="w-full p-3 rounded-xl flex items-center gap-3 transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1))',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              id="upgrade-btn"
            >
              <Crown size={20} style={{ color: '#FBBF24' }} />
              <div className="text-left">
                <p className="text-xs font-semibold" style={{ color: '#FBBF24' }}>
                  Quilla-Pass Premium
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Sin publicidad • Descarga offline
                </p>
              </div>
            </button>
            {showPremiumInfo && (
              <div
                className="animate-fade-in mt-2 p-2.5 rounded-xl text-[11px] leading-relaxed"
                style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  color: 'var(--text-secondary)',
                }}
              >
                Activa Quilla-Pass contactando al equipo en{' '}
                <strong style={{ color: '#FBBF24' }}>@ruta.quilla</strong>. Si alcanzas{' '}
                <strong style={{ color: '#FBBF24' }}>500 XP (Quilla Builder)</strong> obtienes 30% de descuento.
              </div>
            )}
          </div>
        )}

        {isPremium && (
          <div className="p-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={handleDownloadOffline}
              disabled={downloadingOffline}
              className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"
              id="download-offline-btn"
            >
              <Download size={14} /> {downloadingOffline ? 'Descargando...' : 'Descargar mapa offline'}
            </button>
            {offlineError && (
              <p className="text-[10px] mt-1.5 text-center" style={{ color: '#EF4444' }}>
                {offlineError}
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
