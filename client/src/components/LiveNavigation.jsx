/**
 * ============================================
 * RutaQuilla - Live Navigation v1 (Waze-style)
 * ============================================
 *
 * Navegación en tiempo real para transporte público
 * en Barranquilla (buses sin paradas fijas).
 *
 * Fases:
 * 1. WALKING_TO_BOARD — Caminando al punto de subida
 * 2. WAITING_FOR_BUS  — Esperando el bus en el punto
 * 3. RIDING_BUS       — Viajando en el bus
 * 4. ALERT_ALIGHT     — ¡Hora de bajarse!
 * 5. WALKING_TO_DEST  — Caminando al destino final
 * 6. ARRIVED          — ¡Llegaste!
 *
 * Mobile-first: diseñado como bottom-sheet con
 * instrucciones contextuales estilo Google Maps.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Navigation, X, Footprints, Bus, MapPin,
  Clock, AlertTriangle, CheckCircle2,
  ChevronUp, Volume2, VolumeX, BellRing,
  ArrowUp, CornerDownRight, Target,
} from 'lucide-react';

// Phases enum
const PHASE = {
  WALKING_TO_BOARD: 'WALKING_TO_BOARD',
  WAITING_FOR_BUS: 'WAITING_FOR_BUS',
  RIDING_BUS: 'RIDING_BUS',
  ALERT_ALIGHT: 'ALERT_ALIGHT',
  WALKING_TO_DEST: 'WALKING_TO_DEST',
  ARRIVED: 'ARRIVED',
};

// Haversine distance (meters)
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Play an alert tone using AudioContext
function playAlertTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    // Double beep
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.6);
    }, 400);
  } catch (_) {}
}

// Vibrate the device if supported
function vibrateDevice(pattern = [200, 100, 400]) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {}
}

// Request wake lock to keep screen on
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      return await navigator.wakeLock.request('screen');
    }
  } catch (_) {}
  return null;
}

export default function LiveNavigation({
  navigationOption,   // The selected route option from navigateRoute
  origin,             // {lat, lng}
  destination,        // {lat, lng}
  userPosition,       // {lat, lng, accuracy} — from GPS
  onCancel,           // Callback to exit live nav
  onPhaseChange,      // Callback when phase changes (for MapComponent)
}) {
  const [phase, setPhase] = useState(PHASE.WALKING_TO_BOARD);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [distToBoard, setDistToBoard] = useState(null);
  const [distToAlight, setDistToAlight] = useState(null);
  const [distToDest, setDistToDest] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [alertFired, setAlertFired] = useState(false);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);

  const boardLat = navigationOption?.boardPoint?.coordinates?.[1];
  const boardLng = navigationOption?.boardPoint?.coordinates?.[0];
  const alightLat = navigationOption?.alightPoint?.coordinates?.[1];
  const alightLng = navigationOption?.alightPoint?.coordinates?.[0];
  const routeColor = navigationOption?.route?.color || '#F59E0B';
  const routeName = navigationOption?.route?.name || navigationOption?.route?.nombre || 'Ruta';

  // Wake lock on mount
  useEffect(() => {
    requestWakeLock().then(lock => { wakeLockRef.current = lock; });
    return () => {
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release(); } catch (_) {}
      }
    };
  }, []);

  // Elapsed timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Phase detection based on GPS
  useEffect(() => {
    if (!userPosition || !boardLat || !alightLat) return;

    const dBoard = haversineM(userPosition.lat, userPosition.lng, boardLat, boardLng);
    const dAlight = haversineM(userPosition.lat, userPosition.lng, alightLat, alightLng);
    const dDest = haversineM(userPosition.lat, userPosition.lng, destination.lat, destination.lng);

    setDistToBoard(Math.round(dBoard));
    setDistToAlight(Math.round(dAlight));
    setDistToDest(Math.round(dDest));

    // Phase transitions
    if (phase === PHASE.WALKING_TO_BOARD && dBoard < 50) {
      setPhase(PHASE.WAITING_FOR_BUS);
      onPhaseChange?.(PHASE.WAITING_FOR_BUS);
      if (soundEnabled) playAlertTone();
      vibrateDevice([100, 50, 100]);
    }

    if (phase === PHASE.RIDING_BUS && dAlight < 200 && !alertFired) {
      setPhase(PHASE.ALERT_ALIGHT);
      onPhaseChange?.(PHASE.ALERT_ALIGHT);
      setAlertFired(true);
      if (soundEnabled) {
        playAlertTone();
        setTimeout(playAlertTone, 1500);
      }
      vibrateDevice([300, 200, 300, 200, 500]);
    }

    if (phase === PHASE.WALKING_TO_DEST && dDest < 30) {
      setPhase(PHASE.ARRIVED);
      onPhaseChange?.(PHASE.ARRIVED);
      if (soundEnabled) playAlertTone();
      vibrateDevice([200, 100, 200]);
    }
  }, [userPosition, phase, boardLat, boardLng, alightLat, alightLng, destination, soundEnabled, alertFired, onPhaseChange]);

  // Notify parent on phase change
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase]);

  const handleConfirmBoarded = () => {
    setPhase(PHASE.RIDING_BUS);
    onPhaseChange?.(PHASE.RIDING_BUS);
    if (soundEnabled) playAlertTone();
  };

  const handleConfirmAlighted = () => {
    setPhase(PHASE.WALKING_TO_DEST);
    onPhaseChange?.(PHASE.WALKING_TO_DEST);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getPhaseConfig = () => {
    switch (phase) {
      case PHASE.WALKING_TO_BOARD:
        return {
          icon: <Footprints size={18} />,
          color: '#60A5FA',
          bgColor: 'rgba(96, 165, 250, 0.12)',
          borderColor: 'rgba(96, 165, 250, 0.3)',
          title: 'Caminando al punto de subida',
          subtitle: distToBoard !== null ? `${distToBoard}m restantes · ~${Math.ceil(distToBoard / 80)} min` : 'Calculando...',
          instruction: `Dirígete hacia la ruta ${routeName}`,
        };
      case PHASE.WAITING_FOR_BUS:
        return {
          icon: <Bus size={18} />,
          color: routeColor,
          bgColor: `${routeColor}18`,
          borderColor: `${routeColor}40`,
          title: `Espera la ruta ${routeName}`,
          subtitle: '¡Ya estás en el punto! Espera el bus',
          instruction: 'Cuando suba al bus, confirma abajo',
          action: { label: '🚌 Ya subí al bus', onClick: handleConfirmBoarded },
        };
      case PHASE.RIDING_BUS:
        return {
          icon: <Bus size={18} />,
          color: routeColor,
          bgColor: `${routeColor}18`,
          borderColor: `${routeColor}40`,
          title: `En ruta ${routeName}`,
          subtitle: distToAlight !== null
            ? distToAlight > 500
              ? `Bájate en ~${Math.ceil(distToAlight / 250)} min (~${distToAlight}m)`
              : `¡Casi llegas! ${distToAlight}m al punto de bajada`
            : 'Viajando...',
          instruction: distToAlight !== null && distToAlight < 500
            ? '⚡ Prepárate para bajarte'
            : 'Relájate, te avisaremos cuando bajarte',
        };
      case PHASE.ALERT_ALIGHT:
        return {
          icon: <BellRing size={18} />,
          color: '#EF4444',
          bgColor: 'rgba(239, 68, 68, 0.15)',
          borderColor: 'rgba(239, 68, 68, 0.5)',
          title: '🛑 ¡BÁJATE AHORA!',
          subtitle: `Estás a ${distToAlight || '?'}m del punto de bajada`,
          instruction: 'Solicita la parada al conductor',
          action: { label: '✅ Ya me bajé', onClick: handleConfirmAlighted },
          pulse: true,
        };
      case PHASE.WALKING_TO_DEST:
        return {
          icon: <MapPin size={18} />,
          color: '#F87171',
          bgColor: 'rgba(248, 113, 113, 0.12)',
          borderColor: 'rgba(248, 113, 113, 0.3)',
          title: 'Caminando al destino',
          subtitle: distToDest !== null ? `${distToDest}m restantes · ~${Math.ceil(distToDest / 80)} min` : 'Calculando...',
          instruction: 'Sigue caminando a tu destino',
        };
      case PHASE.ARRIVED:
        return {
          icon: <CheckCircle2 size={18} />,
          color: '#10B981',
          bgColor: 'rgba(16, 185, 129, 0.15)',
          borderColor: 'rgba(16, 185, 129, 0.4)',
          title: '🎉 ¡Llegaste a tu destino!',
          subtitle: `Tiempo total: ${formatTime(elapsedSeconds)}`,
          instruction: '¡Buen viaje!',
          action: { label: '✕ Cerrar navegación', onClick: onCancel },
        };
      default:
        return { icon: null, color: '#94A3B8', bgColor: 'transparent', borderColor: 'transparent', title: '', subtitle: '', instruction: '' };
    }
  };

  const config = getPhaseConfig();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        fontFamily: 'Inter, sans-serif',
        pointerEvents: 'none',
      }}
    >
      {/* Top instruction banner */}
      <div
        style={{
          position: 'fixed',
          top: 56,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1300,
          width: 'calc(100% - 24px)',
          maxWidth: 420,
          pointerEvents: 'auto',
        }}
      >
        <div
          className={config.pulse ? 'animate-pulse-border' : ''}
          style={{
            borderRadius: 16,
            background: 'rgba(7, 11, 22, 0.96)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1.5px solid ${config.borderColor}`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset`,
            overflow: 'hidden',
          }}
        >
          {/* Color accent bar */}
          <div style={{
            height: 3,
            background: `linear-gradient(90deg, ${config.color}, ${config.color}60)`,
          }} />

          <div style={{ padding: '10px 14px' }}>
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                background: config.bgColor,
                border: `1px solid ${config.borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: config.color,
              }}>
                {config.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14, fontWeight: 700, color: config.color, margin: 0,
                  lineHeight: 1.3,
                }}>
                  {config.title}
                </p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                  {config.subtitle}
                </p>
              </div>

              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: soundEnabled ? '#F59E0B' : '#334155',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
              </button>
            </div>

            {/* Instruction text */}
            <p style={{
              fontSize: 11, color: '#64748B', margin: '8px 0 0',
              paddingLeft: 46,
            }}>
              {config.instruction}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          width: '100%',
          pointerEvents: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          style={{
            borderRadius: '18px 18px 0 0',
            background: 'rgba(7, 11, 22, 0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            padding: '10px 16px 14px',
          }}
        >
          {/* Route info pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 10,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 8,
              background: `${routeColor}15`, border: `1px solid ${routeColor}30`,
            }}>
              <Bus size={11} style={{ color: routeColor }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: routeColor }}>
                {routeName}
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
            }}>
              <Clock size={10} color="#64748B" />
              <span style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace' }}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[PHASE.WALKING_TO_BOARD, PHASE.WAITING_FOR_BUS, PHASE.RIDING_BUS, PHASE.ALERT_ALIGHT, PHASE.WALKING_TO_DEST, PHASE.ARRIVED].map((p, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: phase === p ? config.color
                    : Object.values(PHASE).indexOf(phase) > i ? '#10B981'
                    : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
          </div>

          {/* Phase steps visual */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 8px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            marginBottom: config.action ? 10 : 0,
          }}>
            {/* Walk → Board */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              opacity: phase === PHASE.WALKING_TO_BOARD ? 1 : 0.4,
            }}>
              <Footprints size={10} color="#60A5FA" />
              <span style={{ fontSize: 9, color: '#60A5FA', fontWeight: 500 }}>
                {navigationOption?.boardPoint?.walkDistance || '?'}m
              </span>
            </div>
            <CornerDownRight size={8} color="#334155" />

            {/* Bus ride */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              opacity: [PHASE.WAITING_FOR_BUS, PHASE.RIDING_BUS, PHASE.ALERT_ALIGHT].includes(phase) ? 1 : 0.4,
            }}>
              <Bus size={10} color={routeColor} />
              <span style={{ fontSize: 9, color: routeColor, fontWeight: 500 }}>
                ~{navigationOption?.busMinutes || '?'} min
              </span>
            </div>
            <CornerDownRight size={8} color="#334155" />

            {/* Walk → Dest */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              opacity: phase === PHASE.WALKING_TO_DEST ? 1 : 0.4,
            }}>
              <MapPin size={10} color="#F87171" />
              <span style={{ fontSize: 9, color: '#F87171', fontWeight: 500 }}>
                {navigationOption?.alightPoint?.walkDistance < 50
                  ? 'Directo 🎯'
                  : `${navigationOption?.alightPoint?.walkDistance || '?'}m`}
              </span>
            </div>

            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B' }}>
              ${navigationOption?.route?.fare?.toLocaleString() || '2,600'}
            </span>
          </div>

          {/* Action button (phase-specific) */}
          {config.action && (
            <button
              onClick={config.action.onClick}
              style={{
                width: '100%', padding: '12px 0',
                borderRadius: 13, border: 'none',
                background: phase === PHASE.ALERT_ALIGHT
                  ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                  : phase === PHASE.ARRIVED
                    ? 'rgba(255,255,255,0.06)'
                    : `linear-gradient(135deg, ${routeColor}, ${routeColor}CC)`,
                color: phase === PHASE.ARRIVED ? '#94A3B8' : '#fff',
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: phase === PHASE.ALERT_ALIGHT
                  ? '0 4px 20px rgba(239,68,68,0.4)'
                  : phase === PHASE.ARRIVED ? 'none' : `0 4px 20px ${routeColor}40`,
                animation: phase === PHASE.ALERT_ALIGHT ? 'pulse 1.5s ease-in-out infinite' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {config.action.label}
            </button>
          )}

          {/* Cancel button (always visible except ARRIVED) */}
          {phase !== PHASE.ARRIVED && (
            <button
              onClick={onCancel}
              style={{
                width: '100%', marginTop: 8, padding: '8px 0',
                borderRadius: 10, border: 'none',
                background: 'rgba(239,68,68,0.06)',
                color: '#64748B',
                fontSize: 11, fontWeight: 500,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'all 0.2s',
              }}
            >
              <X size={11} /> Cancelar navegación
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
