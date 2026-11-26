/**
 * ============================================
 * RutaQuilla - Servicio de Paraderos Transmetro
 * ============================================
 *
 * Carga e indexa el catálogo oficial "Paraderos del Sistema"
 * (datos.gov.co · conjunto hxy3-94yh, corte 2020-09-28):
 * - Secuencia ordenada de paraderos por ruta / variante (byRouteKey)
 * - Directorio deduplicado de paraderos físicos (physicalStops)
 * - Búsqueda del paradero oficial más cercano a un punto de abordaje/descenso
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'paraderos_transmetro.json');
const SOURCE_CITATION = 'Datos Abiertos Colombia (datos.gov.co · hxy3-94yh · 2020)';
const SHORT_CITATION = 'datos.gov.co (hxy3-94yh · 2020)';

let initialized = false;
const byRouteKey = new Map();
let physicalStops = [];

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

function normalizeStopRow(row) {
  return {
    orden: Number(row.orden) || 0,
    nombre: String(row.parada || '').trim() || 'Paradero Transmetro',
    lat: Number(row.lat),
    lng: Number(row.lng),
    rutaOficial: String(row.ruta_oficial || '').trim(),
    sentido: 'oficial',
  };
}

function loadAndIndexStops() {
  if (initialized) return;
  initialized = true;

  let raw = [];
  try {
    if (!fs.existsSync(DATA_PATH)) {
      console.warn('⚠️ Archivo paraderos_transmetro.json no encontrado:', DATA_PATH);
      return;
    }
    const content = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) raw = parsed;
  } catch (err) {
    console.warn('⚠️ Error cargando paraderos_transmetro.json:', err.message);
    return;
  }

  // 1) Agrupar por clave de ruta y variante oficial
  const routeVariantBuckets = new Map();
  const coordBuckets = new Map();

  for (const row of raw) {
    const lat = Number(row?.lat);
    const lng = Number(row?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 10.5 || lat > 11.3 || lng < -75.2 || lng > -74.5) continue;
    if (!row.ruta) continue; // Ignorar rutas no mapeadas (ruta: null)

    const rutaKey = String(row.ruta).trim();
    const rutaOficial = String(row.ruta_oficial || rutaKey).trim();
    if (!rutaKey) continue;

    if (!routeVariantBuckets.has(rutaKey)) {
      routeVariantBuckets.set(rutaKey, new Map());
    }
    const variantsMap = routeVariantBuckets.get(rutaKey);
    if (!variantsMap.has(rutaOficial)) {
      variantsMap.set(rutaOficial, []);
    }
    variantsMap.get(rutaOficial).push(normalizeStopRow(row));

    // Agrupación física por coordenada (~1 metro)
    const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (!coordBuckets.has(coordKey)) {
      coordBuckets.set(coordKey, {
        lat,
        lng,
        names: new Set(),
        routesMap: new Map(),
      });
    }
    const bucket = coordBuckets.get(coordKey);
    const stopName = String(row.parada || '').trim();
    if (stopName) bucket.names.add(stopName);

    const routeEntryKey = `${rutaKey}|${rutaOficial}`;
    const existingRouteRef = bucket.routesMap.get(routeEntryKey);
    const orden = Number(row.orden) || 0;
    if (!existingRouteRef || (orden > 0 && orden < existingRouteRef.orden)) {
      bucket.routesMap.set(routeEntryKey, {
        codigo: rutaKey,
        rutaOficial,
        orden,
      });
    }
  }

  for (const [rutaKey, variantsMap] of routeVariantBuckets.entries()) {
    const variants = [];
    for (const [rutaOficial, stopsList] of variantsMap.entries()) {
      stopsList.sort((a, b) => a.orden - b.orden);
      variants.push({
        id: rutaOficial,
        nombre: rutaOficial,
        paradas: stopsList,
      });
    }
    // Priorizar la variante con mayor número de paradas (ej. A5-3 Don Bosco antes de Contingencia)
    variants.sort((a, b) => b.paradas.length - a.paradas.length);
    byRouteKey.set(rutaKey, {
      defaultStops: variants[0]?.paradas || [],
      variants,
    });
  }

  physicalStops = [...coordBuckets.values()].map((bucket, idx) => {
    const names = [...bucket.names];
    // Elegir el nombre más descriptivo disponible en esa ubicación
    names.sort((a, b) => b.length - a.length);
    const primaryName = names[0] || 'Paradero Transmetro';
    const rutas = [...bucket.routesMap.values()].sort((a, b) =>
      a.codigo.localeCompare(b.codigo, 'es')
    );
    return {
      id: `tm-${idx + 1}`,
      nombre: primaryName,
      lat: bucket.lat,
      lng: bucket.lng,
      rutas,
    };
  });
}

function getRouteEntry(route) {
  loadAndIndexStops();
  if (!route) return null;
  const code = typeof route.codigo === 'string' ? route.codigo.trim() : '';
  const name = typeof route.nombre === 'string' ? route.nombre.trim() : '';
  if (code && byRouteKey.has(code)) return byRouteKey.get(code);
  if (name && byRouteKey.has(name)) return byRouteKey.get(name);
  return null;
}

/**
 * Retorna paradas oficiales ordenadas y variantes (si la ruta tiene más de una).
 */
function getOfficialStopsForRoute(route) {
  const entry = getRouteEntry(route);
  if (!entry || !entry.defaultStops.length) return null;
  return {
    paradasOficiales: entry.defaultStops,
    variantesOficiales: entry.variants.length > 1 ? entry.variants : [],
    fuenteParadas: SHORT_CITATION,
  };
}

/**
 * Retorna el listado deduplicado de paraderos físicos Transmetro.
 */
function getAllPhysicalStops() {
  loadAndIndexStops();
  return {
    total: physicalStops.length,
    source: SOURCE_CITATION,
    data: physicalStops,
  };
}

/**
 * Busca el paradero oficial más cercano a [lng, lat] dentro de maxMeters.
 */
function findNearestOfficialStop(route, lng, lat, maxMeters = 350) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const entry = getRouteEntry(route);
  if (!entry || !entry.defaultStops.length) return null;

  let best = null;
  let bestDist = Infinity;
  for (const stop of entry.defaultStops) {
    const d = haversineMeters(lat, lng, stop.lat, stop.lng);
    if (d <= maxMeters && d < bestDist) {
      bestDist = d;
      best = stop;
    }
  }

  if (!best) return null;
  return {
    nombre: best.nombre,
    orden: best.orden,
    distance: Math.round(bestDist),
    rutaOficial: best.rutaOficial,
    lat: best.lat,
    lng: best.lng,
  };
}

module.exports = {
  getOfficialStopsForRoute,
  getAllPhysicalStops,
  findNearestOfficialStop,
};
