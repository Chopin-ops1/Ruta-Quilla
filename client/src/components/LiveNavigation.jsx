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
import { fxBoardBus, fxAlightAlert, fxArrived } from '../utils/soundAndHaptics';

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
      if (soundEnabled) fxBoardBus();
    }

    if (phase === PHASE.RIDING_BUS && dAlight < 200 && !alertFired) {
      setPhase(PHASE.ALERT_ALIGHT);
      onPhaseChange?.(PHASE.ALERT_ALIGHT);
      setAlertFired(true);
      if (soundEnabled) fxAlightAlert();
    }

    if (phase === PHASE.WALKING_TO_DEST && dDest < 30) {
      setPhase(PHASE.ARRIVED);
      onPhaseChange?.(PHASE.ARRIVED);
      if (soundEnabled) fxArrived();
    }
  }, [userPosition, phase, boardLat, boardLng, alightLat, alightLng, destination, soundEnabled, alertFired, onPhaseChange]);

  // Notify parent on phase change
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase]);

  const handleConfirmBoarded = () => {
    setPhase(PHASE.RIDING_BUS);
    onPhaseChange?.(PHASE.RIDING_BUS);
    if (soundEnabled) fxBoardBus();
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
          color: 'var(--caribe)',
          bgColor: 'var(--caribe-soft)',
          borderColor: 'color-mix(in srgb, var(--caribe) 40%, var(--border-color))',
          title: 'Camina al punto de subida',
          subtitle: distToBoard !== null ? `${distToBoard} m restantes · ~${Math.ceil(distToBoard / 80)} min` : 'Calculando...',
          instruction: `Dirígete hacia la ruta ${routeName}`,
        };
      case PHASE.WAITING_FOR_BUS:
        return {
          icon: <Bus size={18} />,
          color: routeColor,
          bgColor: 'var(--brand-soft)',
          borderColor: routeColor,
          title: `Espera el bus ${routeName}`,
          subtitle: 'Ya estás en el punto de abordaje',
          instruction: 'Confirma abajo cuando subas al vehículo',
          action: { label: 'Ya subí al bus', onClick: handleConfirmBoarded },
        };
      case PHASE.RIDING_BUS:
        return {
          icon: <Bus size={18} />,
          color: routeColor,
          bgColor: 'var(--mangle-soft)',
          borderColor: 'color-mix(in srgb, var(--mangle) 45%, var(--border-color))',
          title: `En ruta ${routeName}`,
          subtitle: distToAlight !== null
            ? distToAlight > 500
              ? `Baja en ~${Math.ceil(distToAlight / 250)} min (${distToAlight} m)`
              : `Casi llegas · ${distToAlight} m al descenso`
            : 'Viajando...',
          instruction: distToAlight !== null && distToAlight < 500
            ? 'Prepárate para solicitar la parada'
            : 'Te avisaremos antes de llegar al punto de bajada',
        };
      case PHASE.ALERT_ALIGHT:
        return {
          icon: <BellRing size={18} />,
          color: 'var(--carnaval)',
          bgColor: 'var(--carnaval-soft)',
          borderColor: 'var(--carnaval)',
          title: '¡Solicita la parada ahora!',
          subtitle: `Estás a ${distToAlight || '?'} m del punto de descenso`,
          instruction: 'Toca el timbre o avisa al conductor para bajar',
          action: { label: 'Ya me bajé', onClick: handleConfirmAlighted },
          pulse: true,
        };
      case PHASE.WALKING_TO_DEST:
        return {
          icon: <MapPin size={18} />,
          color: 'var(--carnaval)',
          bgColor: 'var(--carnaval-soft)',
          borderColor: 'color-mix(in srgb, var(--carnaval) 40%, var(--border-color))',
          title: 'Camina hacia tu destino',
          subtitle: distToDest !== null ? `${distToDest} m restantes · ~${Math.ceil(distToDest / 80)} min` : 'Calculando...',
          instruction: 'Último tramo a pie hasta tu llegada',
        };
      case PHASE.ARRIVED:
        return {
          icon: <CheckCircle2 size={18} />,
          color: 'var(--mangle)',
          bgColor: 'var(--mangle-soft)',
          borderColor: 'var(--mangle)',
          title: 'Llegaste a tu destino',
          subtitle: `Tiempo total: ${formatTime(elapsedSeconds)}`,
          instruction: 'Recorrido finalizado',
          action: { label: 'Finalizar navegación', onClick: onCancel },
        };
      default:
        return { icon: null, color: 'var(--text-muted)', bgColor: 'transparent', borderColor: 'var(--border-color)', title: '', subtitle: '', instruction: '' };
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
        pointerEvents: 'none',
      }}
    >
      {/* Banner superior Modo GO */}
      <div
        style={{
          position: 'fixed',
          top: 62,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1300,
          width: 'calc(100% - 16px)',
          maxWidth: 440,
          pointerEvents: 'auto',
        }}
      >
        <div
          className={`rq-sheet ${config.pulse ? 'animate-pulse-border' : ''}`}
          style={{
            borderRadius: 14,
            border: `1.5px solid ${config.borderColor}`,
            borderLeft: `5px solid ${config.color}`,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: config.bgColor,
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: config.color,
                }}
              >
                {config.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  className="font-display"
                  style={{
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {config.title}
                </p>
                <p className="tabular-nums" style={{ fontSize: 11.5, fontWeight: 600, color: config.color, margin: '2px 0 0' }}>
                  {config.subtitle}
                </p>
              </div>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                aria-label={soundEnabled ? 'Silenciar alertas' : 'Activar alertas'}
                className="rq-icon-btn"
                style={{
                  width: 30,
                  height: 30,
                  color: soundEnabled ? 'var(--brand)' : 'var(--text-muted)',
                }}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            </div>

            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '6px 0 0', paddingLeft: 0 }}>
              {config.instruction}
            </p>
          </div>
        </div>
      </div>

      {/* Hoja inferior Modo GO */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          pointerEvents: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          className="rq-sheet"
          style={{
            borderRadius: '16px 16px 0 0',
            borderBottom: 'none',
            padding: '6px 14px 12px',
          }}
        >
          <div className="sheet-handle" style={{ marginBottom: 8 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className="transit-code" style={{ '--route-color': routeColor }}>
              {navigationOption?.route?.codigo || routeName}
            </span>
            {navigationOption?.route?.codigo && (
              <span className="font-display text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {routeName}
              </span>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                marginLeft: 'auto',
              }}
            >
              <Clock size={10} style={{ color: 'var(--text-muted)' }} />
              <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>

            {/* Segmentos de progreso */}
            <div style={{ display: 'flex', gap: 3 }}>
              {[
                PHASE.WALKING_TO_BOARD,
                PHASE.WAITING_FOR_BUS,
                PHASE.RIDING_BUS,
                PHASE.ALERT_ALIGHT,
                PHASE.WALKING_TO_DEST,
                PHASE.ARRIVED,
              ].map((p, i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: 4,
                    borderRadius: 2,
                    background:
                      phase === p
                        ? config.color
                        : Object.values(PHASE).indexOf(phase) > i
                        ? 'var(--mangle)'
                        : 'var(--border-color)',
                    transition: 'background 0.25s',
                  }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 10px',
              borderRadius: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              marginBottom: config.action ? 10 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: phase === PHASE.WALKING_TO_BOARD ? 1 : 0.45 }}>
              <Footprints size={11} color="var(--caribe)" />
              <span className="tabular-nums" style={{ fontSize: 10.5, color: 'var(--caribe)', fontWeight: 600 }}>
                {navigationOption?.boardPoint?.walkDistance || '?'} m
              </span>
            </div>
            <CornerDownRight size={9} style={{ color: 'var(--text-muted)' }} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                opacity: [PHASE.WAITING_FOR_BUS, PHASE.RIDING_BUS, PHASE.ALERT_ALIGHT].includes(phase) ? 1 : 0.45,
              }}
            >
              <Bus size={11} color={routeColor} />
              <span className="tabular-nums" style={{ fontSize: 10.5, color: 'var(--text-primary)', fontWeight: 600 }}>
                ~{navigationOption?.busMinutes || '?'} min
              </span>
            </div>
            <CornerDownRight size={9} style={{ color: 'var(--text-muted)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: phase === PHASE.WALKING_TO_DEST ? 1 : 0.45 }}>
              <MapPin size={11} color="var(--carnaval)" />
              <span className="tabular-nums" style={{ fontSize: 10.5, color: 'var(--carnaval)', fontWeight: 600 }}>
                {navigationOption?.alightPoint?.walkDistance < 50
                  ? 'Directo'
                  : `${navigationOption?.alightPoint?.walkDistance || '?'} m`}
              </span>
            </div>

            <div style={{ flex: 1 }} />
            <span className="tabular-nums" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>
              ${navigationOption?.route?.fare?.toLocaleString() || '3,700'}
            </span>
          </div>

          {config.action && (
            <button
              onClick={config.action.onClick}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.1)',
                background:
                  phase === PHASE.ALERT_ALIGHT
                    ? 'var(--carnaval)'
                    : phase === PHASE.ARRIVED
                    ? 'var(--mangle)'
                    : 'var(--brand)',
                color: phase === PHASE.WAITING_FOR_BUS ? 'var(--brand-ink)' : '#FFFFFF',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {config.action.label}
            </button>
          )}

          {phase !== PHASE.ARRIVED && (
            <button
              onClick={onCancel}
              className="rq-btn-ghost"
              style={{
                width: '100%',
                marginTop: 7,
                padding: '8px 12px',
                fontSize: 11.5,
                color: 'var(--carnaval)',
                borderColor: 'color-mix(in srgb, var(--carnaval) 30%, var(--border-color))',
              }}
            >
              <X size={12} /> Cancelar navegación
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
