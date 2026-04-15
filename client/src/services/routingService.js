/**
 * ============================================
 * RutaQuilla - Routing Service
 * ============================================
 *
 * Integra servicios externos para:
 * 1. OSRM: Rutas reales que siguen las calles (caminar/conducir)
 * 2. Nominatim: Geocoding de nombres de lugares → coordenadas
 *
 * Ambos servicios son gratuitos y open-source (OpenStreetMap).
 */

const OSRM_BASE = 'https://router.project-osrm.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// Barranquilla bounding box for Nominatim search bias
const BARRANQUILLA_VIEWBOX = '-75.05,10.85,-74.70,11.10';

/**
 * Decode an OSRM polyline6 encoded string into an array of [lat, lng] pairs.
 * OSRM uses precision 5 by default for the polyline encoding.
 */
function decodePolyline(encoded, precision = 5) {
  const factor = Math.pow(10, precision);
  const points = [];
  let lat = 0;
  let lng = 0;
  let index = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / factor, lng / factor]);
  }

  return points;
}

/**
 * Get a walking route between two points using OSRM ("foot" profile).
 * Se optimiza para PEATONES: si la distancia es muy corta (< 45m), 
 * o si el motor de calles obliga a un desvío absurdo (falta de caminos mapeados),
 * se permite al usuario "cruzar libremente" trazando una ruta directa.
 *
 * @param {number} fromLat
 * @param {number} fromLng
 * @param {number} toLat
 * @param {number} toLng
 * @returns {{ coordinates: [number,number][], distance: number, duration: number }}
 */
export async function getWalkingRoute(fromLat, fromLng, toLat, toLng) {
  const straightDistance = haversineM(fromLat, fromLng, toLat, toLng);

  // 1) Si estás prácticamente en la calle por donde pasa el bus (< 45 metros),
  // no necesitamos pedirle a un GPS que te dé indicaciones. Cruzas la calle y listo.
  if (straightDistance < 45) {
    return {
      coordinates: [[fromLat, fromLng], [toLat, toLng]],
      distance: straightDistance,
      duration: Math.ceil(straightDistance / 1.33)
    };
  }

  try {
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    // Usamos el perfil 'foot' de OSRM que permite ir en contravía y cruzar peatonales.
    const url = `${OSRM_BASE}/route/v1/foot/${coords}?overview=full&geometries=polyline`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error('OSRM no encontró ruta');
    }

    const route = data.routes[0];

    // 2) Prevención de "Desvíos de Carro": Si OSRM te manda a dar una vuelta a la manzana
    // larguísima (ej. 3x la distancia en línea recta) porque falta un sendero peatonal
    // en OpenStreetMap, asumimos que como peatón tienes la libertad de cortar camino.
    if (route.distance > straightDistance * 3 && straightDistance < 300) {
      return {
        coordinates: [[fromLat, fromLng], [toLat, toLng]],
        distance: straightDistance,
        duration: Math.ceil(straightDistance / 1.33)
      };
    }

    return {
      coordinates: decodePolyline(route.geometry),
      distance: route.distance, // meters
      duration: route.duration, // seconds
    };
  } catch (err) {
    console.warn('Fallback a línea recta por fallo de OSRM:', err);
    return {
      coordinates: [[fromLat, fromLng], [toLat, toLng]],
      distance: straightDistance,
      duration: Math.ceil(straightDistance / 1.33)
    };
  }
}

/**
 * Get a driving route (bus simulation) between two points.
 * Used to draw bus route segments along real streets.
 */
export async function getDrivingRoute(fromLat, fromLng, toLat, toLng) {
  try {
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=polyline`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      return {
        coordinates: [[fromLat, fromLng], [toLat, toLng]],
        distance: haversineM(fromLat, fromLng, toLat, toLng),
        duration: 0,
      };
    }

    const route = data.routes[0];
    return {
      coordinates: decodePolyline(route.geometry),
      distance: route.distance,
      duration: route.duration,
    };
  } catch (err) {
    console.warn('OSRM driving route failed:', err);
    return {
      coordinates: [[fromLat, fromLng], [toLat, toLng]],
      distance: haversineM(fromLat, fromLng, toLat, toLng),
      duration: 0,
    };
  }
}

/**
 * Get a route between multiple waypoints (for bus route segments).
 * Useful when you need the bus to follow its route through multiple stops.
 */
export async function getMultiStopRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) return { coordinates: [], distance: 0, duration: 0 };

  try {
    const coords = waypoints.map(w => `${w[1]},${w[0]}`).join(';');
    const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=polyline`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      return { coordinates: waypoints, distance: 0, duration: 0 };
    }

    const route = data.routes[0];
    return {
      coordinates: decodePolyline(route.geometry),
      distance: route.distance,
      duration: route.duration,
    };
  } catch (err) {
    console.warn('OSRM multi-stop route failed:', err);
    return { coordinates: waypoints, distance: 0, duration: 0 };
  }
}

/**
 * Search for places using Nominatim (OpenStreetMap geocoding).
 * Results are biased towards Barranquilla, Colombia.
 *
 * @param {string} query - Place name or address
 * @returns {Array<{ displayName, lat, lng }>}
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];

  // Puliendo el sistema de búsqueda: Nominatim tiene problemas parsing direcciones 
  // en Colombia con el formato "Calle X # Y - Z".
  // Reemplazamos "#" y "-" por espacios para que procese "Calle X Y Z" y rinda mucho mejor.
  const optimizedQuery = query
    .replace(/#/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    const params = new URLSearchParams({
      q: `${optimizedQuery}, Barranquilla, Colombia`,
      format: 'json',
      addressdetails: '1',
      limit: '6',
      viewbox: BARRANQUILLA_VIEWBOX,
      bounded: '1',
    });

    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { 'Accept-Language': 'es' },
    });

    const data = await res.json();

    return data.map(item => ({
      displayName: formatNominatimName(item),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      category: item.class,
    }));
  } catch (err) {
    console.warn('Nominatim search failed:', err);
    return [];
  }
}

/**
 * Reverse geocode: coordinates → place name.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      addressdetails: '1',
    });

    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'Accept-Language': 'es' },
    });

    const data = await res.json();
    return formatNominatimName(data) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/**
 * Format a Nominatim result into a human-readable name.
 */
function formatNominatimName(item) {
  if (!item) return '';

  const addr = item.address || {};
  const parts = [];

  // Try specific name first
  if (item.name && item.name !== addr.road) {
    parts.push(item.name);
  }

  if (addr.road) {
    let road = addr.road;
    if (addr.house_number) road = `${road} #${addr.house_number}`;
    parts.push(road);
  }

  if (addr.suburb || addr.neighbourhood) {
    parts.push(addr.suburb || addr.neighbourhood);
  }

  if (parts.length === 0) {
    return item.display_name?.split(',').slice(0, 3).join(', ') || '';
  }

  return parts.join(', ');
}

/** Haversine distance in meters */
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
