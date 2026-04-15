/**
 * ============================================
 * RutaQuilla - POI Service (Overpass API)
 * ============================================
 *
 * Carga puntos de interés reales de Barranquilla desde
 * OpenStreetMap usando la API de Overpass.
 *
 * Categorías: restaurantes, hospitales, universidades,
 * supermercados, bancos, gasolineras, iglesias, etc.
 *
 * Incluye caché en memoria para evitar requests duplicados.
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Cache by bounding box key
const poiCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes — reduce Overpass rate-limit spam

// POI category definitions with icons and colors
export const POI_CATEGORIES = {
  restaurant: { emoji: '🍽️', label: 'Restaurante', color: '#F97316' },
  cafe: { emoji: '☕', label: 'Café', color: '#92400E' },
  fast_food: { emoji: '🍔', label: 'Comida rápida', color: '#EA580C' },
  hospital: { emoji: '🏥', label: 'Hospital', color: '#EF4444' },
  clinic: { emoji: '🏥', label: 'Clínica', color: '#F87171' },
  pharmacy: { emoji: '💊', label: 'Farmacia', color: '#10B981' },
  university: { emoji: '🎓', label: 'Universidad', color: '#3B82F6' },
  school: { emoji: '🏫', label: 'Colegio', color: '#60A5FA' },
  supermarket: { emoji: '🛒', label: 'Supermercado', color: '#8B5CF6' },
  convenience: { emoji: '🏪', label: 'Tienda', color: '#A78BFA' },
  bank: { emoji: '🏦', label: 'Banco', color: '#14B8A6' },
  atm: { emoji: '💳', label: 'Cajero', color: '#2DD4BF' },
  fuel: { emoji: '⛽', label: 'Gasolinera', color: '#F59E0B' },
  place_of_worship: { emoji: '⛪', label: 'Iglesia', color: '#6366F1' },
  police: { emoji: '🚔', label: 'Policía', color: '#1E40AF' },
  fire_station: { emoji: '🚒', label: 'Bomberos', color: '#DC2626' },
  parking: { emoji: '🅿️', label: 'Parqueadero', color: '#6B7280' },
  hotel: { emoji: '🏨', label: 'Hotel', color: '#D946EF' },
  mall: { emoji: '🏬', label: 'Centro comercial', color: '#EC4899' },
};

/**
 * Build the Overpass QL query for a given bounding box.
 * Retrieves amenities, shops, and other POIs.
 */
function buildOverpassQuery(south, west, north, east) {
  const bbox = `${south},${west},${north},${east}`;
  return `
[out:json][timeout:10];
(
  node["amenity"~"restaurant|cafe|fast_food|hospital|clinic|pharmacy|university|school|bank|atm|fuel|place_of_worship|police|fire_station|parking"](${bbox});
  node["shop"~"supermarket|convenience|mall"](${bbox});
  node["tourism"~"hotel"](${bbox});
);
out body 100;
`;
}

/**
 * Generate a cache key from bounds.
 * Rounds to 3 decimals (~100m) to increase cache hits.
 */
function boundsToKey(south, west, north, east) {
  return `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
}

/**
 * Fetch POIs from Overpass API for the given map bounds.
 *
 * @param {{ south, west, north, east }} bounds - Map viewport bounds
 * @returns {Promise<Array<{ id, lat, lng, name, category, address }>>}
 */
export async function fetchPOIs(bounds) {
  const { south, west, north, east } = bounds;

  // Check cache
  const key = boundsToKey(south, west, north, east);
  const cached = poiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const query = buildOverpassQuery(south, west, north, east);
    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!res.ok) {
      console.warn('Overpass API error:', res.status);
      return cached?.data || [];
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

    // Cache result
    poiCache.set(key, { data: pois, timestamp: Date.now() });

    // Evict old cache entries
    if (poiCache.size > 20) {
      const oldest = [...poiCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) poiCache.delete(oldest[0]);
    }

    return pois;
  } catch (err) {
    console.warn('Failed to fetch POIs:', err);
    return cached?.data || [];
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
