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

  const truncate = (s, n = 30) => s && s.length > n ? s.slice(0, n - 1) + '…' : s;

  return (
    <div
      className="animate-slide-up"
      style={{
        position: 'fixed',
        bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        left: '50%', translate: '-50% 0',
        zIndex: 1200,
        width: 'calc(100% - 32px)', maxWidth: 420,
        borderRadius: 18,
        background: 'rgba(7, 11, 22, 0.94)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
        overflow: 'hidden',
      }}
    >
      {/* Gradient top accent */}
      <div style={{
        height: 2,
        background: effectiveOrigin && effectiveDest
          ? 'linear-gradient(90deg, #10B981, #F59E0B, #EF4444)'
          : effectiveOrigin
            ? 'linear-gradient(90deg, #10B981, #10B98160)'
            : 'linear-gradient(90deg, #EF444460, #EF4444)',
      }} />

      <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Points row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Origin chip */}
          {effectiveOrigin && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 10,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              minWidth: 0,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.6)',
              }} />
              <span style={{
                fontSize: 11, color: '#34D399', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {originName || 'Cargando...'}
              </span>
            </div>
          )}

          {/* Arrow */}
          {effectiveOrigin && effectiveDest && (
            <Navigation size={12} style={{ color: '#475569', flexShrink: 0, transform: 'rotate(90deg)' }} />
          )}

          {/* Destination chip */}
          {effectiveDest && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              minWidth: 0,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: '#EF4444', boxShadow: '0 0 6px rgba(239,68,68,0.6)',
              }} />
              <span style={{
                fontSize: 11, color: '#F87171', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {destName || 'Cargando...'}
              </span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748B', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Hint or search button */}
        {!canSearch && (
          <p style={{
            fontSize: 10, color: '#475569', textAlign: 'center',
            margin: 0, padding: '2px 0',
          }}>
            {!effectiveOrigin ? '🖱️ Click derecho → Origen' : '🖱️ Ahora selecciona el destino'}
          </p>
        )}

        {canSearch && (
          <button
            onClick={handleSearch}
            disabled={isNavigating}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 12,
              border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#000', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {isNavigating
              ? <><Loader2 size={14} className="animate-spin" /> Buscando...</>
              : <><Search size={14} /> Buscar ruta</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
