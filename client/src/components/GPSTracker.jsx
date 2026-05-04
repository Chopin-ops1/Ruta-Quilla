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
import { Navigation, Satellite, Signal, Save, X, AlertTriangle, Bus, ArrowRight, ArrowLeft, Play, Users, TrendingUp, CheckCircle2 } from 'lucide-react';
import { startTracking, stopTracking, getSignalQuality, isGeolocationAvailable } from '../services/gpsService';
import { routesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const COMPANIES = [
  'Sobrusa', 'Coolitoral', 'Transmecar', 'Sobusa',
  'Cootransnorte', 'Embusa', 'Flota Angulo', 'Sodis',
  'Lolaya', 'Lucero San Felipe', 'Coochofal', 'Cootrasol',
  'La Carolina', 'Alianza', 'Otra',
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

  const watchIdRef = useRef(null);
  const pointsRef = useRef([]);
  const startTimeRef = useRef(null);

  const gpsAvailable = isGeolocationAvailable();

  /**
   * Open config modal before starting capture.
   */
  const handleCaptureButton = useCallback(() => {
    if (isCapturing) {
      // Stop capture
      if (watchIdRef.current !== null) {
        stopTracking(watchIdRef.current);
        watchIdRef.current = null;
      }
      onCaptureToggle?.(false);

      if (pointsRef.current.length >= 2) {
        setShowSaveDialog(true);
      }
    } else {
      // Show config first (this is handled by App.jsx now, so this might be unused, but kept for compatibility)
      if (!isAuthenticated) {
        alert('Debes iniciar sesión para capturar rutas');
        return;
      }
      onCloseConfigModal?.(); // Just in case, though it's not the opener
    }
  }, [isCapturing, onCaptureToggle, isAuthenticated, onCloseConfigModal]);

  /**
   * Start GPS capture after config is filled.
   */
  const startCapture = useCallback(() => {
    if (!routeName.trim()) {
      setError('Ingresa el nombre del bus/ruta');
      return;
    }

    onCloseConfigModal?.();
    setError(null);
    setGpsPoints([]);
    pointsRef.current = [];
    setPointCount(0);
    startTimeRef.current = Date.now();

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
      { maxAccuracy: 20, minInterval: 5000 }
    );

    onCaptureToggle?.(true);
  }, [routeName, onCaptureToggle, onPositionUpdate, onTrackUpdate]);

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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onCloseConfigModal?.()} />
          <div className="relative w-full max-w-sm rounded-2xl p-6 animate-slide-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>

            <button onClick={() => onCloseConfigModal?.()} className="absolute top-3 right-3 btn-icon w-8 h-8">
              <X size={14} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bus size={18} color="#F59E0B" />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                  Capturar ruta
                </h3>
                <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>
                  Configura antes de iniciar la grabación GPS
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Route name */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
                  Nombre del bus / ruta
                </label>
                <input
                  type="text" value={routeName}
                  onChange={e => setRouteName(e.target.value)}
                  placeholder="Ej: C20 - Cra 38, Ruta 5 Norte"
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Company */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
                  Empresa de transporte
                </label>
                <select value={routeCompany} onChange={e => setRouteCompany(e.target.value)} className="input-field">
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Direction */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 6, display: 'block' }}>
                  Dirección del recorrido
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'ida', label: 'IDA', icon: <ArrowRight size={14} />, color: '#10B981' },
                    { value: 'vuelta', label: 'VUELTA', icon: <ArrowLeft size={14} />, color: '#8B5CF6' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setRouteDirection(opt.value)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                        background: routeDirection === opt.value ? `${opt.color}15` : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${routeDirection === opt.value ? opt.color + '50' : 'rgba(255,255,255,0.08)'}`,
                        color: routeDirection === opt.value ? opt.color : '#64748B',
                        fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p style={{ fontSize: 11, color: '#EF4444', margin: 0 }}>{error}</p>
              )}

              {/* Start button */}
              <button
                onClick={startCapture}
                disabled={!routeName.trim()}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                  background: routeName.trim()
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : 'rgba(255,255,255,0.05)',
                  color: routeName.trim() ? '#000' : '#475569',
                  fontSize: 13, fontWeight: 700, cursor: routeName.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: routeName.trim() ? '0 4px 16px rgba(245,158,11,0.3)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <Play size={14} /> Iniciar captura GPS
              </button>

              <p style={{ fontSize: 9, color: '#334155', textAlign: 'center', margin: 0 }}>
                📍 Sube al bus antes de iniciar. El primer punto GPS será tu punto de abordaje.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======= RECORDING INDICATOR ======= */}
      {isCapturing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-[calc(50%+160px)] z-[1090] glass-strong rounded-2xl p-3 px-4 animate-slide-up w-[90%] max-w-[340px]">
          <div className="flex items-center gap-3">
            <div className="gps-dot recording" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: '#F87171' }}>
                  GRABANDO
                </span>
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 6,
                  background: routeDirection === 'ida' ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.12)',
                  color: routeDirection === 'ida' ? '#34D399' : '#A78BFA',
                  fontWeight: 700, textTransform: 'uppercase',
                }}>
                  {routeDirection}
                </span>
                {signal && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                    background: `${signal.color}15`,
                    color: signal.color,
                    border: `1px solid ${signal.color}30`,
                  }}>
                    GPS: {signal.label}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>
                🚌 {routeName} — {routeCompany}
              </p>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  📍 {pointCount} puntos
                </span>
                {accuracy && (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    🎯 ±{accuracy.toFixed(0)}m
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleCaptureButton}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              Detener
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: '#FBBF24' }}>
              <AlertTriangle size={12} />
              {error}
            </div>
          )}
        </div>
      )}

      {/* ======= SAVE CONFIRMATION ======= */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSaveDialog(false)} />
          <div className="relative w-full max-w-sm rounded-2xl p-6 animate-slide-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
            
            <button onClick={() => setShowSaveDialog(false)} className="absolute top-3 right-3 btn-icon w-8 h-8">
              <X size={14} />
            </button>

            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', fontFamily: 'Outfit, sans-serif', color: '#F1F5F9' }}>
              Guardar captura
            </h3>
            <p style={{ fontSize: 11, color: '#475569', margin: '0 0 16px' }}>
              {pointsRef.current.length} puntos capturados
            </p>

            {/* Summary */}
            <div style={{
              padding: '10px 12px', borderRadius: 12, marginBottom: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Bus size={14} color="#F59E0B" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9' }}>{routeName}</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>🏢 {routeCompany}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: routeDirection === 'ida' ? '#34D399' : '#A78BFA',
                }}>
                  {routeDirection === 'ida' ? '→ IDA' : '← VUELTA'}
                </span>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 11, color: '#EF4444', marginBottom: 8 }}>{error}</p>
            )}

            <button
              onClick={saveRoute}
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2"
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismissFeedback} />
          <div className="relative w-full max-w-sm rounded-2xl p-6 animate-slide-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>

            <button onClick={dismissFeedback} className="absolute top-3 right-3 btn-icon w-8 h-8">
              <X size={14} />
            </button>

            {/* Header con icono de éxito */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.15))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(16,185,129,0.2)',
              }}>
                <CheckCircle2 size={28} color="#10B981" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                ¡Captura exitosa! 🎉
              </h3>
              <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
                Tu recorrido fue fusionado con la ruta colaborativa
              </p>
            </div>

            {/* Route info */}
            <div style={{
              padding: '10px 14px', borderRadius: 12, marginBottom: 14,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Bus size={14} color="#F59E0B" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>
                  {collabFeedback.routeName}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#94A3B8' }}>
                <span>🏢 {collabFeedback.company}</span>
                <span style={{
                  fontWeight: 600,
                  color: collabFeedback.direction === 'ida' ? '#34D399' : '#A78BFA',
                }}>
                  {collabFeedback.direction === 'ida' ? '→ IDA' : '← VUELTA'}
                </span>
                <span>📍 {collabFeedback.pointsCaptured} puntos</span>
              </div>
            </div>

            {/* Contribution metrics */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {/* Tu contribución */}
              <div style={{
                flex: 1, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                textAlign: 'center',
              }}>
                <TrendingUp size={16} color="#10B981" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981', fontFamily: 'Outfit, sans-serif' }}>
                  {collabFeedback.contributionPercent}%
                </div>
                <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>TU APORTE</div>
              </div>

              {/* Contribuidores */}
              <div style={{
                flex: 1, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
                textAlign: 'center',
              }}>
                <Users size={16} color="#A78BFA" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: 20, fontWeight: 800, color: '#A78BFA', fontFamily: 'Outfit, sans-serif' }}>
                  {collabFeedback.totalContributors}
                </div>
                <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>
                  {collabFeedback.totalContributors === 1 ? 'PIONERO 🏅' : 'CONTRIBUIDORES'}
                </div>
              </div>
            </div>

            {/* Route completion progress bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>Progreso de ruta</span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: collabFeedback.routeCompletion >= 90 ? '#10B981'
                       : collabFeedback.routeCompletion >= 50 ? '#F59E0B' : '#06B6D4',
                }}>
                  {collabFeedback.routeCompletion}%
                </span>
              </div>
              <div style={{
                width: '100%', height: 8, borderRadius: 4,
                background: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${collabFeedback.routeCompletion}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: collabFeedback.routeCompletion >= 90
                    ? 'linear-gradient(90deg, #10B981, #34D399)'
                    : collabFeedback.routeCompletion >= 50
                    ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                    : 'linear-gradient(90deg, #06B6D4, #22D3EE)',
                  transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 0 8px rgba(16,185,129,0.3)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 9, color: '#475569' }}>
                  {collabFeedback.totalSegments} segmento{collabFeedback.totalSegments > 1 ? 's' : ''} capturado{collabFeedback.totalSegments > 1 ? 's' : ''}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                  background: collabFeedback.mergeType === 'new' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                  color: collabFeedback.mergeType === 'new' ? '#F59E0B' : '#10B981',
                }}>
                  {{
                    'new': '🆕 Primera captura',
                    'append': '➕ Extendida al final',
                    'prepend': '➕ Extendida al inicio',
                    'replace': '🔄 Mejorada',
                    'fill': '🧩 Vacío llenado',
                    'encompass': '🌐 Ruta ampliada',
                    'overlap_kept': '✅ Ya cubierto',
                    'disjoint': '📌 Segmento separado',
                  }[collabFeedback.mergeType] || '✅ Fusionada'}
                </span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={dismissFeedback}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} />
              ¡Entendido!
            </button>

            <p style={{ fontSize: 9, color: '#334155', textAlign: 'center', margin: '10px 0 0' }}>
              {collabFeedback.routeCompletion < 100
                ? '🚌 ¡Invita a otros pasajeros a capturar los tramos faltantes!'
                : '🎉 ¡La ruta está completa! Un admin la revisará pronto.'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
