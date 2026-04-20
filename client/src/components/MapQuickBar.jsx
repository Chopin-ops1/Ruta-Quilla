/**
 * ============================================
 * RutaQuilla - MapQuickBar (Bottom Floating Bar)
 * ============================================
 *
 * Minimalist floating bar that appears at the bottom
 * when origin/destination are set directly from the map
 * (via right-click or long-press context menu).
 *
 * Shows:
 * - Origin address (green)
 * - Destination address (red) 
 * - "Buscar ruta" button when both are set
 *
 * Designed primarily for mobile UX so users don't
 * need to open the sidebar to search.
 */

import { useState, useEffect } from 'react';
import { MapPin, Search, X, Loader2, Navigation } from 'lucide-react';
import { reverseGeocode } from '../services/routingService';

export default function MapQuickBar({
  originFromMap,
  destFromMap,
  onNavigate,
  onClear,
  isNavigating,
  navigationResult,
}) {
  const [originName, setOriginName] = useState(null);
  const [destName, setDestName] = useState(null);
  const [visible, setVisible] = useState(false);

  // Resolve origin address
  useEffect(() => {
    if (originFromMap?.lat) {
      setVisible(true);
      reverseGeocode(originFromMap.lat, originFromMap.lng)
        .then(name => setOriginName(name))
        .catch(() => setOriginName(`${originFromMap.lat.toFixed(4)}, ${originFromMap.lng.toFixed(4)}`));
    }
  }, [originFromMap]);

  // Resolve destination address
  useEffect(() => {
    if (destFromMap?.lat) {
      setVisible(true);
      reverseGeocode(destFromMap.lat, destFromMap.lng)
        .then(name => setDestName(name))
        .catch(() => setDestName(`${destFromMap.lat.toFixed(4)}, ${destFromMap.lng.toFixed(4)}`));
    }
  }, [destFromMap]);

  // Hide when navigation results are shown or cleared
  useEffect(() => {
    if (navigationResult) {
      setVisible(false);
    }
  }, [navigationResult]);

  // Hide if nothing set
  if (!visible || (!originFromMap && !destFromMap)) return null;

  const canSearch = originFromMap?.lat && destFromMap?.lat && !isNavigating;

  const handleSearch = () => {
    if (!canSearch) return;
    onNavigate(
      { lat: originFromMap.lat, lng: originFromMap.lng },
      { lat: destFromMap.lat, lng: destFromMap.lng }
    );
  };

  const handleClose = () => {
    setVisible(false);
    setOriginName(null);
    setDestName(null);
    onClear?.();
  };

  const truncate = (s, n = 30) => s && s.length > n ? s.slice(0, n - 1) + '…' : s;

  return (
    <div
      className="animate-slide-up"
      style={{
        position: 'fixed',
        bottom: 16, left: '50%', transform: 'translateX(-50%)',
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
        background: originFromMap && destFromMap
          ? 'linear-gradient(90deg, #10B981, #F59E0B, #EF4444)'
          : originFromMap
            ? 'linear-gradient(90deg, #10B981, #10B98160)'
            : 'linear-gradient(90deg, #EF444460, #EF4444)',
      }} />

      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Points row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Origin chip */}
          {originFromMap && (
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
          {originFromMap && destFromMap && (
            <Navigation size={12} style={{ color: '#475569', flexShrink: 0, transform: 'rotate(90deg)' }} />
          )}

          {/* Destination chip */}
          {destFromMap && (
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
            {!originFromMap ? '🖱️ Click derecho → Origen' : '🖱️ Ahora selecciona el destino'}
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
