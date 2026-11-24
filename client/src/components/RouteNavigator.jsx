/**
 * ============================================
 * RutaQuilla - RouteNavigator v2 (Premium UI)
 * ============================================
 * Panel de navegación recomendado con:
 * - Inputs flotantes inmersivos
 * - Sugerencias tipo Google Maps
 * - Resultados con tarjetas animadas
 * - Indicadores de tiempo + distancia visuales
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Navigation, Search, Clock, Footprints,
  Bus, Star, Crosshair, X,
  Loader2, MapPin, ChevronDown, ChevronUp,
  ArrowUpDown
} from 'lucide-react';
import { searchPlaces, reverseGeocode } from '../services/routingService';
import { getCurrentPosition } from '../services/gpsService';
import { useToast } from '../context/ToastContext';

/* ---- Utility ---- */
function InputRow({ id, color, placeholder, value, onChange, onFocus, onBlur, rightSlot, focused }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 10px',
        borderRadius: 16,
        background: focused ? `${color}08` : 'var(--subtle-bg)',
        border: `1.5px solid ${focused ? color + '80' : 'var(--subtle-border)'}`,
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: focused ? `0 0 0 4px ${color}14` : 'none',
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: color, boxShadow: `0 0 8px ${color}80` }} />
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none"
        style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', minWidth: 0 }}
        autoComplete="off"
      />
      {rightSlot}
    </div>
  );
}

