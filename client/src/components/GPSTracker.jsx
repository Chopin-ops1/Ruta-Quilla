/**
 * ============================================
 * RutaQuilla - GPSTracker v2 (Route Capture)
 * ============================================
 * 
 * Enhanced GPS route capture with pre-capture config:
 * - User must specify bus name, company, direction BEFORE recording
 * - Boarding point captured automatically (first GPS point)
 * - Sends enriched metadata to backend for admin review
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Save,
  X,
  AlertTriangle,
  Bus,
  ArrowRight,
  ArrowLeft,
  Play,
  Users,
  TrendingUp,
  CheckCircle2,
  MapPin,
  Crosshair,
  Building2,
} from 'lucide-react';
import {
  startTracking,
  stopTracking,
  getSignalQuality,
  isGeolocationAvailable,
  ensureLocationReady,
  openDeviceLocationSettings,
} from '../services/gpsService';
import { routesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fxCaptureStart, fxCaptureSaved, fxTap } from '../utils/soundAndHaptics';

const COMPANIES = [
  'Sobrusa', 'Coolitoral', 'Transmecar', 'Sobusa',
  'Cootransnorte', 'Embusa', 'Flota Angulo', 'Sodis',
  'Lolaya', 'Lucero San Felipe', 'Coochofal', 'Cootrasol',
  'La Carolina', 'Alianza', 'Excolcar', 'Otra',
];

export default function GPSTracker({
  isCapturing,
  onCaptureToggle,
  onPositionUpdate,
  onTrackUpdate,
  showConfigModal,
  onCloseConfigModal,
}) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [gpsPoints, setGpsPoints] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [pointCount, setPointCount] = useState(0);
  const [error, setError] = useState(null);

  const [routeName, setRouteName] = useState('');
  const [routeCompany, setRouteCompany] = useState('Sobrusa');
  const [routeDirection, setRouteDirection] = useState('ida');

  // Save dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gpsNeedsSettings, setGpsNeedsSettings] = useState(false);

  const watchIdRef = useRef(null);
  const pointsRef = useRef([]);
  const startTimeRef = useRef(null);

  /**
   * Open config modal before starting capture.
   */
  const handleCaptureButton = useCallback(async () => {
    if (isCapturing) {
      fxTap();
      // Stop capture & merge any background points recorded with screen off
      if (watchIdRef.current !== null) {
        const bgPoints = await stopTracking(watchIdRef.current);
        watchIdRef.current = null;
        if (Array.isArray(bgPoints) && bgPoints.length > 0) {
          const existingTs = new Set(pointsRef.current.map((p) => Math.floor((p.timestamp || 0) / 1000)));
          const extras = bgPoints.filter((bp) => {
            const acc = typeof bp.accuracy === 'number' ? bp.accuracy : 20;
            const bucket = Math.floor((bp.timestamp || 0) / 1000);
            return acc <= 25 && !existingTs.has(bucket);
          });
          if (extras.length > 0) {
            pointsRef.current = [...pointsRef.current, ...extras].sort(
              (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
            );
            setGpsPoints([...pointsRef.current]);
            setPointCount(pointsRef.current.length);
            onTrackUpdate?.(pointsRef.current);
          }
        }
      }
      onCaptureToggle?.(false);

      if (pointsRef.current.length >= 2) {
        setShowSaveDialog(true);
      } else {
        toast.info('Captura muy corta. Graba al menos 2 puntos en movimiento para guardar.');
      }
    } else {
      if (!isAuthenticated) {
        toast.warning('Debes iniciar sesión para capturar rutas');
        return;
      }
      onCloseConfigModal?.();
    }
  }, [isCapturing, onCaptureToggle, isAuthenticated, onCloseConfigModal, onTrackUpdate, toast]);

  /**
   * Start GPS capture after requesting permissions & checking GPS state.
   */
  const startCapture = useCallback(async () => {
    if (!routeName.trim()) {
      setError('Ingresa el nombre del bus/ruta');
      return;
    }

    setError(null);
    setGpsNeedsSettings(false);
    const ready = await ensureLocationReady({ backgroundCapture: true });
    if (!ready.granted) {
      setError(ready.message || 'Debes autorizar el permiso de ubicación para grabar rutas.');
      return;
    }
    if (!ready.gpsEnabled) {
      setGpsNeedsSettings(true);
      setError('Enciende la ubicación (GPS) del teléfono para iniciar la captura.');
      return;
    }

    onCloseConfigModal?.();
    setGpsPoints([]);
    pointsRef.current = [];
    setPointCount(0);
    startTimeRef.current = Date.now();
    fxCaptureStart();

    watchIdRef.current = startTracking(
      (position) => {
        const point = {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          timestamp: position.timestamp,
        };
        pointsRef.current.push(point);
        setGpsPoints(prev => [...prev, point]);
        setPointCount(prev => prev + 1);
        setAccuracy(position.accuracy);
        onPositionUpdate?.(point);
        onTrackUpdate?.(pointsRef.current);
      },
      (err) => {
        setError(err.message);
        console.error('Error GPS:', err);
      },
      {
        foregroundCapture: true,
        routeName: routeName.trim(),
        company: routeCompany,
        maxAccuracy: 25,
        minInterval: 4000,
        minDistanceMeters: 8,
      }
    );

    onCaptureToggle?.(true);
  }, [routeName, routeCompany, onCloseConfigModal, onCaptureToggle, onPositionUpdate, onTrackUpdate]);

  // Collaborative feedback state
  const [collabFeedback, setCollabFeedback] = useState(null);

  /**
   * Save captured route to backend.
   */
  const saveRoute = async () => {
    if (!routeName.trim()) {
      setError('Ingresa un nombre para la ruta');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const coordinates = pointsRef.current.map(p => [p.lng, p.lat]);
      const avgAccuracy = pointsRef.current.reduce((sum, p) => sum + p.accuracy, 0) / pointsRef.current.length;
      const durationSeconds = Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000);

      const result = await routesAPI.capture({
        routeName,
        company: routeCompany,
        direction: routeDirection,
        coordinates,
        averageAccuracy: Math.round(avgAccuracy * 10) / 10,
        durationSeconds,
      });

      // Show collaborative feedback if available
      if (result?.data?.collaborative) {
        setCollabFeedback({
          ...result.data.collaborative,
          routeName,
          company: routeCompany,
          direction: routeDirection,
          pointsCaptured: pointsRef.current.length,
        });
        setShowSaveDialog(false);
      } else {
        // Fallback to simple confirmation
        setShowSaveDialog(false);
        setCollabFeedback({
          routeName,
          company: routeCompany,
          direction: routeDirection,
          pointsCaptured: pointsRef.current.length,
          contributionPercent: 100,
          routeCompletion: 0,
          totalContributors: 1,
          totalSegments: 1,
          mergeType: 'new',
        });
      }

      // Reset capture state
      fxCaptureSaved();
      pointsRef.current = [];
      setGpsPoints([]);
      setPointCount(0);
      startTimeRef.current = null;
      onTrackUpdate?.([]);
    } catch (err) {
      setError(err.message || 'Error al guardar la ruta');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Dismiss collaborative feedback and fully reset.
   */
  const dismissFeedback = () => {
    setCollabFeedback(null);
    setRouteName('');
    setRouteCompany('Sobrusa');
    setRouteDirection('ida');
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        stopTracking(watchIdRef.current);
      }
    };
  }, []);

  const signal = accuracy ? getSignalQuality(accuracy) : null;

  if (!isCapturing && !showSaveDialog && !showConfigModal && !collabFeedback) return null;

  return (
    <>
      {/* ======= PRE-CAPTURE CONFIG MODAL ======= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(13, 16, 20, 0.65)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
            onClick={() => onCloseConfigModal?.()}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 animate-slide-up rq-card"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}
          >
            <button
              type="button"
              onClick={() => onCloseConfigModal?.()}
              className="absolute top-3 right-3 rq-icon-btn w-8 h-8"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255, 194, 26, 0.14)',
                border: '1px solid rgba(255, 194, 26, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand)',
              }}>
                <Bus size={17} />
              </div>
              <div>
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Capturar ruta
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0' }}>
                  Configura antes de iniciar la grabación GPS
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Route name */}
              <div>
                <label className="rq-section-label" style={{ marginBottom: 5, display: 'block' }}>
                  Nombre del bus / ruta
                </label>
                <input
                  type="text" value={routeName}
                  onChange={e => setRouteName(e.target.value)}
                  placeholder="Ej: C20 - Cra 38, Ruta 5 Norte"
                  className="rq-input"
                  autoFocus
                />
              </div>

              {/* Company */}
              <div>
                <label className="rq-section-label" style={{ marginBottom: 5, display: 'block' }}>
                  Empresa de transporte
                </label>
                <select
                  value={COMPANIES.includes(routeCompany) ? routeCompany : 'Otra'}
                  onChange={e => setRouteCompany(e.target.value)}
                  className="rq-input"
                  style={{ marginBottom: (!COMPANIES.includes(routeCompany) || routeCompany === 'Otra') ? 8 : 0 }}
                >
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(!COMPANIES.includes(routeCompany) || routeCompany === 'Otra') && (
                  <input
                    type="text"
                    placeholder="Nombre de la empresa"
                    value={routeCompany === 'Otra' ? '' : routeCompany}
                    onChange={e => setRouteCompany(e.target.value)}
                    className="rq-input"
                  />
                )}
              </div>

              {/* Direction */}
              <div>
                <label className="rq-section-label" style={{ marginBottom: 6, display: 'block' }}>
                  Dirección del recorrido
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'ida', label: 'IDA', icon: <ArrowRight size={14} />, color: '#1F9D6B' },
                    { value: 'vuelta', label: 'VUELTA', icon: <ArrowLeft size={14} />, color: '#E5484D' },
                  ].map(opt => {
                    const active = routeDirection === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setRouteDirection(opt.value)}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                          background: active ? `${opt.color}16` : 'var(--bg-surface)',
                          border: `1.5px solid ${active ? opt.color : 'var(--border-color)'}`,
                          color: active ? opt.color : 'var(--text-muted)',
                          fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          transition: 'all 0.15s',
                        }}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="space-y-1.5">
                  <p style={{ fontSize: 11.5, color: 'var(--carnaval)', margin: 0 }}>{error}</p>
                  {gpsNeedsSettings && (
                    <button
                      type="button"
                      onClick={() => openDeviceLocationSettings()}
                      className="rq-chip"
                      style={{
                        fontSize: 11,
                        padding: '5px 10px',
                        color: 'var(--brand)',
                        borderColor: 'color-mix(in srgb, var(--brand) 42%, transparent)',
                      }}
                    >
                      <Crosshair size={12} /> Activar GPS del teléfono
                    </button>
                  )}
                </div>
              )}

              {/* Start button */}
              <button
                type="button"
                onClick={startCapture}
                disabled={!routeName.trim()}
                className="rq-btn-primary"
                style={{
                  width: '100%', padding: '12px',
                  fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: routeName.trim() ? 1 : 0.45,
                  cursor: routeName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Play size={14} /> Iniciar captura GPS
              </button>

              <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <MapPin size={11} style={{ flexShrink: 0, color: 'var(--mangle)' }} />
                Sube al bus antes de iniciar. El primer punto GPS será tu punto de abordaje.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======= RECORDING INDICATOR ======= */}
      {isCapturing && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-[calc(50%+180px)] z-[1090] rq-sheet rounded-2xl p-3 px-4 animate-slide-up w-[90%] max-w-[350px]"
          style={{ borderLeft: '4px solid var(--carnaval)' }}
        >
          <div className="flex items-center gap-3">
            <div className="gps-dot recording" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold tracking-wider" style={{ color: 'var(--carnaval)' }}>
                  GRABANDO
                </span>
                <span style={{
                  fontSize: 9.5, padding: '1px 6px', borderRadius: 5,
                  background: routeDirection === 'ida' ? 'rgba(31, 157, 107, 0.14)' : 'rgba(229, 72, 77, 0.14)',
                  color: routeDirection === 'ida' ? 'var(--mangle)' : 'var(--carnaval)',
                  fontWeight: 700, textTransform: 'uppercase',
                }}>
                  {routeDirection}
                </span>
                {signal && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{
                    background: `${signal.color}15`,
                    color: signal.color,
                    border: `1px solid ${signal.color}35`,
                  }}>
                    {signal.label}
                  </span>
                )}
              </div>
              <p className="truncate" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Bus size={11} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                <span className="truncate">{routeName} — {routeCompany}</span>
              </p>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[11px] font-mono tabular-nums flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <MapPin size={10} /> {pointCount} pts
                </span>
                {accuracy && (
                  <span className="text-[11px] font-mono tabular-nums flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Crosshair size={10} /> ±{accuracy.toFixed(0)}m
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCaptureButton}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                background: 'rgba(229, 72, 77, 0.14)',
                color: 'var(--carnaval)',
                border: '1px solid rgba(229, 72, 77, 0.35)',
              }}
            >
              Detener
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: 'var(--brand)' }}>
              <AlertTriangle size={12} />
              {error}
            </div>
          )}
        </div>
      )}

      {/* ======= SAVE CONFIRMATION ======= */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(13, 16, 20, 0.65)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
            onClick={() => setShowSaveDialog(false)}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 animate-slide-up rq-card"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}
          >
            <button
              type="button"
              onClick={() => setShowSaveDialog(false)}
              className="absolute top-3 right-3 rq-icon-btn w-8 h-8"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>

            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              Guardar captura
            </h3>
            <p className="tabular-nums font-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 16px' }}>
              {pointsRef.current.length} puntos capturados
            </p>

            {/* Summary */}
            <div style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 14,
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Bus size={14} color="var(--brand)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{routeName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Building2 size={11} />
                  {routeCompany}
                </span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700,
                  color: routeDirection === 'ida' ? 'var(--mangle)' : 'var(--carnaval)',
                }}>
                  {routeDirection === 'ida' ? 'IDA' : 'VUELTA'}
                </span>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 11.5, color: 'var(--carnaval)', marginBottom: 8 }}>{error}</p>
            )}

            <button
              type="button"
              onClick={saveRoute}
              disabled={saving}
              className="rq-btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                  style={{ animation: 'spin-slow 0.6s linear infinite' }} />
              ) : <Save size={14} />}
              {saving ? 'Guardando...' : 'Enviar para revisión'}
            </button>
          </div>
        </div>
      )}

      {/* ======= COLLABORATIVE FEEDBACK MODAL ======= */}
      {collabFeedback && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(13, 16, 20, 0.65)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
            onClick={dismissFeedback}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 animate-slide-up rq-card"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}
          >
            <button
              type="button"
              onClick={dismissFeedback}
              className="absolute top-3 right-3 rq-icon-btn w-8 h-8"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
                background: 'rgba(31, 157, 107, 0.14)',
                border: '1px solid rgba(31, 157, 107, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--mangle)',
              }}>
                <CheckCircle2 size={24} />
              </div>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Captura exitosa
              </h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Tu recorrido fue fusionado con la ruta colaborativa
              </p>
            </div>

            {/* Route info */}
            <div style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 14,
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Bus size={14} color="var(--brand)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {collabFeedback.routeName}
                </span>
              </div>
              <div className="tabular-nums font-mono" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 10.5, color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Building2 size={10} /> {collabFeedback.company}
                </span>
                <span style={{
                  fontWeight: 700,
                  color: collabFeedback.direction === 'ida' ? 'var(--mangle)' : 'var(--carnaval)',
                }}>
                  {collabFeedback.direction === 'ida' ? 'IDA' : 'VUELTA'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={10} /> {collabFeedback.pointsCaptured} pts
                </span>
              </div>
            </div>

            {/* Contribution metrics */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(31, 157, 107, 0.08)', border: '1px solid rgba(31, 157, 107, 0.25)',
                textAlign: 'center',
              }}>
                <TrendingUp size={15} color="var(--mangle)" style={{ margin: '0 auto 4px' }} />
                <div className="tabular-nums font-mono" style={{ fontSize: 19, fontWeight: 700, color: 'var(--mangle)' }}>
                  {collabFeedback.contributionPercent}%
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>TU APORTE</div>
              </div>

              <div style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(59, 139, 240, 0.08)', border: '1px solid rgba(59, 139, 240, 0.25)',
                textAlign: 'center',
              }}>
                <Users size={15} color="var(--caribe)" style={{ margin: '0 auto 4px' }} />
                <div className="tabular-nums font-mono" style={{ fontSize: 19, fontWeight: 700, color: 'var(--caribe)' }}>
                  {collabFeedback.totalContributors}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {collabFeedback.totalContributors === 1 ? 'PIONERO' : 'CONTRIBUIDORES'}
                </div>
              </div>
            </div>

            {/* Route completion progress bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Progreso de ruta</span>
                <span className="tabular-nums font-mono" style={{
                  fontSize: 12, fontWeight: 700,
                  color: collabFeedback.routeCompletion >= 90 ? 'var(--mangle)'
                       : collabFeedback.routeCompletion >= 50 ? 'var(--brand)' : 'var(--caribe)',
                }}>
                  {collabFeedback.routeCompletion}%
                </span>
              </div>
              <div style={{
                width: '100%', height: 6, borderRadius: 3,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${collabFeedback.routeCompletion}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: collabFeedback.routeCompletion >= 90
                    ? 'var(--mangle)'
                    : collabFeedback.routeCompletion >= 50
                    ? 'var(--brand)'
                    : 'var(--caribe)',
                  transition: 'width 1s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <span className="tabular-nums font-mono" style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                  {collabFeedback.totalSegments} segmento{collabFeedback.totalSegments > 1 ? 's' : ''} capturado{collabFeedback.totalSegments > 1 ? 's' : ''}
                </span>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: collabFeedback.mergeType === 'new' ? 'rgba(255, 194, 26, 0.14)' : 'rgba(31, 157, 107, 0.14)',
                  color: collabFeedback.mergeType === 'new' ? 'var(--brand)' : 'var(--mangle)',
                }}>
                  {{
                    'new': 'Primera captura',
                    'append': 'Extendida al final',
                    'prepend': 'Extendida al inicio',
                    'replace': 'Mejorada',
                    'fill': 'Vacío llenado',
                    'encompass': 'Ruta ampliada',
                    'overlap_kept': 'Ya cubierto',
                    'disjoint': 'Segmento separado',
                  }[collabFeedback.mergeType] || 'Fusionada'}
                </span>
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={dismissFeedback}
              className="rq-btn-primary w-full flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} />
              Entendido
            </button>

            <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', margin: '10px 0 0' }}>
              {collabFeedback.routeCompletion < 100
                ? 'Invita a otros pasajeros a capturar los tramos faltantes.'
                : 'La ruta está completa. Un administrador la revisará pronto.'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
