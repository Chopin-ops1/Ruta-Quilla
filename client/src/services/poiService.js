/**
 * ============================================
 * RutaQuilla - POI Service v2 (Progressive Loading)
 * ============================================
 *
 * Carga puntos de interés reales de Barranquilla desde
 * OpenStreetMap usando la API de Overpass.
 *
 * v2 Mejoras:
 * - Carga progresiva por zoom: POIs importantes primero
 * - Cache robusto que no sobreescribe con resultados vacíos
 * - TTL de 30 minutos para reducir rate-limiting
 * - Fallback a datos anteriores cuando Overpass falla
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Cache by bounding box key
const poiCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — reduce Overpass rate-limit spam

// POI category definitions with icons and colors
export const POI_CATEGORIES = {
  restaurant: { emoji: '🍽️', label: 'Restaurante', color: '#F97316', tier: 2 },
  cafe: { emoji: '☕', label: 'Café', color: '#92400E', tier: 2 },
  fast_food: { emoji: '🍔', label: 'Comida rápida', color: '#EA580C', tier: 3 },
  hospital: { emoji: '🏥', label: 'Hospital', color: '#EF4444', tier: 1 },
  clinic: { emoji: '🏥', label: 'Clínica', color: '#F87171', tier: 2 },
  pharmacy: { emoji: '💊', label: 'Farmacia', color: '#10B981', tier: 3 },
  university: { emoji: '🎓', label: 'Universidad', color: '#3B82F6', tier: 1 },
  school: { emoji: '🏫', label: 'Colegio', color: '#60A5FA', tier: 2 },
  supermarket: { emoji: '🛒', label: 'Supermercado', color: '#8B5CF6', tier: 1 },
  convenience: { emoji: '🏪', label: 'Tienda', color: '#A78BFA', tier: 3 },
  bank: { emoji: '🏦', label: 'Banco', color: '#14B8A6', tier: 2 },
  atm: { emoji: '💳', label: 'Cajero', color: '#2DD4BF', tier: 3 },
  fuel: { emoji: '⛽', label: 'Gasolinera', color: '#F59E0B', tier: 2 },
  place_of_worship: { emoji: '⛪', label: 'Iglesia', color: '#6366F1', tier: 2 },
  police: { emoji: '🚔', label: 'Policía', color: '#1E40AF', tier: 1 },
  fire_station: { emoji: '🚒', label: 'Bomberos', color: '#DC2626', tier: 1 },
  parking: { emoji: '🅿️', label: 'Parqueadero', color: '#6B7280', tier: 3 },
  hotel: { emoji: '🏨', label: 'Hotel', color: '#D946EF', tier: 2 },
  mall: { emoji: '🏬', label: 'Centro comercial', color: '#EC4899', tier: 1 },
};

/**
 * Get POI tiers for the given zoom level.
 * - Zoom 14-15: Tier 1 only (important landmarks)
 * - Zoom 16-17: Tier 1 + 2 (+ restaurants, banks, etc.)
 * - Zoom 18+:   All tiers (everything including ATMs, parking)
 */
function getZoomTier(zoom) {
  if (zoom >= 18) return 3;
  if (zoom >= 16) return 2;
  return 1;
}

function getAmenitiesForTier(tier) {
  if (tier === 1) {
    return {
      amenities: 'hospital|university|police|fire_station|supermarket',
      shops: 'mall',
      limit: 40,
    };
  }
  if (tier === 2) {
    return {
      amenities: 'hospital|university|police|fire_station|restaurant|cafe|clinic|school|bank|fuel|place_of_worship',
      shops: 'supermarket|mall',
      tourism: 'hotel',
      limit: 100,
    };
  }
  // Tier 3: everything
  return {
    amenities: 'restaurant|cafe|fast_food|hospital|clinic|pharmacy|university|school|bank|atm|fuel|place_of_worship|police|fire_station|parking',
    shops: 'supermarket|convenience|mall',
    tourism: 'hotel',
    limit: 200,
  };
}

/**
 * Build the Overpass QL query for a given bounding box and zoom tier.
 */
function buildOverpassQuery(south, west, north, east, tier) {
  const bbox = `${south},${west},${north},${east}`;
  const config = getAmenitiesForTier(tier);
  
  let query = `[out:json][timeout:12];\n(\n`;
  query += `  node["amenity"~"${config.amenities}"](${bbox});\n`;
  query += `  node["shop"~"${config.shops}"](${bbox});\n`;
  if (config.tourism) {
    query += `  node["tourism"~"${config.tourism}"](${bbox});\n`;
  }
  query += `);\nout body ${config.limit};\n`;
  
  return query;
}

/**
 * Generate a cache key from bounds and tier.
 * Rounds to 3 decimals (~100m) to increase cache hits.
 */
function boundsToKey(south, west, north, east, tier) {
  return `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)},t${tier}`;
}

// Track last successful POIs for fallback
let lastSuccessfulPOIs = [];

/**
 * Fetch POIs from Overpass API for the given map bounds.
 *
 * @param {{ south, west, north, east }} bounds - Map viewport bounds
 * @param {number} zoom - Current zoom level
 * @returns {Promise<Array<{ id, lat, lng, name, category, address }>>}
 */
export async function fetchPOIs(bounds, zoom = 16) {
  const { south, west, north, east } = bounds;
  const tier = getZoomTier(zoom);

  // Check cache
  const key = boundsToKey(south, west, north, east, tier);
  const cached = poiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const query = buildOverpassQuery(south, west, north, east, tier);
    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // Rate limited or error — return previous data instead of empty
    if (!res.ok) {
      console.warn('Overpass API error:', res.status);
      return cached?.data || lastSuccessfulPOIs;
    }

    const data = await res.json();
    const pois = (data.elements || []).map(el => {
      const tags = el.tags || {};
      const category =
        tags.amenity || tags.shop || tags.tourism || 'other';

      return {
        id: el.id,
        lat: el.lat,
        lng: el.lon,
        name: tags.name || tags['name:es'] || getCategoryLabel(category),
        category,
        address: tags['addr:street']
          ? `${tags['addr:street']} ${tags['addr:housenumber'] || ''}`
          : null,
        phone: tags.phone || null,
        website: tags.website || null,
        openingHours: tags.opening_hours || null,
      };
    }).filter(p => p.name);

    // Only cache if we got non-empty results (prevents wiping good data)
    if (pois.length > 0) {
      poiCache.set(key, { data: pois, timestamp: Date.now() });
      lastSuccessfulPOIs = pois;
    }

    // Evict old cache entries
    if (poiCache.size > 30) {
      const oldest = [...poiCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) poiCache.delete(oldest[0]);
    }

    return pois.length > 0 ? pois : (cached?.data || lastSuccessfulPOIs);
  } catch (err) {
    console.warn('Failed to fetch POIs:', err);
    return cached?.data || lastSuccessfulPOIs;
  }
}

/**
 * Get a human-readable label for a POI category.
 */
export function getCategoryLabel(category) {
  return POI_CATEGORIES[category]?.label || category;
}

/**
 * Get the emoji icon for a POI category.
 */
export function getCategoryEmoji(category) {
  return POI_CATEGORIES[category]?.emoji || '📍';
}

/**
 * Get the color for a POI category.
 */
export function getCategoryColor(category) {
  return POI_CATEGORIES[category]?.color || '#6B7280';
}
