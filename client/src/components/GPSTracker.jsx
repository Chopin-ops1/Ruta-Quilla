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
import { Navigation, Satellite, Signal, Save, X, AlertTriangle, Bus, ArrowRight, ArrowLeft, Play } from 'lucide-react';
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
}) {
  const { isAuthenticated } = useAuth();
  const [gpsPoints, setGpsPoints] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [pointCount, setPointCount] = useState(0);
  const [error, setError] = useState(null);

  // Pre-capture config modal
  const [showConfig, setShowConfig] = useState(false);
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
      // Show config first
      if (!isAuthenticated) {
        alert('Debes iniciar sesión para capturar rutas');
        return;
      }
      setShowConfig(true);
    }
  }, [isCapturing, onCaptureToggle, isAuthenticated]);

  /**
   * Start GPS capture after config is filled.
   */
  const startCapture = useCallback(() => {
    if (!routeName.trim()) {
      setError('Ingresa el nombre del bus/ruta');
      return;
    }

    setShowConfig(false);
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

      await routesAPI.capture({
        routeName,
        company: routeCompany,
        direction: routeDirection,
        coordinates,
        averageAccuracy: Math.round(avgAccuracy * 10) / 10,
        durationSeconds,
      });

      // Reset
      setShowSaveDialog(false);
      setRouteName('');
      setRouteCompany('Sobrusa');
      setRouteDirection('ida');
      pointsRef.current = [];
      setGpsPoints([]);
      setPointCount(0);
      startTimeRef.current = null;
      onTrackUpdate?.([]);

      alert('¡Ruta capturada! 🎉 Un administrador la revisará pronto.');
    } catch (err) {
      setError(err.message || 'Error al guardar la ruta');
    } finally {
      setSaving(false);
    }
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

  if (!isCapturing && !showSaveDialog && !showConfig) return null;

  return (
    <>
      {/* ======= PRE-CAPTURE CONFIG MODAL ======= */}
      {showConfig && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfig(false)} />
          <div className="relative w-full max-w-sm rounded-2xl p-6 animate-slide-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>

            <button onClick={() => setShowConfig(false)} className="absolute top-3 right-3 btn-icon w-8 h-8">
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
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-[calc(320px+50%)] md:-translate-x-1/2 z-[1090] glass-strong rounded-2xl p-3 px-5 animate-slide-up"
          style={{ minWidth: 280 }}
        >
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
    </>
  );
}
