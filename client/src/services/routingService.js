/**
 * ============================================
 * RutaQuilla - Routing Service v2
 * ============================================
 *
 * Integra servicios para:
 * 1. OSRM: Rutas reales que siguen las calles (caminar/conducir)
 * 2. Google Maps Geocoding: Búsqueda de direcciones con alta precisión
 * 3. Google Roads: Snap to Roads para trazar rutas precisas
 * 4. Nominatim: Fallback gratuito si no hay API key de Google
 */

const OSRM_BASE = 'https://router.project-osrm.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const GOOGLE_GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GOOGLE_ROADS_BASE = 'https://roads.googleapis.com/v1/snapToRoads';

// API key from Vite env (set in .env as VITE_GOOGLE_MAPS_API_KEY)
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Barranquilla bounding box for Nominatim search bias
const BARRANQUILLA_VIEWBOX = '-75.05,10.85,-74.70,11.10';
const BARRANQUILLA_CENTER = { lat: 10.9685, lng: -74.7813 };

/**
 * Check if Google Maps API key is available
 */
function hasGoogleKey() {
  return GOOGLE_API_KEY && GOOGLE_API_KEY.length > 10;
}

// ============================================
// Polyline Decoding
// ============================================

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

// ============================================
// OSRM Routes (Walking / Driving)
// ============================================

