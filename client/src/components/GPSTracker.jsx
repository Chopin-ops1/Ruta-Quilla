/**
 * ============================================
 * RutaQuilla - GPSTracker (Rastreo GPS)
 * ============================================
 * 
 * Componente de control del rastreo GPS que:
 * - Muestra estado del GPS en tiempo real
 * - Permite iniciar/detener la captura de ruta
 * - Solicita nombre y empresa antes de guardar
 * - Envía coordenadas capturadas al backend
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Navigation, Satellite, Signal, Save, X, AlertTriangle } from 'lucide-react';
import { startTracking, stopTracking, getSignalQuality, isGeolocationAvailable } from '../services/gpsService';
import { routesAPI } from '../services/api';

export default function GPSTracker({
  isCapturing,
  onCaptureToggle,
  onPositionUpdate,
  onTrackUpdate,
}) {
  const [gpsPoints, setGpsPoints] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [pointCount, setPointCount] = useState(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeCompany, setRouteCompany] = useState('Sobrusa');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const pointsRef = useRef([]);

  // Verificar disponibilidad de GPS
  const gpsAvailable = isGeolocationAvailable();

  /**
   * Iniciar o detener la captura GPS.
   */
  const toggleCapture = useCallback(() => {
    if (isCapturing) {
      // Detener captura
      if (watchIdRef.current !== null) {
        stopTracking(watchIdRef.current);
        watchIdRef.current = null;
      }
      onCaptureToggle?.(false);

      // Si hay suficientes puntos, mostrar diálogo de guardado
      if (pointsRef.current.length >= 2) {
        setShowSaveDialog(true);
      }
    } else {
      // Iniciar captura
      setError(null);
      setGpsPoints([]);
      pointsRef.current = [];
      setPointCount(0);

      watchIdRef.current = startTracking(
        // Callback de posición válida
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
        // Callback de error
        (err) => {
          setError(err.message);
          console.error('Error GPS:', err);
        },
        {
          maxAccuracy: 20,    // Filtro: descartar accuracy > 20m
          minInterval: 5000,  // Captura cada 5 segundos
        }
      );

      onCaptureToggle?.(true);
    }
  }, [isCapturing, onCaptureToggle, onPositionUpdate, onTrackUpdate]);

  /**
   * Guardar la ruta capturada en el servidor.
   */
  const saveRoute = async () => {
    if (!routeName.trim()) {
      setError('Ingresa un nombre para la ruta');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Convertir puntos a coordenadas GeoJSON [lng, lat]
      const coordinates = pointsRef.current.map(p => [p.lng, p.lat]);
      const avgAccuracy = pointsRef.current.reduce((sum, p) => sum + p.accuracy, 0) / pointsRef.current.length;

      await routesAPI.capture({
        name: routeName,
        company: routeCompany,
        coordinates,
        averageAccuracy: Math.round(avgAccuracy * 10) / 10,
      });

      // Reset
      setShowSaveDialog(false);
      setRouteName('');
      pointsRef.current = [];
      setGpsPoints([]);
      setPointCount(0);
      onTrackUpdate?.([]);

      // Notificar éxito (podrías usar un toast aquí)
      alert('¡Ruta guardada exitosamente! 🎉');
    } catch (err) {
      setError(err.message || 'Error al guardar la ruta');
    } finally {
      setSaving(false);
    }
  };

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        stopTracking(watchIdRef.current);
      }
    };
  }, []);

  const signal = accuracy ? getSignalQuality(accuracy) : null;

  // Floating GPS status (aparece solo durante la captura)
  if (!isCapturing && !showSaveDialog) return null;

  return (
    <>
      {/* Indicador de captura GPS flotante */}
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
                  GRABANDO RUTA
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
              onClick={toggleCapture}
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

      {/* Diálogo de guardado */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSaveDialog(false)} />
          <div className="relative w-full max-w-sm rounded-2xl p-6 animate-slide-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
            
            <button
              onClick={() => setShowSaveDialog(false)}
              className="absolute top-3 right-3 btn-icon w-8 h-8"
            >
              <X size={14} />
            </button>

            <h3 className="text-base font-bold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Guardar ruta
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {pointsRef.current.length} puntos capturados
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Nombre de la ruta
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={e => setRouteName(e.target.value)}
                  placeholder="Ej: Sobrusa Vía 40 Norte"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Empresa
                </label>
                <select
                  value={routeCompany}
                  onChange={e => setRouteCompany(e.target.value)}
                  className="input-field"
                >
                  <option value="Sobrusa">Sobrusa</option>
                  <option value="Coolitoral">Coolitoral</option>
                  <option value="Transmecar">Transmecar</option>
                  <option value="Sobusa">Sobusa</option>
                  <option value="Alianza">Alianza</option>
                  <option value="Otra">Otra</option>
                </select>
              </div>

              {error && (
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
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
                {saving ? 'Guardando...' : 'Guardar ruta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
