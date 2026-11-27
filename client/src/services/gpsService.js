/**
 * ============================================
 * RutaQuilla - Servicio GPS (Híbrido Web + Android Nativo)
 * ============================================
 *
 * - En Android nativo: usa @capacitor/geolocation y el plugin NativeLocation
 *   (Foreground Service con notificación persistente para seguir capturando rutas
 *   incluso con la pantalla bloqueada o la app en segundo plano).
 * - En Web: usa navigator.geolocation con filtros de precisión y muestreo.
 */

import { registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { isNativeApp, isAndroidPlatform } from '../utils/platform';

const NativeLocation = registerPlugin('NativeLocation');

const activeTrackers = new Map();
let nextTrackerId = 1;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isGeolocationAvailable() {
  if (isNativeApp()) return true;
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Solicita permisos de ubicación y verifica si el GPS del dispositivo está encendido.
 */
export async function ensureLocationReady({ backgroundCapture = false } = {}) {
  if (isAndroidPlatform()) {
    try {
      const res = await NativeLocation.checkAndRequestPermissions({ backgroundCapture });
      return {
        granted: Boolean(res?.granted),
        gpsEnabled: res?.gpsEnabled !== false,
        canAskAgain: res?.canAskAgain !== false,
        message: res?.message || '',
      };
    } catch (_) {
      try {
        const perm = await Geolocation.requestPermissions();
        const granted = perm?.location === 'granted' || perm?.coarseLocation === 'granted';
        return {
          granted,
          gpsEnabled: true,
          canAskAgain: true,
          message: granted ? '' : 'Permiso de ubicación necesario para continuar.',
        };
      } catch (err) {
        return {
          granted: false,
          gpsEnabled: false,
          canAskAgain: true,
          message: err?.message || 'No se pudo solicitar permiso de ubicación.',
        };
      }
    }
  }

  if (isNativeApp()) {
    try {
      const perm = await Geolocation.requestPermissions();
      const granted = perm?.location === 'granted' || perm?.coarseLocation === 'granted';
      return { granted, gpsEnabled: true, canAskAgain: true, message: '' };
    } catch {
      return { granted: false, gpsEnabled: false, canAskAgain: true, message: 'Permiso de ubicación requerido.' };
    }
  }

  if (!isGeolocationAvailable()) {
    return { granted: false, gpsEnabled: false, canAskAgain: false, message: 'Tu dispositivo no soporta GPS.' };
  }

  try {
    if (navigator.permissions?.query) {
      const st = await navigator.permissions.query({ name: 'geolocation' });
      if (st.state === 'denied') {
        return {
          granted: false,
          gpsEnabled: true,
          canAskAgain: false,
          message: 'Permiso de ubicación bloqueado. Actívalo en ajustes.',
        };
      }
    }
  } catch (_) {}

  return { granted: true, gpsEnabled: true, canAskAgain: true, message: '' };
}

export async function openDeviceLocationSettings() {
  if (isAndroidPlatform()) {
    try {
      await NativeLocation.openLocationSettings();
      return true;
    } catch (_) {}
  }
  return false;
}

/**
 * Obtiene la posición actual del usuario (una vez).
 */
export async function getCurrentPosition() {
  if (!isGeolocationAvailable()) {
    throw new Error('La geolocalización no está disponible en este dispositivo.');
  }

  if (isNativeApp()) {
    const ready = await ensureLocationReady({ backgroundCapture: false });
    if (!ready.granted) {
      throw new Error(ready.message || 'Activa el permiso de ubicación para centrar el mapa.');
    }
    if (!ready.gpsEnabled) {
      throw new Error('Activa el GPS del teléfono para detectar tu ubicación.');
    }
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      };
    } catch (err) {
      throw formatGeolocationError(err);
    }
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(formatGeolocationError(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Inicia el rastreo continuo de posición GPS.
 * Si foregroundCapture === true en Android, inicia Foreground Service persistente.
 */
export function startTracking(onPosition, onError, options = {}) {
  const {
    maxAccuracy = 25,
    minInterval = 4500,
    minDistanceMeters = 8,
    foregroundCapture = false,
    routeName = 'Ruta en vivo',
    company = 'RutaQuilla',
  } = options;

  const trackerId = nextTrackerId++;
  const state = {
    type: 'web',
    cancelled: false,
    webWatchId: null,
    capWatchId: null,
    listener: null,
    lastCaptureTime: 0,
    lastPoint: null,
    acceptedCount: 0,
  };
  activeTrackers.set(trackerId, state);

  const acceptRawPoint = (lat, lng, accuracy, timestamp = Date.now()) => {
    if (state.cancelled) return;
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const acc = typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : 20;
    if (acc > maxAccuracy) return;

    const now = Date.now();
    if (now - state.lastCaptureTime < minInterval) return;

    if (state.lastPoint && minDistanceMeters > 0) {
      const moved = haversineMeters(state.lastPoint.lat, state.lastPoint.lng, lat, lng);
      if (moved < minDistanceMeters) return;
    }

    state.lastCaptureTime = now;
    state.lastPoint = { lat, lng };
    state.acceptedCount += 1;

    if (state.type === 'native-fg' && isAndroidPlatform()) {
      NativeLocation.updateCaptureNotification({ points: state.acceptedCount }).catch(() => {});
    }

    onPosition({
      lat,
      lng,
      accuracy: acc,
      timestamp,
      coordinate: [
        Math.round(lng * 1e6) / 1e6,
        Math.round(lat * 1e6) / 1e6,
      ],
    });
  };

  if (foregroundCapture && isAndroidPlatform()) {
    state.type = 'native-fg';
    (async () => {
      try {
        const ready = await ensureLocationReady({ backgroundCapture: true });
        if (state.cancelled) return;
        if (!ready.granted) {
          onError?.(new Error(ready.message || 'Permiso de ubicación necesario para capturar la ruta.'));
          return;
        }
        if (!ready.gpsEnabled) {
          onError?.(new Error('El GPS está desactivado. Enciende la ubicación del teléfono.'));
          return;
        }

        const listener = await NativeLocation.addListener('locationUpdate', (loc) => {
          acceptRawPoint(loc.lat, loc.lng, loc.accuracy, loc.timestamp || Date.now());
        });
        if (state.cancelled) {
          listener.remove();
          return;
        }
        state.listener = listener;

        await NativeLocation.startForegroundCapture({ routeName, company });
      } catch (err) {
        if (!state.cancelled) {
          onError?.(formatGeolocationError(err));
        }
      }
    })();
    return trackerId;
  }

  if (isNativeApp()) {
    state.type = 'capacitor';
    (async () => {
      try {
        const ready = await ensureLocationReady({ backgroundCapture: false });
        if (state.cancelled) return;
        if (!ready.granted) {
          onError?.(new Error(ready.message || 'Permiso de ubicación requerido.'));
          return;
        }
        const watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          (pos, err) => {
            if (state.cancelled) return;
            if (err) {
              onError?.(formatGeolocationError(err));
              return;
            }
            if (pos?.coords) {
              acceptRawPoint(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.timestamp);
            }
          }
        );
        if (state.cancelled) {
          Geolocation.clearWatch({ id: watchId }).catch(() => {});
          return;
        }
        state.capWatchId = watchId;
      } catch (err) {
        if (!state.cancelled) {
          onError?.(formatGeolocationError(err));
        }
      }
    })();
    return trackerId;
  }

  if (!isGeolocationAvailable()) {
    onError?.(new Error('GPS no disponible en este dispositivo.'));
    return trackerId;
  }

  state.webWatchId = navigator.geolocation.watchPosition(
    (position) => {
      acceptRawPoint(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy,
        position.timestamp
      );
    },
    (error) => {
      onError?.(formatGeolocationError(error));
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );

  return trackerId;
}

/**
 * Detiene el rastreo GPS. En captura Android con Foreground Service devuelve
 * cualquier punto capturado en segundo plano mientras la pantalla estuvo bloqueada.
 */
export async function stopTracking(trackerId) {
  if (trackerId === null || trackerId === undefined) return [];
  const state = activeTrackers.get(trackerId);
  if (!state) return [];
  activeTrackers.delete(trackerId);
  state.cancelled = true;

  if (state.type === 'web' && state.webWatchId !== null) {
    try {
      navigator.geolocation.clearWatch(state.webWatchId);
    } catch (_) {}
    return [];
  }

  if (state.type === 'capacitor' && state.capWatchId !== null) {
    try {
      await Geolocation.clearWatch({ id: state.capWatchId });
    } catch (_) {}
    return [];
  }

  if (state.type === 'native-fg' && isAndroidPlatform()) {
    try {
      if (state.listener) {
        await state.listener.remove();
      }
      const res = await NativeLocation.stopForegroundCapture();
      return Array.isArray(res?.bufferedPoints) ? res.bufferedPoints : [];
    } catch (_) {
      return [];
    }
  }

  return [];
}

/**
 * Calcula la calidad de la señal GPS basada en la precisión.
 */
export function getSignalQuality(accuracy) {
  if (accuracy <= 8) {
    return { quality: 'excellent', color: '#1F9D6B', label: 'Excelente' };
  }
  if (accuracy <= 16) {
    return { quality: 'good', color: '#3B8BF0', label: 'Buena' };
  }
  if (accuracy <= 25) {
    return { quality: 'fair', color: '#FFC21A', label: 'Aceptable' };
  }
  return { quality: 'poor', color: '#E5484D', label: 'Débil' };
}

function formatGeolocationError(error) {
  if (error instanceof Error && error.message && !error.code) {
    return error;
  }
  const code = error?.code;
  const nativeMsg = isNativeApp()
    ? 'Permiso de ubicación denegado. Actívalo en los ajustes de la app.'
    : 'Permiso de ubicación denegado. Habilita la ubicación en tu dispositivo.';

  const messages = {
    1: nativeMsg,
    2: 'No se pudo obtener tu ubicación. Verifica que el GPS esté encendido.',
    3: 'Tiempo de espera agotado buscando señal GPS.',
  };

  return new Error(messages[code] || error?.message || 'No se pudo obtener la ubicación GPS');
}

export default {
  isGeolocationAvailable,
  ensureLocationReady,
  openDeviceLocationSettings,
  getCurrentPosition,
  startTracking,
  stopTracking,
  getSignalQuality,
};
