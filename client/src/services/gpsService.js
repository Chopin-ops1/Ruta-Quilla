/**
 * ============================================
 * RutaQuilla - Servicio GPS (Geolocation API)
 * ============================================
 * 
 * Wrapper sobre la Geolocation API del navegador que:
 * 
 * 1. Captura coordenadas [lng, lat] cada 5 segundos
 * 2. Filtra puntos con precisión > 20 metros (ruido GPS)
 * 3. Calcula la calidad de señal GPS en tiempo real
 * 4. Mantiene un buffer de coordenadas para envío al servidor
 * 
 * Nota: La Geolocation API requiere HTTPS en producción.
 * En localhost funciona sin HTTPS (excepción del navegador).
 */

/**
 * Verifica si la Geolocation API está disponible.
 * @returns {boolean}
 */
export function isGeolocationAvailable() {
  return 'geolocation' in navigator;
}

/**
 * Obtiene la posición actual del usuario (una vez).
 * 
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!isGeolocationAvailable()) {
      reject(new Error('Geolocation no disponible en este navegador'));
      return;
    }

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
        enableHighAccuracy: true,  // Usar GPS real (no tower/wifi)
        timeout: 10000,            // Timeout de 10s
        maximumAge: 0,             // No usar cache
      }
    );
  });
}

/**
 * Inicia el rastreo continuo de posición GPS.
 * 
 * Utiliza watchPosition() para recibir actualizaciones
 * automáticas cuando el dispositivo se mueve.
 * 
 * El callback onPosition se llama con cada nuevo punto
 * que pase el filtro de precisión (≤ 20 metros).
 * 
 * @param {Function} onPosition - Callback con {lat, lng, accuracy}
 * @param {Function} onError - Callback con error
 * @param {object} options - Opciones de configuración
 * @returns {number} watchId para detener el rastreo
 */
export function startTracking(onPosition, onError, options = {}) {
  const {
    maxAccuracy = 20,           // Precisión máxima aceptable (metros)
    minInterval = 5000,         // Intervalo mínimo entre capturas (ms)
  } = options;

  let lastCaptureTime = 0;

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now();
      const { latitude, longitude, accuracy } = position.coords;

      /**
       * Filtro de precisión GPS:
       * Descartamos puntos con accuracy > maxAccuracy metros.
       * 
       * La propiedad 'accuracy' indica el radio de incertidumbre
       * en metros. Un valor de 5m significa que la posición real
       * está dentro de un círculo de 5m de radio.
       * 
       * En áreas urbanas densas como Barranquilla, los edificios
       * pueden causar reflexión de señal GPS (multipath), 
       * resultando en lecturas con accuracy > 50m que deben
       * descartarse para mantener la calidad de los datos.
       */
      if (accuracy > maxAccuracy) {
        console.warn(`📍 Punto descartado: accuracy ${accuracy.toFixed(1)}m > ${maxAccuracy}m`);
        return;
      }

      /**
       * Throttling temporal:
       * Solo capturamos un punto cada minInterval milisegundos
       * para evitar sobrecarga del buffer y del servidor.
       * 
       * En dispositivos con GPS rápido, watchPosition puede
       * disparar varias veces por segundo. Limitamos a 1 cada 5s.
       */
      if (now - lastCaptureTime < minInterval) {
        return;
      }

      lastCaptureTime = now;

      // Coordenadas en formato GeoJSON: [longitud, latitud]
      onPosition({
        lat: latitude,
        lng: longitude,
        accuracy: accuracy,
        timestamp: position.timestamp,
        // GeoJSON format para envío directo al servidor
        coordinate: [
          Math.round(longitude * 1e6) / 1e6,
          Math.round(latitude * 1e6) / 1e6,
        ],
      });
    },
    (error) => {
      if (onError) {
        onError(formatGeolocationError(error));
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );

  return watchId;
}

/**
 * Detiene el rastreo GPS.
 * @param {number} watchId - ID retornado por startTracking
 */
export function stopTracking(watchId) {
  if (watchId !== null && watchId !== undefined) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Calcula la calidad de la señal GPS basada en la precisión.
 * 
 * @param {number} accuracy - Precisión en metros
 * @returns {{ quality: string, color: string, label: string }}
 */
export function getSignalQuality(accuracy) {
  if (accuracy <= 5) {
    return { quality: 'excellent', color: '#10B981', label: 'Excelente' };
  }
  if (accuracy <= 10) {
    return { quality: 'good', color: '#22D3EE', label: 'Buena' };
  }
  if (accuracy <= 20) {
    return { quality: 'fair', color: '#FBBF24', label: 'Aceptable' };
  }
  return { quality: 'poor', color: '#EF4444', label: 'Débil' };
}

/**
 * Formatea errores de la Geolocation API a mensajes amigables.
 */
function formatGeolocationError(error) {
  const messages = {
    1: 'Permiso de ubicación denegado. Habilita el GPS en la configuración del navegador.',
    2: 'No se pudo determinar la ubicación. Verifica que el GPS esté activado.',
    3: 'Tiempo de espera agotado. La señal GPS es muy débil.',
  };

  return new Error(messages[error.code] || 'Error desconocido de geolocalización');
}

export default {
  isGeolocationAvailable,
  getCurrentPosition,
  startTracking,
  stopTracking,
  getSignalQuality,
};