function SuggestionDropdown({ items, onSelect, accentColor }) {
  if (!items.length) return null;
  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
        zIndex: 200, borderRadius: 14, overflow: 'hidden',
        background: 'var(--dropdown-bg)',
        border: '1px solid var(--subtle-border-strong)',
        boxShadow: '0 16px 40px var(--shadow-color)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {items.map((s, i) => {
        const primary = s.displayName?.split(',')[0] || s.displayName;
        const secondary = s.subtitle || s.displayName?.split(',').slice(1, 3).join(',').trim();
        return (
          <button
            key={i}
            onMouseDown={() => onSelect(s)}
            style={{
              width: '100%', background: 'none', border: 'none',
              borderBottom: i < items.length - 1 ? '1px solid var(--subtle-border)' : 'none',
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', transition: 'background 0.15s',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--subtle-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <MapPin size={13} style={{ color: accentColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {primary}
                </p>
                {s.source === 'local' && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '1px 5px', borderRadius: 5, flexShrink: 0,
                    background: 'rgba(245,158,11,0.14)', color: '#F59E0B',
                    border: '1px solid rgba(245,158,11,0.28)',
                  }}>
                    BQ
                  </span>
                )}
              </div>
              {secondary && (
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {secondary}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function RouteNavigator({
  onNavigate, onClear, navigationResult, isNavigating,
  onSetOriginFromMap, onSetDestinationFromMap,
  pinMode, onPinModeChange,
  selectedOptionIdx = 0,
  onSelectOptionIdx,
  onPreviewOriginChange,
  onPreviewDestinationChange,
}) {
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);

  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [showOriginSugg, setShowOriginSugg] = useState(false);
  const [showDestSugg, setShowDestSugg] = useState(false);

  const [originFocused, setOriginFocused] = useState(false);
  const [destFocused, setDestFocused] = useState(false);

  const [expandedOption, setExpandedOption] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const toast = useToast();

  // Search history (persisted in localStorage)
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rutaquilla_search_history') || '[]');
    } catch { return []; }
  });

  const saveToHistory = useCallback((place) => {
    if (!place?.displayName) return;
    setSearchHistory(prev => {
      // Remove duplicates, add to front, keep max 5
      const filtered = prev.filter(p => p.displayName !== place.displayName);
      const next = [place, ...filtered].slice(0, 5);
      localStorage.setItem('rutaquilla_search_history', JSON.stringify(next));
      return next;
    });
  }, []);

  const timerRef = useRef(null);

  const debouncedSearch = useCallback((query, setter, showSetter) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.length < 2) { setter([]); showSetter(false); return; }
    timerRef.current = setTimeout(async () => {
      const results = await searchPlaces(query);
      setter(results);
      showSetter(results.length > 0);
    }, 350);
  }, []);

  const handleOriginInput = v => {
    setOriginText(v); setOrigin(null);
    if (v.length < 2 && searchHistory.length > 0) {
      setOriginSuggestions(searchHistory);
      setShowOriginSugg(true);
    } else {
      debouncedSearch(v, setOriginSuggestions, setShowOriginSugg);
    }
  };
  const handleDestInput = v => {
    setDestText(v); setDestination(null);
    if (v.length < 2 && searchHistory.length > 0) {
      setDestSuggestions(searchHistory);
      setShowDestSugg(true);
    } else {
      debouncedSearch(v, setDestSuggestions, setShowDestSugg);
    }
  };

  const selectOrigin = s => {
    setOriginText(s.displayName); setOrigin({ lat: s.lat, lng: s.lng });
    setShowOriginSugg(false); saveToHistory(s);
    onPreviewOriginChange?.({ lat: s.lat, lng: s.lng });
  };
  const selectDest = s => {
    setDestText(s.displayName); setDestination({ lat: s.lat, lng: s.lng });
    setShowDestSugg(false); saveToHistory(s);
    onPreviewDestinationChange?.({ lat: s.lat, lng: s.lng });
  };

  const handleGPS = async () => {
    try {
      setGpsLoading(true);
      const pos = await getCurrentPosition();
      setOrigin({ lat: pos.lat, lng: pos.lng });
      onPreviewOriginChange?.({ lat: pos.lat, lng: pos.lng });
      const name = await reverseGeocode(pos.lat, pos.lng);
      setOriginText(`📍 ${name}`);
    } catch {
      toast.error('No se pudo obtener tu ubicación. Verifica permisos del navegador.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSwap = () => {
    if (!originText && !destText && !origin && !destination) return;
    const prevOrig = origin;
    const prevDest = destination;
    const prevOrigText = originText;
    const prevDestText = destText;
    setOrigin(prevDest);
    setDestination(prevOrig);
    setOriginText(prevDestText);
    setDestText(prevOrigText);
    onPreviewOriginChange?.(prevDest);
    onPreviewDestinationChange?.(prevOrig);
  };

  useEffect(() => {
    if (onSetOriginFromMap?.lat) {
      setOrigin(onSetOriginFromMap);
      onPreviewOriginChange?.(onSetOriginFromMap);
      reverseGeocode(onSetOriginFromMap.lat, onSetOriginFromMap.lng).then(n => setOriginText(`📌 ${n}`));
    }
  }, [onSetOriginFromMap]);

  useEffect(() => {
    if (onSetDestinationFromMap?.lat) {
      setDestination(onSetDestinationFromMap);
      onPreviewDestinationChange?.(onSetDestinationFromMap);
      reverseGeocode(onSetDestinationFromMap.lat, onSetDestinationFromMap.lng).then(n => setDestText(`📌 ${n}`));
    }
  }, [onSetDestinationFromMap]);

  const handleSearch = () => {
    if (!origin || !destination) return;
    onNavigate?.(origin, destination);
    onSelectOptionIdx?.(0);
    setExpandedOption(0);
  };

  const handleClear = () => {
    setOriginText(''); setDestText('');
    setOrigin(null); setDestination(null);
    setExpandedOption(null);
    onSelectOptionIdx?.(0);
    onPreviewOriginChange?.(null);
    onPreviewDestinationChange?.(null);
    onClear?.();
  };

  const options = navigationResult?.options || [];
  const canSearch = origin && destination && !isNavigating;

  return (
    <div className="animate-fade-in" style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ---- Origin + Dest inputs ---- */}
      <div style={{
        background: 'var(--subtle-bg)',
        border: '1px solid var(--subtle-border)',
        borderRadius: 20, padding: '12px 12px 10px',
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          🧭 Planifica tu viaje
        </p>

        {/* ORIGEN */}
        <div style={{ position: 'relative' }}>
          <InputRow
            id="origin-input"
            color="#10B981"
            placeholder="¿Desde dónde sales?"
            value={originText}
            onChange={e => handleOriginInput(e.target.value)}
            onFocus={() => {
              setOriginFocused(true);
              if (originSuggestions.length) setShowOriginSugg(true);
              else if (!originText && searchHistory.length > 0) {
                setOriginSuggestions(searchHistory);
                setShowOriginSugg(true);
              }
            }}
            onBlur={() => { setOriginFocused(false); setTimeout(() => setShowOriginSugg(false), 200); }}
            focused={originFocused}
            rightSlot={
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {/* GPS button */}
                <button
                  onClick={handleGPS}
                  disabled={gpsLoading}
                  title="Usar mi ubicación GPS"
                  style={{
                    width: 26, height: 26, borderRadius: 7, border: 'none',
                    background: 'rgba(59,130,246,0.12)', color: '#60A5FA',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.22)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; }}
                >
                  {gpsLoading ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
                </button>
                {/* Pin button */}
                <button
                  onClick={() => onPinModeChange?.(pinMode === 'origin' ? null : 'origin')}
                  title="Marcar en el mapa"
                  style={{
                    width: 26, height: 26, borderRadius: 7, border: 'none',
                    background: pinMode === 'origin' ? 'rgba(16,185,129,0.2)' : 'var(--subtle-bg)',
                    color: pinMode === 'origin' ? '#10B981' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  <MapPin size={13} />
                </button>
              </div>
            }
          />
          {showOriginSugg && <SuggestionDropdown items={originSuggestions} onSelect={selectOrigin} accentColor="#10B981" />}
        </div>

        {/* Connector line + Swap button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 4px 9px', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 1, height: 14, background: 'var(--subtle-border-strong)', borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>en bus hasta</span>
          </div>
          <button
            type="button"
            onClick={handleSwap}
            title="Intercambiar origen y destino"
            aria-label="Intercambiar origen y destino"
            style={{
              width: 24, height: 24, borderRadius: 7,
              border: '1px solid var(--subtle-border)',
              background: 'var(--subtle-bg)',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F59E0B'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--subtle-border)'; }}
          >
            <ArrowUpDown size={12} />
          </button>
        </div>

        {/* DESTINO */}
        <div style={{ position: 'relative' }}>
          <InputRow
            id="destination-input"
            color="#EF4444"
            placeholder="Ej: C.C. Único, Portal del Prado..."
            value={destText}
            onChange={e => handleDestInput(e.target.value)}
            onFocus={() => {
              setDestFocused(true);
              if (destSuggestions.length) setShowDestSugg(true);
              else if (!destText && searchHistory.length > 0) {
                setDestSuggestions(searchHistory);
                setShowDestSugg(true);
              }
            }}
            onBlur={() => { setDestFocused(false); setTimeout(() => setShowDestSugg(false), 200); }}
            focused={destFocused}
            rightSlot={
              <button
                onClick={() => onPinModeChange?.(pinMode === 'destination' ? null : 'destination')}
                title="Marcar en el mapa"
                  style={{
                    width: 26, height: 26, borderRadius: 7, border: 'none',
                    background: pinMode === 'destination' ? 'rgba(239,68,68,0.2)' : 'var(--subtle-bg)',
                  color: pinMode === 'destination' ? '#EF4444' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                }}
              >
                <MapPin size={13} />
              </button>
            }
          />
          {showDestSugg && <SuggestionDropdown items={destSuggestions} onSelect={selectDest} accentColor="#EF4444" />}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button
            onClick={handleSearch}
            disabled={!canSearch}
            id="navigate-btn"
            style={{
              flex: 1, padding: '11px 0', borderRadius: 13, border: 'none',
              background: canSearch
                ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                : 'var(--subtle-bg)',
              color: canSearch ? '#000' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 700,
              cursor: canSearch ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: canSearch ? '0 4px 16px rgba(245,158,11,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (canSearch) e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.45)'; }}
            onMouseLeave={e => { if (canSearch) e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,158,11,0.3)'; }}
          >
            {isNavigating
              ? <><Loader2 size={14} className="animate-spin" /> Buscando...</>
              : <><Search size={14} /> Buscar ruta</>
            }
          </button>

          {(navigationResult || originText || destText) && (
            <button
              onClick={handleClear}
              title="Limpiar"
              style={{
                padding: '11px 13px', borderRadius: 13, border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(239,68,68,0.08)', color: '#F87171',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Pin mode indicator */}
        {pinMode && (
          <div className="animate-fade-in" style={{
            marginTop: 8, padding: '7px 12px', borderRadius: 10,
            background: pinMode === 'origin' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
            border: `1px solid ${pinMode === 'origin' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Crosshair size={11} style={{ color: pinMode === 'origin' ? '#34D399' : '#F87171' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Toca el mapa para marcar {pinMode === 'origin' ? 'el origen' : 'el destino'}
            </span>
          </div>
        )}
      </div>

      {/* ---- Route options results ---- */}
      {navigationResult && (
        <div className="animate-fade-in">
          {options.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
                background: 'var(--subtle-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bus size={24} color="#334155" />
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Sin rutas para este trayecto</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Prueba con diferentes puntos</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, paddingLeft: 2 }}>
                {options.length} opción{options.length > 1 ? 'es' : ''} encontrada{options.length > 1 ? 's' : ''}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {options.map((opt, idx) => {
                  const isSelected = selectedOptionIdx === idx;
                  const isExpanded = expandedOption === idx;
                  return (
                    <button
                      key={idx}
                      id={`route-option-${idx}`}
                      onClick={() => {
                        onSelectOptionIdx?.(idx);
                        setExpandedOption(isExpanded ? null : idx);
                      }}
                      style={{
                        width: '100%', background: 'none', border: 'none',
                        padding: 0, cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        borderRadius: 18, overflow: 'hidden',
                        background: isSelected ? 'var(--subtle-bg)' : 'var(--subtle-bg)',
                        border: `1.5px solid ${isSelected ? opt.route.color + '50' : 'var(--subtle-border)'}`,
                        boxShadow: isSelected ? `0 4px 20px ${opt.route.color}18` : 'none',
                        transition: 'all 0.25s',
                      }}>
                        {/* Colored top bar */}
                        <div style={{
                          height: 3,
                          background: isSelected
                            ? `linear-gradient(90deg, ${opt.route.color}, ${opt.route.color}80)`
                            : 'transparent',
                          transition: 'all 0.3s',
                        }} />

                        <div style={{ padding: '12px 14px' }}>
                          {/* Badges row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: (opt.isOptimal || opt.isTransfer) ? 8 : 0 }}>
                            {opt.isOptimal && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 9px', borderRadius: 20,
                                background: 'rgba(251,191,36,0.12)',
                                border: '1px solid rgba(251,191,36,0.28)',
                              }}>
                                <Star size={9} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                  Ruta óptima
                                </span>
                              </div>
                            )}
                            {opt.isTransfer && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 9px', borderRadius: 20,
                                background: 'rgba(139,92,246,0.12)',
                                border: '1px solid rgba(139,92,246,0.28)',
                              }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                  1 transbordo
                                </span>
                              </div>
                            )}
                            {opt.transfer?.sistemasNoIntegrados && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 8px', borderRadius: 20,
                                background: 'rgba(245,158,11,0.1)',
                                border: '1px solid rgba(245,158,11,0.28)',
                              }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B' }}>
                                  Doble pasaje (Transmetro + Urbano)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Route name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                              background: `${opt.route.color}18`,
                              border: `1px solid ${opt.route.color}40`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Bus size={15} style={{ color: opt.route.color }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                {opt.route.codigo && (
                                  <span className="transit-code">{opt.route.codigo}</span>
                                )}
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                                  {opt.isTransfer && opt.transfer?.secondRoute
                                    ? `${opt.route.name || opt.route.nombre} → ${opt.transfer.secondRoute.codigo ? `[${opt.transfer.secondRoute.codigo}] ` : ''}${opt.transfer.secondRoute.name}`
                                    : (opt.route.name || opt.route.nombre)}
                                </p>
                              </div>
                              <p style={{ fontSize: 10, color: opt.route.color, margin: 0, marginTop: 1 }}>
                                {opt.isTransfer && opt.transfer?.secondRoute
                                  ? `${opt.route.company || opt.route.operador} + ${opt.transfer.secondRoute.company}`
                                  : (opt.route.company || opt.route.operador)}
                              </p>
                            </div>
                            {/* Direction pill */}
                            <div style={{
                              padding: '3px 8px', borderRadius: 8,
                              background: opt.direction === 'ida' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                              border: `1px solid ${opt.direction === 'ida' ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.25)'}`,
                            }}>
                              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: opt.direction === 'ida' ? '#10B981' : '#8B5CF6' }}>
                                {opt.direction === 'ida' ? 'IDA' : 'VUELTA'}
                              </span>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isExpanded ? 12 : 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: 7,
                                background: 'rgba(245,158,11,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Clock size={12} color="#F59E0B" />
                              </div>
                              <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: '#F59E0B' }}>~{opt.totalMinutes}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>min</span>
                            </div>
                            <div style={{ width: 1, height: 16, background: 'var(--subtle-border)' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Footprints size={12} color="#60A5FA" />
                              <span className="tabular-nums" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opt.totalWalkMinutes} min a pie</span>
                            </div>
                            <div className="tabular-nums" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>
                              ${opt.route.fare?.toLocaleString()}
                            </div>
                          </div>

                          {/* Expanded vertical transit timeline */}
                          {isExpanded && (
                            <div className="animate-fade-in" style={{
                              paddingTop: 12, borderTop: '1px solid var(--subtle-border)',
                              display: 'flex', flexDirection: 'column',
                            }}>
                              {[
                                {
                                  icon: <Footprints size={12} />, color: '#60A5FA',
                                  label: `Caminar ${opt.boardPoint.walkDistance}m (~${opt.boardPoint.walkMinutes} min)`,
                                  sub: 'Hasta donde pasa el primer bus',
                                },
                                {
                                  icon: <Bus size={12} />, color: opt.route.color,
                                  label: `${opt.route.nombre || opt.route.name} (~${opt.isTransfer && opt.transfer ? Math.max(1, opt.busMinutes - opt.transfer.secondBusMinutes) : opt.busMinutes} min)`,
                                  sub: opt.isTransfer ? 'Primer tramo en bus' : 'En bus',
                                },
                                ...(opt.isTransfer && opt.transfer ? [
                                  {
                                    icon: <Footprints size={12} />, color: '#A78BFA',
                                    label: `Transbordo: caminar ${opt.transfer.walkDistance}m (~${opt.transfer.walkMinutes} min)`,
                                    sub: `Conecta con ${opt.transfer.secondRoute.name}`,
                                  },
                                  {
                                    icon: <Bus size={12} />, color: opt.transfer.secondRoute.color || '#8B5CF6',
                                    label: `${opt.transfer.secondRoute.name} (~${opt.transfer.secondBusMinutes} min)`,
                                    sub: `Segundo tramo (${opt.transfer.secondRoute.company})`,
                                  },
                                ] : []),
                                {
                                  icon: <MapPin size={12} />, color: '#EF4444',
                                  label: opt.alightPoint.walkDistance < 50
                                    ? 'El bus pasa frente a tu destino 🎯'
                                    : `Caminar ${opt.alightPoint.walkDistance}m al destino`,
                                  sub: opt.alightPoint.walkDistance < 50 ? 'Bájate ahí mismo' : `~${opt.alightPoint.walkMinutes} min`,
                                },
                              ].map((step, i, arr) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                                      background: `${step.color}16`,
                                      border: `1px solid ${step.color}40`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: step.color,
                                    }}>
                                      {step.icon}
                                    </div>
                                    {i < arr.length - 1 && (
                                      <div style={{ width: 2, flex: 1, minHeight: 12, margin: '2px 0', background: 'var(--subtle-border-strong)', borderRadius: 1 }} />
                                    )}
                                  </div>
                                  <div style={{ paddingBottom: i < arr.length - 1 ? 10 : 2 }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: step.color, margin: 0 }}>{step.label}</p>
                                    <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, marginTop: 1 }}>{step.sub}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Expand/collapse */}
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: isExpanded ? 10 : 0, paddingTop: isExpanded ? 8 : 0, borderTop: isExpanded ? '1px solid var(--subtle-border)' : 'none' }}>
                            {isExpanded
                              ? <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} />
                              : <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Empty state ---- */}
      {!navigationResult && (
        <div style={{
          borderRadius: 18,
          background: 'var(--subtle-bg)',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '20px 16px',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 16, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(6,182,212,0.12))',
            border: '1px solid rgba(245,158,11,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Navigation size={22} color="#F59E0B" />
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            ¿A dónde quieres ir?
          </p>
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
            Ingresa tus puntos para encontrar las mejores rutas de bus en Barranquilla.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { icon: <Crosshair size={11} />, color: '#34D399', text: 'Usa GPS para detectar tu ubicación' },
              { icon: <Search size={11} />, color: '#60A5FA', text: 'Busca por nombre (ej: C.C. Único, Prado)' },
              { icon: <MapPin size={11} />, color: '#F87171', text: '🖱️ Click derecho o mantén presionado el mapa' },
            ].map((tip, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: `${i === 0 ? 'rgba(16,185,129' : i === 1 ? 'rgba(59,130,246' : 'rgba(239,68,68'},0.05)`,
                border: `1px solid ${i === 0 ? 'rgba(16,185,129' : i === 1 ? 'rgba(59,130,246' : 'rgba(239,68,68'},0.1)`,
              }}>
                <div style={{
                  color: tip.color,
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}>
                  {tip.icon}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tip.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
