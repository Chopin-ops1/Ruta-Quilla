/**
 * ============================================
 * RutaQuilla - MapQuickBar (Bottom Floating Bar)
 * ============================================
 *
 * Minimalist floating bar that appears at the bottom
 * when origin/destination are set from ANY source:
 * - Map context menu (right-click / long-press)
 * - Sidebar GPS button
 * - Sidebar address search
 *
 * Shows:
 * - Origin address (green)
 * - Destination address (red) 
 * - "Buscar ruta" button when both are set
 *
 * Designed primarily for mobile UX so users don't
 * need to open the sidebar to search.
 */

import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X, Loader2, Navigation } from 'lucide-react';
import { reverseGeocode } from '../services/routingService';

export default function MapQuickBar({
  originFromMap,
  destFromMap,
  previewOrigin,
  previewDestination,
  onNavigate,
  onClear,
  isNavigating,
  navigationResult,
}) {
  const [originName, setOriginName] = useState(null);
  const [destName, setDestName] = useState(null);

  // Compute effective origin/dest from ANY source
  const effectiveOrigin = previewOrigin || originFromMap;
  const effectiveDest = previewDestination || destFromMap;

  // Track previous coords to avoid redundant geocoding
  const prevOriginRef = useRef(null);
  const prevDestRef = useRef(null);

  // Resolve origin address
  useEffect(() => {
    if (!effectiveOrigin?.lat) {
      setOriginName(null);
      prevOriginRef.current = null;
      return;
    }
    // Skip if same coordinates
    const key = `${effectiveOrigin.lat.toFixed(6)},${effectiveOrigin.lng.toFixed(6)}`;
    if (prevOriginRef.current === key) return;
    prevOriginRef.current = key;

    setOriginName(null); // Show "Cargando..." while fetching
    reverseGeocode(effectiveOrigin.lat, effectiveOrigin.lng)
      .then(name => setOriginName(name))
      .catch(() => setOriginName(`${effectiveOrigin.lat.toFixed(4)}, ${effectiveOrigin.lng.toFixed(4)}`));
  }, [effectiveOrigin?.lat, effectiveOrigin?.lng]);

  // Resolve destination address
  useEffect(() => {
    if (!effectiveDest?.lat) {
      setDestName(null);
      prevDestRef.current = null;
      return;
    }
    const key = `${effectiveDest.lat.toFixed(6)},${effectiveDest.lng.toFixed(6)}`;
    if (prevDestRef.current === key) return;
    prevDestRef.current = key;

    setDestName(null);
    reverseGeocode(effectiveDest.lat, effectiveDest.lng)
      .then(name => setDestName(name))
      .catch(() => setDestName(`${effectiveDest.lat.toFixed(4)}, ${effectiveDest.lng.toFixed(4)}`));
  }, [effectiveDest?.lat, effectiveDest?.lng]);

  // Hide when navigation results are shown
  if (navigationResult) return null;

  // Hide if nothing set from any source
  if (!effectiveOrigin && !effectiveDest) return null;

  const canSearch = effectiveOrigin?.lat && effectiveDest?.lat && !isNavigating;

  const handleSearch = () => {
    if (!canSearch) return;
    onNavigate(
      { lat: effectiveOrigin.lat, lng: effectiveOrigin.lng },
      { lat: effectiveDest.lat, lng: effectiveDest.lng }
    );
  };

  const handleClose = () => {
    setOriginName(null);
    setDestName(null);
    prevOriginRef.current = null;
    prevDestRef.current = null;
    onClear?.();
  };

  return (
    <div
      className="animate-slide-up rq-sheet"
      style={{
        position: 'fixed',
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        translate: '-50% 0',
        zIndex: 1200,
        width: 'calc(100% - 28px)',
        maxWidth: 420,
        overflow: 'hidden',
      }}
    >
      <div className="sheet-handle" />

      <div style={{ padding: '6px 14px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {effectiveOrigin && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 10px',
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderLeft: '3px solid var(--mangle)',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: 'var(--mangle)',
                }}
              />
              <span
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {originName || 'Cargando origen...'}
              </span>
            </div>
          )}

          {effectiveOrigin && effectiveDest && (
            <Navigation size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: 'rotate(90deg)' }} />
          )}

          {effectiveDest && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 10px',
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderLeft: '3px solid var(--carnaval)',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: 'var(--carnaval)',
                }}
              />
              <span
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {destName || 'Cargando destino...'}
              </span>
            </div>
          )}

          <button
            onClick={handleClose}
            aria-label="Limpiar puntos"
            className="rq-icon-btn"
            style={{ width: 30, height: 30, flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>

        {!canSearch && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            {!effectiveOrigin
              ? 'Selecciona el punto de origen en el mapa para continuar'
              : 'Ahora toca o haz clic derecho en el mapa para fijar el destino'}
          </p>
        )}

        {canSearch && (
          <button
            onClick={handleSearch}
            disabled={isNavigating}
            className="rq-btn-primary"
            style={{ width: '100%', padding: '10px 14px', fontSize: 13 }}
          >
            {isNavigating ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Buscando rutas...
              </>
            ) : (
              <>
                <Search size={14} /> Buscar ruta
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
