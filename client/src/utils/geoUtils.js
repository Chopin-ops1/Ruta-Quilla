/**
 * ============================================
 * RutaQuilla - Utilidades GeoJSON
 * ============================================
 * 
 * Funciones de validación y transformación para
 * datos geoespaciales en formato GeoJSON.
 */

/**
 * Valida que un array de coordenadas sea un LineString GeoJSON válido.
 * 
 * Reglas de validación:
 * - Mínimo 2 puntos
 * - Cada punto debe ser [lng, lat]
 * - Longitud: -180 a 180
 * - Latitud: -90 a 90
 * 
 * @param {Array} coordinates - Array de [lng, lat]
 * @returns {{ valid: boolean, errors: string[], cleaned: Array }}
 */
export function validateLineString(coordinates) {
  const errors = [];
  const cleaned = [];

  if (!Array.isArray(coordinates)) {
    return { valid: false, errors: ['Las coordenadas deben ser un array'], cleaned: [] };
  }

  if (coordinates.length < 2) {
    return { valid: false, errors: ['Se necesitan al menos 2 coordenadas'], cleaned: [] };
  }

  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i];
    
    if (!Array.isArray(coord) || coord.length !== 2) {
      errors.push(`Coordenada ${i}: formato inválido, se espera [lng, lat]`);
      continue;
    }

    const [lng, lat] = coord;

    if (typeof lng !== 'number' || typeof lat !== 'number') {
      errors.push(`Coordenada ${i}: valores deben ser numéricos`);
      continue;
    }

    if (lng < -180 || lng > 180) {
      errors.push(`Coordenada ${i}: longitud ${lng} fuera de rango [-180, 180]`);
      continue;
    }

    if (lat < -90 || lat > 90) {
      errors.push(`Coordenada ${i}: latitud ${lat} fuera de rango [-90, 90]`);
      continue;
    }

    // Reducir precisión a 6 decimales (~0.11m)
    cleaned.push([
      Math.round(lng * 1e6) / 1e6,
      Math.round(lat * 1e6) / 1e6,
    ]);
  }

  return {
    valid: cleaned.length >= 2 && errors.length === 0,
    errors,
    cleaned,
  };
}

/**
 * Fórmula de Haversine para calcular la distancia entre dos puntos
 * en la superficie de la Tierra.
 * 
 * @param {number} lat1 - Latitud punto 1
 * @param {number} lng1 - Longitud punto 1
 * @param {number} lat2 - Latitud punto 2
 * @param {number} lng2 - Longitud punto 2
 * @returns {number} Distancia en metros
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Calcula la distancia total de un LineString en kilómetros.
 * 
 * @param {Array} coordinates - Array de [lng, lat]
 * @returns {number} Distancia en km
 */
export function getRouteLength(coordinates) {
  if (!coordinates || coordinates.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistance(
      coordinates[i][1], coordinates[i][0],
      coordinates[i + 1][1], coordinates[i + 1][0]
    );
  }

  return Math.round(total) / 1000; // Convertir a km
}

/**
 * Formatea distancia para mostrar en la UI.
 * 
 * @param {number} meters - Distancia en metros
 * @returns {string} Distancia formateada (ej: "500m" o "1.2km")
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Obtiene el centro geográfico de un array de coordenadas.
 * Útil para centrar el mapa en una ruta.
 * 
 * @param {Array} coordinates - Array de [lng, lat]
 * @returns {[number, number]} [lat, lng] para Leaflet
 */
export function getCenter(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    // Centro de Barranquilla por defecto
    return [10.9878, -74.7889];
  }

  let totalLat = 0;
  let totalLng = 0;

  coordinates.forEach(([lng, lat]) => {
    totalLat += lat;
    totalLng += lng;
  });

  return [
    totalLat / coordinates.length,
    totalLng / coordinates.length,
  ];
}

export default {
  validateLineString,
  haversineDistance,
  getRouteLength,
  formatDistance,
  getCenter,
};
