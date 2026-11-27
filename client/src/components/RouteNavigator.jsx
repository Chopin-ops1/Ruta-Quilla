/**
 * ============================================
 * RutaQuilla - RouteNavigator v4 (Itinerario Urbano)
 * ============================================
 * Panel de planificación origen → destino con:
 * - Riel visual vertical Origen (Mangle) → Destino (Carnaval)
 * - Autocompletado local + Nominatim/Google proxy
 * - Chips rápidos de destinos clave de Barranquilla
 * - Tarjetas de resultado con tiempo protagonista en Geist Mono
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Navigation,
  Search,
  Clock,
  Footprints,
  Bus,
  Star,
  Crosshair,
  X,
  Loader2,
  MapPin,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Share2,
  Home,
  Briefcase,
} from 'lucide-react';
import { searchPlaces, reverseGeocode, isCoordinateString } from '../services/routingService';
import { getCurrentPosition } from '../services/gpsService';
import { useToast } from '../context/ToastContext';
import { shareRouteSummary } from '../utils/platform';
import { fxTap, fxSearchStart, fxRouteFound, fxPinDrop } from '../utils/soundAndHaptics';

const QUICK_DESTINATIONS = [
  { label: 'Portal del Prado', displayName: 'C.C. Portal del Prado', lat: 10.98954, lng: -74.78858 },
  { label: 'Buenavista', displayName: 'C.C. Buenavista', lat: 11.01315, lng: -74.82767 },
  { label: 'Uninorte', displayName: 'Universidad del Norte', lat: 11.01995, lng: -74.85080 },
  { label: 'Paseo Bolívar', displayName: 'Paseo Bolívar, Centro', lat: 10.98192, lng: -74.77780 },
  { label: 'Gran Malecón', displayName: 'Gran Malecón del Río', lat: 11.02155, lng: -74.79442 },
  { label: 'Estadio Metro', displayName: 'Estadio Metropolitano', lat: 10.92695, lng: -74.80051 },
];

const SAVED_PLACES_STORAGE_KEY = 'rutaquilla_saved_places_v1';

function loadSavedPlaces() {
  try {
    const raw = localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      home: parsed?.home && Number.isFinite(parsed.home.lat) ? parsed.home : null,
      work: parsed?.work && Number.isFinite(parsed.work.lat) ? parsed.work : null,
    };
  } catch {
    return { home: null, work: null };
  }
}

function InputRow({ id, placeholder, value, onChange, onFocus, onBlur, onKeyDown, rightSlot, focused }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 10px',
        borderRadius: 9,
        background: focused ? 'var(--bg-card)' : 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--brand)' : 'var(--border-color)'}`,
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
      }}
    >
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none rq-plain-input"
        style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          minWidth: 0,
        }}
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
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        right: 0,
        zIndex: 200,
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--dropdown-bg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
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
              width: '100%',
              background: 'none',
              border: 'none',
              borderBottom: i < items.length - 1 ? '1px solid var(--border-color)' : 'none',
              padding: '9px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              cursor: 'pointer',
              transition: 'background 0.12s',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--subtle-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <MapPin size={13} style={{ color: accentColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                    lineHeight: 1.35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {primary}
                </p>
                {s.source === 'local' && (
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      padding: '1px 5px',
                      borderRadius: 4,
                      flexShrink: 0,
                      background: 'var(--brand-soft)',
                      color: 'var(--brand)',
                    }}
                  >
                    BQ
                  </span>
                )}
              </div>
              {secondary && (
                <p
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    marginTop: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
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
  onNavigate,
  onClear,
  navigationResult,
  isNavigating,
  onSetOriginFromMap,
  onSetDestinationFromMap,
  pinMode,
  onPinModeChange,
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

  const [savedPlaces, setSavedPlaces] = useState(() => loadSavedPlaces());
  const [editingPlaceSlot, setEditingPlaceSlot] = useState(null); // 'home' | 'work' | null
  const [savingPlaceGPS, setSavingPlaceGPS] = useState(false);

  const persistSavedPlaces = (next) => {
    setSavedPlaces(next);
    try {
      localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Silencioso si almacenamiento restringido
    }
  };

  const handleSavePlaceFromDest = (slot) => {
    if (!destination) return;
    fxPinDrop();
    const shortName = String(destText || destination.displayName || '').split(',')[0].trim()
      || (slot === 'home' ? 'Casa' : 'Trabajo');
    persistSavedPlaces({
      ...savedPlaces,
      [slot]: {
        label: slot === 'home' ? 'Casa' : 'Trabajo',
        displayName: shortName,
        lat: destination.lat,
        lng: destination.lng,
      },
    });
    setEditingPlaceSlot(null);
  };

  const handleSavePlaceFromGPS = async (slot) => {
    setSavingPlaceGPS(true);
    try {
      const pos = await getCurrentPosition();
      let displayName = slot === 'home' ? 'Casa' : 'Trabajo';
      try {
        const rev = await reverseGeocode(pos.lat, pos.lng);
        if (rev?.displayName && !isCoordinateString(rev.displayName)) {
          displayName = String(rev.displayName).split(',')[0].trim() || displayName;
        }
      } catch {
        // Mantiene etiqueta amigable si falla geocodificación inversa
      }
      fxPinDrop();
      persistSavedPlaces({
        ...savedPlaces,
        [slot]: {
          label: slot === 'home' ? 'Casa' : 'Trabajo',
          displayName,
          lat: pos.lat,
          lng: pos.lng,
        },
      });
      setEditingPlaceSlot(null);
    } catch {
      // Ignorado si no hay permiso de ubicación
    } finally {
      setSavingPlaceGPS(false);
    }
  };

  const handleClearSavedPlace = (slot, e) => {
    e.stopPropagation();
    fxTap();
    persistSavedPlaces({
      ...savedPlaces,
      [slot]: null,
    });
  };

  const [expandedOption, setExpandedOption] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [resolvingSearch, setResolvingSearch] = useState(false);
  const toast = useToast();

  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rutaquilla_search_history') || '[]');
    } catch {
      return [];
    }
  });

  const saveToHistory = useCallback((place) => {
    if (!place?.displayName) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((p) => p.displayName !== place.displayName);
      const next = [place, ...filtered].slice(0, 5);
      localStorage.setItem('rutaquilla_search_history', JSON.stringify(next));
      return next;
    });
  }, []);

  const timerRef = useRef(null);

  const debouncedSearch = useCallback((query, setter, showSetter) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.length < 2) {
      setter([]);
      showSetter(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const results = await searchPlaces(query);
      setter(results);
      showSetter(results.length > 0);
    }, 350);
  }, []);

  const handleOriginInput = (v) => {
    setOriginText(v);
    setOrigin(null);
    if (v.length < 2 && searchHistory.length > 0) {
      setOriginSuggestions(searchHistory);
      setShowOriginSugg(true);
    } else {
      debouncedSearch(v, setOriginSuggestions, setShowOriginSugg);
    }
  };

  const handleDestInput = (v) => {
    setDestText(v);
    setDestination(null);
    if (v.length < 2 && searchHistory.length > 0) {
      setDestSuggestions(searchHistory);
      setShowDestSugg(true);
    } else {
      debouncedSearch(v, setDestSuggestions, setShowDestSugg);
    }
  };

  const selectOrigin = (s) => {
    setOriginText(s.displayName);
    setOrigin({ lat: s.lat, lng: s.lng });
    setShowOriginSugg(false);
    saveToHistory(s);
    onPreviewOriginChange?.({ lat: s.lat, lng: s.lng, displayName: s.displayName });
  };

  const selectDest = (s) => {
    setDestText(s.displayName);
    setDestination({ lat: s.lat, lng: s.lng });
    setShowDestSugg(false);
    saveToHistory(s);
    onPreviewDestinationChange?.({ lat: s.lat, lng: s.lng, displayName: s.displayName });
  };

  const handleGPS = async () => {
    try {
      setGpsLoading(true);
      const pos = await getCurrentPosition();
      setOrigin({ lat: pos.lat, lng: pos.lng });
      const name = await reverseGeocode(pos.lat, pos.lng);
      const cleanName = name && !isCoordinateString(name) ? name : 'Mi ubicación GPS';
      setOriginText(cleanName);
      onPreviewOriginChange?.({ lat: pos.lat, lng: pos.lng, displayName: cleanName });
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
    onPreviewOriginChange?.(prevDest ? { ...prevDest, displayName: prevDestText } : null);
    onPreviewDestinationChange?.(prevOrig ? { ...prevOrig, displayName: prevOrigText } : null);
  };

  useEffect(() => {
    if (!onSetOriginFromMap?.lat) return;
    let cancelled = false;
    setOrigin({ lat: onSetOriginFromMap.lat, lng: onSetOriginFromMap.lng });
    const presetName = onSetOriginFromMap.displayName || onSetOriginFromMap.name;
    if (presetName && !isCoordinateString(presetName)) {
      setOriginText(presetName);
      onPreviewOriginChange?.({ lat: onSetOriginFromMap.lat, lng: onSetOriginFromMap.lng, displayName: presetName });
      return;
    }
    setOriginText('Ubicando dirección...');
    reverseGeocode(onSetOriginFromMap.lat, onSetOriginFromMap.lng).then((n) => {
      if (cancelled) return;
      const resolved = n && !isCoordinateString(n) ? n : 'Origen en el mapa';
      setOriginText(resolved);
      onPreviewOriginChange?.({ lat: onSetOriginFromMap.lat, lng: onSetOriginFromMap.lng, displayName: resolved });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSetOriginFromMap]);

  useEffect(() => {
    if (!onSetDestinationFromMap?.lat) return;
    let cancelled = false;
    setDestination({ lat: onSetDestinationFromMap.lat, lng: onSetDestinationFromMap.lng });
    const presetName = onSetDestinationFromMap.displayName || onSetDestinationFromMap.name;
    if (presetName && !isCoordinateString(presetName)) {
      setDestText(presetName);
      onPreviewDestinationChange?.({ lat: onSetDestinationFromMap.lat, lng: onSetDestinationFromMap.lng, displayName: presetName });
      return;
    }
    setDestText('Ubicando dirección...');
    reverseGeocode(onSetDestinationFromMap.lat, onSetDestinationFromMap.lng).then((n) => {
      if (cancelled) return;
      const resolved = n && !isCoordinateString(n) ? n : 'Destino en el mapa';
      setDestText(resolved);
      onPreviewDestinationChange?.({ lat: onSetDestinationFromMap.lat, lng: onSetDestinationFromMap.lng, displayName: resolved });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSetDestinationFromMap]);

  const handleSearch = async () => {
    if (isNavigating || resolvingSearch) return;
    fxSearchStart();

    let finalOrigin = origin;
    let finalDest = destination;

    if ((!finalOrigin && originText.trim().length >= 2) || (!finalDest && destText.trim().length >= 2)) {
      setResolvingSearch(true);
      try {
        if (!finalOrigin && originText.trim().length >= 2) {
          const suggs = originSuggestions.length > 0 ? originSuggestions : await searchPlaces(originText.trim());
          if (suggs?.length > 0) {
            const best = suggs[0];
            finalOrigin = { lat: best.lat, lng: best.lng };
            setOrigin(finalOrigin);
            setOriginText(best.displayName);
            saveToHistory(best);
            onPreviewOriginChange?.({ lat: best.lat, lng: best.lng, displayName: best.displayName });
            setShowOriginSugg(false);
          }
        }
        if (!finalDest && destText.trim().length >= 2) {
          const suggs = destSuggestions.length > 0 ? destSuggestions : await searchPlaces(destText.trim());
          if (suggs?.length > 0) {
            const best = suggs[0];
            finalDest = { lat: best.lat, lng: best.lng };
            setDestination(finalDest);
            setDestText(best.displayName);
            saveToHistory(best);
            onPreviewDestinationChange?.({ lat: best.lat, lng: best.lng, displayName: best.displayName });
            setShowDestSugg(false);
          }
        }
      } finally {
        setResolvingSearch(false);
      }
    }

    if (!finalOrigin || !finalDest) {
      toast.warning('No ubicamos esa dirección en Barranquilla. Elige una sugerencia o márcala en el mapa.');
      return;
    }

    onNavigate?.(finalOrigin, finalDest);
    onSelectOptionIdx?.(0);
    setExpandedOption(0);
  };

  const handleClear = () => {
    setOriginText('');
    setDestText('');
    setOrigin(null);
    setDestination(null);
    setExpandedOption(null);
    onSelectOptionIdx?.(0);
    onPreviewOriginChange?.(null);
    onPreviewDestinationChange?.(null);
    onClear?.();
  };

  const options = navigationResult?.options || [];
  const hasOriginInput = Boolean(origin || originText.trim().length >= 3);
  const hasDestInput = Boolean(destination || destText.trim().length >= 3);
  const canSearch = hasOriginInput && hasDestInput && !isNavigating && !resolvingSearch;

  const handleInputKeyDown = (isOriginField) => (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (isOriginField && !origin && originSuggestions.length > 0) {
      selectOrigin(originSuggestions[0]);
      return;
    }
    if (!isOriginField && !destination && destSuggestions.length > 0) {
      const chosenDest = destSuggestions[0];
      selectDest(chosenDest);
      if (origin) {
        onNavigate?.(origin, { lat: chosenDest.lat, lng: chosenDest.lng });
        onSelectOptionIdx?.(0);
        setExpandedOption(0);
      }
      return;
    }
    if (hasOriginInput && hasDestInput) {
      handleSearch();
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ---- Tarjeta de Itinerario Origen -> Destino ---- */}
      <div className="rq-card" style={{ padding: '12px' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="rq-section-label">Planifica tu recorrido</span>
          <button
            type="button"
            onClick={handleSwap}
            title="Intercambiar origen y destino"
            aria-label="Intercambiar origen y destino"
            className="rq-icon-btn"
            style={{ width: 26, height: 26, borderRadius: 6 }}
          >
            <ArrowUpDown size={12} />
          </button>
        </div>

        {/* Riel visual vertical + campos */}
        <div style={{ display: 'flex', gap: 9, alignItems: 'stretch' }}>
          {/* Riel conector Mangle -> Carnaval */}
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '13px 0',
              width: 14,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--mangle)',
                border: '2px solid var(--bg-card)',
                boxShadow: '0 0 0 1px var(--mangle)',
              }}
            />
            <div
              style={{
                width: 1.5,
                flex: 1,
                minHeight: 16,
                margin: '4px 0',
                background: 'var(--border-color)',
              }}
            />
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: 'var(--carnaval)',
                border: '2px solid var(--bg-card)',
                boxShadow: '0 0 0 1px var(--carnaval)',
              }}
            />
          </div>

          {/* Columna de inputs */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* ORIGEN */}
            <div style={{ position: 'relative' }}>
              <InputRow
                id="origin-input"
                placeholder="¿Desde dónde sales? (Ej: Cra 43 #72-10)"
                value={originText}
                onChange={(e) => handleOriginInput(e.target.value)}
                onKeyDown={handleInputKeyDown(true)}
                onFocus={() => {
                  setOriginFocused(true);
                  if (originSuggestions.length) setShowOriginSugg(true);
                  else if (!originText && searchHistory.length > 0) {
                    setOriginSuggestions(searchHistory);
                    setShowOriginSugg(true);
                  }
                }}
                onBlur={() => {
                  setOriginFocused(false);
                  setTimeout(() => setShowOriginSugg(false), 200);
                }}
                focused={originFocused}
                rightSlot={
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={handleGPS}
                      disabled={gpsLoading}
                      title="Usar mi ubicación GPS"
                      aria-label="Usar mi ubicación GPS"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        border: '1px solid color-mix(in srgb, var(--caribe) 30%, transparent)',
                        background: 'var(--caribe-soft)',
                        color: 'var(--caribe)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {gpsLoading ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPinModeChange?.(pinMode === 'origin' ? null : 'origin')}
                      title="Marcar origen en el mapa"
                      aria-label="Marcar origen en el mapa"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        border: `1px solid ${
                          pinMode === 'origin' ? 'var(--mangle)' : 'var(--border-color)'
                        }`,
                        background: pinMode === 'origin' ? 'var(--mangle-soft)' : 'var(--bg-card)',
                        color: pinMode === 'origin' ? 'var(--mangle)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <MapPin size={12} />
                    </button>
                  </div>
                }
              />
              {showOriginSugg && (
                <SuggestionDropdown items={originSuggestions} onSelect={selectOrigin} accentColor="var(--mangle)" />
              )}
            </div>

            {/* DESTINO */}
            <div style={{ position: 'relative' }}>
              <InputRow
                id="destination-input"
                placeholder="¿A dónde vas? (Ej: Calle 84 #46-20)"
                value={destText}
                onChange={(e) => handleDestInput(e.target.value)}
                onKeyDown={handleInputKeyDown(false)}
                onFocus={() => {
                  setDestFocused(true);
                  if (destSuggestions.length) setShowDestSugg(true);
                  else if (!destText && searchHistory.length > 0) {
                    setDestSuggestions(searchHistory);
                    setShowDestSugg(true);
                  }
                }}
                onBlur={() => {
                  setDestFocused(false);
                  setTimeout(() => setShowDestSugg(false), 200);
                }}
                focused={destFocused}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => onPinModeChange?.(pinMode === 'destination' ? null : 'destination')}
                    title="Marcar destino en el mapa"
                    aria-label="Marcar destino en el mapa"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      border: `1px solid ${
                        pinMode === 'destination' ? 'var(--carnaval)' : 'var(--border-color)'
                      }`,
                      background: pinMode === 'destination' ? 'var(--carnaval-soft)' : 'var(--bg-card)',
                      color: pinMode === 'destination' ? 'var(--carnaval)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <MapPin size={12} />
                  </button>
                }
              />
              {showDestSugg && (
                <SuggestionDropdown items={destSuggestions} onSelect={selectDest} accentColor="var(--carnaval)" />
              )}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button
            onClick={handleSearch}
            disabled={!canSearch}
            id="navigate-btn"
            className="rq-btn-primary"
            style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
          >
            {isNavigating || resolvingSearch ? (
              <>
                <Loader2 size={14} className="animate-spin" /> {resolvingSearch ? 'Ubicando dirección...' : 'Buscando rutas...'}
              </>
            ) : (
              <>
                <Search size={14} /> Buscar ruta
              </>
            )}
          </button>

          {(navigationResult || originText || destText) && (
            <button
              onClick={handleClear}
              title="Limpiar recorrido"
              aria-label="Limpiar recorrido"
              className="rq-btn-ghost"
              style={{
                padding: '10px 11px',
                color: 'var(--carnaval)',
                borderColor: 'color-mix(in srgb, var(--carnaval) 32%, var(--border-color))',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {pinMode && (
          <div
            className="animate-fade-in"
            style={{
              marginTop: 8,
              padding: '7px 10px',
              borderRadius: 8,
              background: pinMode === 'origin' ? 'var(--mangle-soft)' : 'var(--carnaval-soft)',
              border: `1px solid color-mix(in srgb, ${
                pinMode === 'origin' ? 'var(--mangle)' : 'var(--carnaval)'
              } 35%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <Crosshair size={12} style={{ color: pinMode === 'origin' ? 'var(--mangle)' : 'var(--carnaval)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)' }}>
              Toca el mapa para marcar {pinMode === 'origin' ? 'el punto de origen' : 'el destino'}
            </span>
          </div>
        )}
      </div>

      {/* ---- Resultados ---- */}
      {navigationResult && (
        <div className="animate-fade-in">
          {options.length === 0 ? (
            <div className="rq-card text-center py-7 px-4">
              <div
                className="mx-auto mb-3 flex items-center justify-center"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <Bus size={20} color="var(--text-muted)" />
              </div>
              <p className="font-display text-sm font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                Sin rutas cercanas para este trayecto
              </p>
              <p className="text-xs mt-1 mb-0" style={{ color: 'var(--text-muted)' }}>
                Prueba ajustando el origen o destino sobre una vía principal.
              </p>
            </div>
          ) : (
            <div>
              <div className="rq-section-label mb-2 px-0.5">
                {options.length} {options.length === 1 ? 'opción encontrada' : 'opciones encontradas'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {options.map((opt, idx) => {
                  const isSelected = selectedOptionIdx === idx;
                  const isExpanded = expandedOption === idx;
                  const routeCol = opt.route.color || '#FFC21A';
                  return (
                    <button
                      key={idx}
                      id={`route-option-${idx}`}
                      onClick={() => {
                        onSelectOptionIdx?.(idx);
                        setExpandedOption(isExpanded ? null : idx);
                      }}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        className="rq-card"
                        style={{
                          '--route-color': routeCol,
                          overflow: 'hidden',
                          borderColor: isSelected ? routeCol : 'var(--border-color)',
                          background: isSelected
                            ? `color-mix(in srgb, ${routeCol} 6%, var(--bg-card))`
                            : 'var(--bg-card)',
                          boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ height: 3, background: isSelected ? routeCol : 'transparent' }} />

                        <div style={{ padding: '11px 12px' }}>
                          {/* Etiquetas + tiempo protagonista */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {(opt.isOptimal || opt.isTransfer || opt.transfer?.sistemasNoIntegrados) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                                  {opt.isOptimal && (
                                    <span
                                      className="font-mono"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '2px 7px',
                                        borderRadius: 5,
                                        background: 'var(--brand)',
                                        color: 'var(--brand-ink)',
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                      }}
                                    >
                                      <Star size={9} fill="currentColor" /> Óptima
                                    </span>
                                  )}
                                  {opt.isTransfer && (
                                    <span
                                      className="font-mono"
                                      style={{
                                        padding: '2px 7px',
                                        borderRadius: 5,
                                        background: 'var(--caribe-soft)',
                                        color: 'var(--caribe)',
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                      }}
                                    >
                                      1 transbordo
                                    </span>
                                  )}
                                  {opt.transfer?.sistemasNoIntegrados && (
                                    <span
                                      className="font-mono"
                                      style={{
                                        padding: '2px 7px',
                                        borderRadius: 5,
                                        background: 'var(--brand-soft)',
                                        color: 'var(--brand)',
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                      }}
                                    >
                                      2 pasajes
                                    </span>
                                  )}
                                </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {opt.route.codigo && (
                                  <span className="transit-code">{opt.route.codigo}</span>
                                )}
                                <p
                                  className="font-display"
                                  style={{
                                    fontSize: 13.5,
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    margin: 0,
                                    lineHeight: 1.25,
                                  }}
                                >
                                  {opt.isTransfer && opt.transfer?.secondRoute
                                    ? `${opt.route.name || opt.route.nombre} → ${
                                        opt.transfer.secondRoute.codigo ? `[${opt.transfer.secondRoute.codigo}] ` : ''
                                      }${opt.transfer.secondRoute.name}`
                                    : opt.route.name || opt.route.nombre}
                                </p>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: routeCol }}>
                                  {opt.isTransfer && opt.transfer?.secondRoute
                                    ? `${opt.route.company || opt.route.operador} + ${opt.transfer.secondRoute.company}`
                                    : opt.route.company || opt.route.operador}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>·</span>
                                <span
                                  className="font-mono"
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    color: opt.direction === 'ida' ? 'var(--mangle)' : 'var(--carnaval)',
                                  }}
                                >
                                  {opt.direction === 'ida' ? 'Ida' : 'Vuelta'}
                                </span>
                              </div>
                            </div>

                            {/* Bloque derecho: tiempo protagonista + tarifa */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div
                                className="tabular-nums"
                                style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}
                              >
                                ~{opt.totalMinutes}
                                <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 2 }}>
                                  min
                                </span>
                              </div>
                              <div
                                className="tabular-nums"
                                style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', marginTop: 4 }}
                              >
                                ${opt.route.fare?.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {/* Tira resumida de tramos */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              marginTop: 9,
                              padding: '6px 9px',
                              borderRadius: 7,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                              <Footprints size={12} color="var(--caribe)" />
                              <span className="tabular-nums">{opt.totalWalkMinutes} min a pie</span>
                            </div>
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </span>
                          </div>

                          {/* Timeline detallado */}
                          {isExpanded && (
                            <div
                              className="animate-fade-in"
                              style={{
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                            >
                              {[
                                {
                                  icon: <Footprints size={12} />,
                                  color: 'var(--caribe)',
                                  label: `Camina ${opt.boardPoint.walkDistance} m (~${opt.boardPoint.walkMinutes} min)`,
                                  sub: 'Hasta el punto de abordaje',
                                },
                                {
                                  icon: <Bus size={12} />,
                                  color: routeCol,
                                  label: `${opt.route.nombre || opt.route.name} (~${
                                    opt.isTransfer && opt.transfer
                                      ? Math.max(1, opt.busMinutes - opt.transfer.secondBusMinutes)
                                      : opt.busMinutes
                                  } min)`,
                                  sub: opt.isTransfer ? 'Primer tramo en bus' : 'Recorrido en bus',
                                },
                                ...(opt.isTransfer && opt.transfer
                                  ? [
                                      {
                                        icon: <Footprints size={12} />,
                                        color: 'var(--caribe)',
                                        label: `Transbordo: ${opt.transfer.walkDistance} m (~${opt.transfer.walkMinutes} min)`,
                                        sub: `Conecta con ${opt.transfer.secondRoute.name}`,
                                      },
                                      {
                                        icon: <Bus size={12} />,
                                        color: opt.transfer.secondRoute.color || '#3B8BF0',
                                        label: `${opt.transfer.secondRoute.name} (~${opt.transfer.secondBusMinutes} min)`,
                                        sub: `Segundo tramo (${opt.transfer.secondRoute.company})`,
                                      },
                                    ]
                                  : []),
                                {
                                  icon: <MapPin size={12} />,
                                  color: 'var(--carnaval)',
                                  label:
                                    opt.alightPoint.walkDistance < 50
                                      ? 'El bus pasa frente a tu destino'
                                      : `Camina ${opt.alightPoint.walkDistance} m al destino`,
                                  sub: opt.alightPoint.walkDistance < 50 ? 'Baja en este punto' : `~${opt.alightPoint.walkMinutes} min`,
                                },
                              ].map((step, i, arr) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div
                                      style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 6,
                                        flexShrink: 0,
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: step.color,
                                      }}
                                    >
                                      {step.icon}
                                    </div>
                                    {i < arr.length - 1 && (
                                      <div
                                        style={{
                                          width: 1.5,
                                          flex: 1,
                                          minHeight: 10,
                                          margin: '2px 0',
                                          background: 'var(--border-color)',
                                        }}
                                      />
                                    )}
                                  </div>
                                  <div style={{ paddingBottom: i < arr.length - 1 ? 9 : 2 }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                      {step.label}
                                    </p>
                                    <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: '1px 0 0' }}>
                                      {step.sub}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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

      {/* ---- Estado inicial: Mis lugares (Casa / Trabajo) + Destinos frecuentes + Guía rápida ---- */}
      {!navigationResult && (
        <div className="space-y-3">
          <div className="rq-card" style={{ padding: '12px' }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="rq-section-label m-0">Mis lugares</div>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>1 toque para ir</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'home', title: 'Casa', Icon: Home, accent: 'var(--mangle)' },
                { key: 'work', title: 'Trabajo', Icon: Briefcase, accent: 'var(--caribe)' },
              ].map(({ key, title, Icon, accent }) => {
                const saved = savedPlaces[key];
                const isEditing = editingPlaceSlot === key;
                return (
                  <div
                    key={key}
                    onClick={() => {
                      if (saved) {
                        selectDest({ ...saved, displayName: `${title} · ${saved.displayName}` });
                      } else {
                        fxTap();
                        setEditingPlaceSlot(isEditing ? null : key);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (saved) {
                          selectDest({ ...saved, displayName: `${title} · ${saved.displayName}` });
                        } else {
                          fxTap();
                          setEditingPlaceSlot(isEditing ? null : key);
                        }
                      }
                    }}
                    className="rq-chip flex items-center justify-between gap-1.5 cursor-pointer"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      borderColor: isEditing ? 'var(--brand)' : 'var(--border-color)',
                      background: saved ? 'var(--bg-surface)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon size={14} color={accent} className="flex-shrink-0" />
                      <div className="min-w-0 text-left">
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                          {title}
                        </div>
                        <div
                          className="truncate"
                          style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 105 }}
                        >
                          {saved ? saved.displayName : 'Guardar lugar'}
                        </div>
                      </div>
                    </div>

                    {saved && (
                      <button
                        type="button"
                        onClick={(e) => handleClearSavedPlace(key, e)}
                        aria-label={`Borrar ${title}`}
                        title={`Cambiar ${title}`}
                        className="bg-transparent border-0 p-1 cursor-pointer flex-shrink-0 inline-flex"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {editingPlaceSlot && (
              <div
                className="mt-2.5 p-2.5 rounded-xl space-y-2 animate-fade-in"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Guardar {editingPlaceSlot === 'home' ? 'Casa' : 'Trabajo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingPlaceSlot(null)}
                    className="bg-transparent border-0 p-0 cursor-pointer text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Cerrar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={savingPlaceGPS}
                    onClick={() => handleSavePlaceFromGPS(editingPlaceSlot)}
                    className="rq-chip"
                    style={{ padding: '5px 10px', fontSize: 11, color: 'var(--mangle)' }}
                  >
                    {savingPlaceGPS ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
                    Usar mi ubicación
                  </button>
                  {destination && (
                    <button
                      type="button"
                      onClick={() => handleSavePlaceFromDest(editingPlaceSlot)}
                      className="rq-chip"
                      style={{ padding: '5px 10px', fontSize: 11, color: 'var(--brand)' }}
                    >
                      <MapPin size={12} />
                      Usar destino actual
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rq-card" style={{ padding: '12px' }}>
            <div className="rq-section-label mb-2">Destinos frecuentes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_DESTINATIONS.map((place) => (
                <button
                  key={place.label}
                  type="button"
                  onClick={() => selectDest(place)}
                  className="rq-chip"
                  style={{ padding: '5px 9px', fontSize: 11 }}
                >
                  <MapPin size={11} color="var(--carnaval)" />
                  <span>{place.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rq-card" style={{ padding: '12px' }}>
            <div className="rq-section-label mb-2">Cómo planificar</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { icon: Crosshair, color: 'var(--caribe)', text: 'Detecta tu punto actual usando GPS' },
                { icon: Search, color: 'var(--brand)', text: 'Escribe barrios, vías o centros comerciales' },
                { icon: MapPin, color: 'var(--mangle)', text: 'Mantén pulsado el mapa para marcar un punto' },
              ].map((tip, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    fontSize: 11.5,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <tip.icon size={13} color={tip.color} style={{ flexShrink: 0 }} />
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
