/**
 * ============================================
 * RutaQuilla - Routing Service v3
 * ============================================
 *
 * Integra servicios gratuitos y rápidos:
 * 1. OSRM: Rutas reales que siguen las calles (caminar/conducir)
 * 2. Búsqueda híbrida: Catálogo local de Barranquilla (0 ms) + proxy backend (Geoapify opcional / Photon / Nominatim)
 * 3. Reverse geocoding con caché y fallback
 */

import { searchLocalPlaces } from '../data/barranquillaPlaces';
import { mapsAPI } from './api';

const OSRM_BASE = 'https://router.project-osrm.org';
const PHOTON_BASE = 'https://photon.komoot.io';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const GOOGLE_GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_ROADS_BASE = 'https://roads.googleapis.com/v1/snapToRoads';

// API key from Vite env (optional legacy support)
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Barranquilla bounding box for search bias
const BARRANQUILLA_VIEWBOX = '-75.15,10.78,-74.68,11.12';
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
// Place Search (Hybrid: Local Barranquilla Catalog + Backend Proxy / Photon / Nominatim)
// ============================================

function normalizePlaceName(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isCoordinateString(str) {
  return /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(String(str || ''));
}

function formatColombianAddress(rawAddr) {
  if (typeof rawAddr !== 'string') return '';
  const cleaned = rawAddr.replace(/\s+/g, ' ').replace(/\s*#\s*/g, ' #').trim();
  const streetMatch = cleaned.match(
    /^((?:Avenida\s+)?(?:Calle|Carrera|Diagonal|Transversal|Circular|Vía|Via|Autopista)\s+\d+[A-Za-z]*(?:\s+(?:Bis|Sur|Este|Norte|Oeste))?)\s+(\d+[A-Za-z]*)\s+(\d+[A-Za-z]*)$/i
  );
  if (streetMatch) {
    return `${streetMatch[1]} #${streetMatch[2]}-${streetMatch[3]}`;
  }
  return cleaned;
}

function looksLikeStreetQuery(raw) {
  const s = String(raw || '').trim();
  if (/\d+\s*#\s*\d+/.test(s)) return true;
  return /\b(?:calle|cll|cl|carrera|cra|kr|k|diagonal|diag|dg|transversal|transv|tv|circular|via|vía)\s*\.?\s*\d+/i.test(s);
}

async function searchPlacesArcGis(query) {
  try {
    const normalized = query
      .replace(/\b(?:cra|kr|k)\.?(?=\s|$|\d)/gi, 'Carrera')
      .replace(/\b(?:cll|cl)\.?(?=\s|$|\d)/gi, 'Calle')
      .replace(/\bav\.?(?=\s|$)/gi, 'Avenida')
      .replace(/\b(?:diag|dg)\.?(?=\s|$|\d)/gi, 'Diagonal')
      .replace(/\b(?:transv|tv)\.?(?=\s|$|\d)/gi, 'Transversal')
      .replace(/[#-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const params = new URLSearchParams({
      f: 'json',
      SingleLine: `${normalized}, Barranquilla, Atlantico, COL`,
      location: `${BARRANQUILLA_CENTER.lng},${BARRANQUILLA_CENTER.lat}`,
      searchExtent: BARRANQUILLA_VIEWBOX,
      outFields: 'Match_addr,Addr_type,Nbrhd,City',
      maxLocations: '6',
      langCode: 'ES',
    });
    const res = await fetch(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params}`
    );
    const data = await res.json();
    return (data.candidates || [])
      .filter((c) => Number(c?.score) >= 75)
      .map((c) => {
        const lat = Number(c?.location?.y);
        const lng = Number(c?.location?.x);
        const attrs = c?.attributes || {};
        const firstPart = String(attrs.Match_addr || c.address || '').split(',')[0].trim();
        const displayName = formatColombianAddress(firstPart) || firstPart || normalized;
        const subtitle = [attrs.Nbrhd, attrs.City || 'Barranquilla'].filter(Boolean).join(', ') || 'Barranquilla, Atlántico';
        return { displayName, subtitle, lat, lng, type: attrs.Addr_type || 'address', category: 'address', source: 'arcgis' };
      })
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  } catch (err) {
    console.warn('Direct ArcGIS geocode failed:', err);
    return [];
  }
}

/**
 * Hybrid search for places in Barranquilla:
 * 1. Instant local catalog lookup
 * 2. Backend geocode proxy (ArcGIS/Geoapify/Photon/Nominatim), or direct client fallback
 * 3. Merge & deduplicate results
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];

  const trimmed = query.trim();
  const isStreet = looksLikeStreetQuery(trimmed);
  const localResults = searchLocalPlaces(trimmed, 5);

  let remoteResults = [];
  if (trimmed.length >= 2 || localResults.length < 3) {
    if (hasGoogleKey()) {
      remoteResults = await searchPlacesGoogle(trimmed);
    } else {
      try {
        const res = await mapsAPI.geocode(trimmed);
        remoteResults = Array.isArray(res?.data) ? res.data : [];
      } catch (err) {
        console.warn('Backend geocode unavailable, falling back directly:', err?.message || err);
        if (isStreet) {
          remoteResults = await searchPlacesArcGis(trimmed);
        }
        if (remoteResults.length < 3) {
          const photon = await searchPlacesPhoton(trimmed);
          remoteResults = [...remoteResults, ...photon];
        }
        if (!isStreet && remoteResults.length < 2) {
          const arc = await searchPlacesArcGis(trimmed);
          remoteResults = [...remoteResults, ...arc];
        }
        if (remoteResults.length === 0) {
          remoteResults = await searchPlacesNominatim(trimmed);
        }
      }
    }
  }

  // Merge local first + deduplicated remote (threshold más estricto en direcciones específicas)
  const merged = [...localResults];
  for (const rem of remoteResults) {
    if (!rem || !Number.isFinite(rem.lat) || !Number.isFinite(rem.lng)) continue;
    const remNorm = normalizePlaceName(rem.displayName);
    const dupDist = rem.source === 'arcgis' || isStreet ? 30 : 90;
    const isDuplicate = merged.some((m) => {
      const dist = haversineM(m.lat, m.lng, rem.lat, rem.lng);
      if (dist < dupDist && normalizePlaceName(m.displayName) === remNorm) return true;
      if (dist < 25) return true;
      return normalizePlaceName(m.displayName) === remNorm && dist < 180;
    });
    if (!isDuplicate) {
      merged.push(rem);
    }
    if (merged.length >= 6) break;
  }

  return merged.slice(0, 6);
}

/**
 * Direct Photon (OSM) search fallback if backend proxy is unavailable.
 */
async function searchPlacesPhoton(query) {
  try {
    const params = new URLSearchParams({
      q: query,
      lat: BARRANQUILLA_CENTER.lat.toString(),
      lon: BARRANQUILLA_CENTER.lng.toString(),
      bbox: BARRANQUILLA_VIEWBOX,
      limit: '6',
    });

    const res = await fetch(`${PHOTON_BASE}/api/?${params}`);
    const data = await res.json();

    return (data.features || []).map((f) => {
      const props = f.properties || {};
      const [lng, lat] = f.geometry?.coordinates || [];
      const streetLine = props.street
        ? `${props.street}${props.housenumber ? ` #${props.housenumber}` : ''}`
        : '';
      const displayName = props.name || streetLine || props.district || props.city || 'Barranquilla';
      const area = props.locality || props.district;
      const city = props.city || props.county || 'Barranquilla';
      const subtitle = [streetLine && props.name ? streetLine : null, area !== displayName ? area : null, city !== displayName ? city : null]
        .filter(Boolean)
        .join(', ');

      return {
        displayName,
        subtitle: subtitle || 'Barranquilla, Atlántico',
        lat: Number(lat),
        lng: Number(lng),
        type: props.osm_value || props.type || 'place',
        category: props.osm_key || 'place',
        source: 'photon',
      };
    }).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  } catch (err) {
    console.warn('Direct Photon search failed:', err);
    return [];
  }
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

const reverseGeocodeCache = new Map();
const reverseGeocodeInFlight = new Map();
const MAX_REVERSE_CACHE = 100;

export async function reverseGeocode(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return '';
  }

  const cacheKey = `${numLat.toFixed(5)},${numLng.toFixed(5)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey);
  }
  if (reverseGeocodeInFlight.has(cacheKey)) {
    return reverseGeocodeInFlight.get(cacheKey);
  }

  const requestPromise = (async () => {
    let resolvedName = null;

    if (hasGoogleKey()) {
      try {
        const params = new URLSearchParams({
          latlng: `${numLat},${numLng}`,
          key: GOOGLE_API_KEY,
          language: 'es',
        });

        const res = await fetch(`${GOOGLE_GEOCODE_BASE}?${params}`);
        const data = await res.json();

        if (data.status === 'OK' && data.results?.length) {
          resolvedName = data.results[0].formatted_address
            .replace(', Colombia', '')
            .replace(', Atlántico', '');
        }
      } catch (err) {
        console.warn('Google reverse geocode failed:', err);
      }
    }

    if (!resolvedName) {
      // Backend reverse geocode proxy (ArcGIS / Geoapify / Photon / Nominatim)
      try {
        const res = await mapsAPI.reverse(numLat, numLng);
        const candidate = res?.data?.displayName;
        if (candidate && !isCoordinateString(candidate)) {
          resolvedName = candidate;
        }
      } catch (_) {
        resolvedName = null;
      }
    }

    if (!resolvedName) {
      // Direct ArcGIS reverse geocode fallback
      try {
        const params = new URLSearchParams({
          f: 'json',
          location: `${numLng},${numLat}`,
          langCode: 'ES',
        });
        const res = await fetch(
          `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?${params}`
        );
        const data = await res.json();
        const addr = data?.address;
        if (addr) {
          const streetRaw = addr.ShortLabel || addr.Address || addr.PlaceName || '';
          const formattedStreet = formatColombianAddress(streetRaw);
          const hood = String(addr.Neighborhood || addr.District || '').trim();
          if (formattedStreet) {
            resolvedName = hood && !formattedStreet.toLowerCase().includes(hood.toLowerCase())
              ? `${formattedStreet}, ${hood}`
              : formattedStreet;
          } else if (hood) {
            resolvedName = hood;
          }
        }
      } catch (_) {
        resolvedName = null;
      }
    }

    if (!resolvedName) {
      // Direct Photon reverse fallback
      try {
        const params = new URLSearchParams({
          lat: numLat.toString(),
          lon: numLng.toString(),
        });
        const res = await fetch(`${PHOTON_BASE}/reverse?${params}`);
        const data = await res.json();
        const props = data?.features?.[0]?.properties;
        if (props) {
          const streetLine = props.street
            ? `${props.street}${props.housenumber ? ` #${props.housenumber}` : ''}`
            : '';
          const primary = props.name || streetLine || props.district || props.city;
          const area = props.locality || props.district;
          if (primary && primary.toLowerCase() !== 'barranquilla') {
            resolvedName = area && area !== primary ? `${primary}, ${area}` : primary;
          }
        }
      } catch (_) {
        resolvedName = null;
      }
    }

    if (!resolvedName) {
      // Nominatim fallback
      try {
        const params = new URLSearchParams({
          lat: numLat.toString(),
          lon: numLng.toString(),
          format: 'json',
          addressdetails: '1',
        });

        const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
          headers: { 'Accept-Language': 'es' },
        });

        const data = await res.json();
        const nomName = formatNominatimName(data) || null;
        if (nomName && !isCoordinateString(nomName)) {
          resolvedName = nomName;
        }
      } catch (_) {
        resolvedName = null;
      }
    }

    if (resolvedName && !isCoordinateString(resolvedName)) {
      if (reverseGeocodeCache.size >= MAX_REVERSE_CACHE) {
        const oldestKey = reverseGeocodeCache.keys().next().value;
        reverseGeocodeCache.delete(oldestKey);
      }
      reverseGeocodeCache.set(cacheKey, resolvedName);
      return resolvedName;
    }

    return 'Ubicación en el mapa';
  })();

  reverseGeocodeInFlight.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    reverseGeocodeInFlight.delete(cacheKey);
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