export async function getWalkingRoute(fromLat, fromLng, toLat, toLng) {
  const straightDistance = haversineM(fromLat, fromLng, toLat, toLng);

  if (straightDistance < 45) {
    return {
      coordinates: [[fromLat, fromLng], [toLat, toLng]],
      distance: straightDistance,
      duration: Math.ceil(straightDistance / 1.33)
    };
  }

  try {
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `${OSRM_BASE}/route/v1/foot/${coords}?overview=full&geometries=polyline`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error('OSRM no encontró ruta');
    }

    const route = data.routes[0];

    if (route.distance > straightDistance * 3 && straightDistance < 300) {
      return {
        coordinates: [[fromLat, fromLng], [toLat, toLng]],
        distance: straightDistance,
        duration: Math.ceil(straightDistance / 1.33)
      };
    }

    return {
      coordinates: decodePolyline(route.geometry),
      distance: route.distance,
      duration: route.duration,
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

// ============================================
// Place Search (Google Maps or Nominatim fallback)
// ============================================

/**
 * Search for places — uses Google Geocoding if API key is available,
 * otherwise falls back to Nominatim (OpenStreetMap).
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];

  if (hasGoogleKey()) {
    return searchPlacesGoogle(query);
  }
  return searchPlacesNominatim(query);
}

/**
 * Google Maps Geocoding API — much better for Colombian addresses.
 * Understands "Calle X # Y - Z" format natively.
 */
async function searchPlacesGoogle(query) {
  try {
    const params = new URLSearchParams({
      address: `${query}, Barranquilla, Colombia`,
      key: GOOGLE_API_KEY,
      language: 'es',
      // Bias results to Barranquilla area
      bounds: '10.85,-75.05|11.10,-74.70',
    });

    const res = await fetch(`${GOOGLE_GEOCODE_BASE}?${params}`);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) return [];

    return data.results.slice(0, 6).map(item => ({
      displayName: item.formatted_address.replace(', Colombia', '').replace(', Atlántico', ''),
      lat: item.geometry.location.lat,
      lng: item.geometry.location.lng,
      type: item.types?.[0] || 'address',
      category: 'google',
    }));
  } catch (err) {
    console.warn('Google geocoding failed, falling back to Nominatim:', err);
    return searchPlacesNominatim(query);
  }
}

/**
 * Nominatim fallback — free but less accurate for Colombian addresses.
 */
async function searchPlacesNominatim(query) {
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

// ============================================
// Reverse Geocoding
// ============================================

export async function reverseGeocode(lat, lng) {
  if (hasGoogleKey()) {
    try {
      const params = new URLSearchParams({
        latlng: `${lat},${lng}`,
        key: GOOGLE_API_KEY,
        language: 'es',
      });

      const res = await fetch(`${GOOGLE_GEOCODE_BASE}?${params}`);
      const data = await res.json();

      if (data.status === 'OK' && data.results?.length) {
        return data.results[0].formatted_address
          .replace(', Colombia', '')
          .replace(', Atlántico', '');
      }
    } catch (err) {
      console.warn('Google reverse geocode failed:', err);
    }
  }

  // Nominatim fallback
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

// ============================================
// Google Roads — Snap to Roads (Admin only)
// ============================================

/**
 * Snap an array of approximate points to actual roads using Google Roads API.
 * 
 * @param {Array<{lat: number, lng: number}>} points - Array of approx lat/lng
 * @param {boolean} interpolate - If true, adds interpolated points along the road
 * @returns {Array<{lat: number, lng: number}>} - Snapped points on roads
 */
export async function snapToRoads(points, interpolate = true) {
  if (!hasGoogleKey()) {
    console.warn('No Google API key — using OSRM fallback for snap to roads');
    return snapToRoadsOSRM(points);
  }

  if (!points || points.length < 2) return points;

  try {
    // Google Roads API accepts max 100 points per request
    const allSnapped = [];
    const chunkSize = 100;

    for (let i = 0; i < points.length; i += chunkSize) {
      const chunk = points.slice(i, Math.min(i + chunkSize, points.length));
      const path = chunk.map(p => `${p.lat},${p.lng}`).join('|');

      const params = new URLSearchParams({
        path,
        interpolate: interpolate.toString(),
        key: GOOGLE_API_KEY,
      });

      const res = await fetch(`${GOOGLE_ROADS_BASE}?${params}`);
      const data = await res.json();

      if (data.snappedPoints?.length) {
        const snapped = data.snappedPoints.map(sp => ({
          lat: sp.location.latitude,
          lng: sp.location.longitude,
        }));
        allSnapped.push(...snapped);
      } else if (data.error) {
        console.warn('Roads API error:', data.error.message);
        // Fallback to OSRM
        return snapToRoadsOSRM(points);
      }
    }

    return allSnapped.length > 0 ? allSnapped : points;
  } catch (err) {
    console.warn('Snap to Roads failed, using OSRM fallback:', err);
    return snapToRoadsOSRM(points);
  }
}

/**
 * OSRM fallback for snap-to-roads using the /match API (map matching).
 *
 * Unlike /route which finds the "fastest path" between points (and detours
 * through parallel streets), /match takes a GPS trace and aligns it to the
 * most likely road segments that were actually traversed.
 *
 * - Uses a tight 25m radius so it only snaps to nearby roads
 * - Returns the full matched geometry that follows the actual street
 * - Chunks in groups of 50 with 2-point overlap for continuity
 */
async function snapToRoadsOSRM(points) {
  if (!points || points.length === 0) return points;
  if (points.length === 1) return points;

  try {
    const chunkSize = 50;
    const overlap = 2;
    const allSnappedCoords = [];

    for (let i = 0; i < points.length; i += (chunkSize - overlap)) {
      const chunk = points.slice(i, Math.min(i + chunkSize, points.length));
      if (chunk.length < 2) {
        // Single leftover point — snap with /nearest
        try {
          const url = `${OSRM_BASE}/nearest/v1/driving/${chunk[0].lng},${chunk[0].lat}?number=1`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.code === 'Ok' && data.waypoints?.[0]) {
            allSnappedCoords.push({ lat: data.waypoints[0].location[1], lng: data.waypoints[0].location[0] });
          } else {
            allSnappedCoords.push(chunk[0]);
          }
        } catch (_) {
          allSnappedCoords.push(chunk[0]);
        }
        break;
      }

      const coords = chunk.map(p => `${p.lng},${p.lat}`).join(';');
      const radiuses = chunk.map(() => '25').join(';');
      const url = `${OSRM_BASE}/match/v1/driving/${coords}?overview=full&geometries=geojson&radiuses=${radiuses}&tidy=true`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.code === 'Ok' && data.matchings?.length > 0) {
        // Collect geometry coordinates from all matchings
        for (const matching of data.matchings) {
          const geomCoords = matching.geometry?.coordinates || [];
          // Convert from [lng, lat] to {lat, lng}
          const converted = geomCoords.map(c => ({ lat: c[1], lng: c[0] }));

          if (allSnappedCoords.length > 0 && converted.length > 0) {
            // Skip first few points if they overlap with previous chunk
            // Find where the overlap ends by checking distance to last point
            const lastPt = allSnappedCoords[allSnappedCoords.length - 1];
            let startIdx = 0;
            for (let j = 0; j < Math.min(converted.length, 10); j++) {
              const dist = haversineM(lastPt.lat, lastPt.lng, converted[j].lat, converted[j].lng);
              if (dist < 5) {
                startIdx = j + 1;
                break;
              }
            }
            allSnappedCoords.push(...converted.slice(startIdx));
          } else {
            allSnappedCoords.push(...converted);
          }
        }
      } else {
        // /match failed for this chunk — fallback to /route with overview=full
        // to at least get road-following geometry
        try {
          const routeUrl = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
          const routeRes = await fetch(routeUrl);
          const routeData = await routeRes.json();
          if (routeData.code === 'Ok' && routeData.routes?.[0]?.geometry?.coordinates?.length) {
            const geomCoords = routeData.routes[0].geometry.coordinates;
            const converted = geomCoords.map(c => ({ lat: c[1], lng: c[0] }));
            if (allSnappedCoords.length > 0 && converted.length > 0) {
              allSnappedCoords.push(...converted.slice(1));
            } else {
              allSnappedCoords.push(...converted);
            }
          } else {
            allSnappedCoords.push(...chunk);
          }
        } catch (_) {
          allSnappedCoords.push(...chunk);
        }
      }

      // If this chunk reached the end of points, stop
      if (i + chunkSize >= points.length) break;
    }

    return allSnappedCoords.length > 0 ? allSnappedCoords : points;
  } catch (err) {
    console.warn('OSRM snap (match) fallback failed:', err);
  }

  return points;
}

// ============================================
// Helpers
// ============================================

function formatNominatimName(item) {
  if (!item) return '';

  const addr = item.address || {};
  const parts = [];

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
