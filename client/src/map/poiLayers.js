/**
 * ============================================
 * RutaQuilla - Capa de Puntos de Interés (estilo Google Maps)
 * ============================================
 *
 * - Usa la capa `poi` de los tiles vectoriales OpenMapTiles (OpenFreeMap),
 *   datos de OpenStreetMap actualizados semanalmente y cargados SOLO para el área visible.
 * - Revelado progresivo por importancia (`rank`) y nivel de zoom.
 * - Detección de colisiones: los lugares no se amontonan, se priorizan los más relevantes.
 * - Catálogo curado de Barranquilla (Transmetro, clínicas, malls…) con prioridad máxima.
 *
 * IMPORTANTE: Este módulo no toca APIs del navegador a nivel superior para poder
 * validarse desde Node. El dibujo de íconos ocurre dentro de createPoiIconImages().
 */

export const POI_SOURCE_VECTOR = 'openmaptiles';
export const POI_SOURCE_CURATED = 'pois';

export const POI_CATEGORIES = {
  transit: { label: 'Estación / Transporte', chip: 'Transporte', color: '#06B6D4', darkText: '#67E8F9', lightText: '#0E7490', icon: 'BusFront', priority: 0 },
  food: { label: 'Comida y bebida', chip: 'Comida', color: '#F97316', darkText: '#FDBA74', lightText: '#C2410C', icon: 'Utensils', priority: 2 },
  shopping: { label: 'Compras', chip: 'Compras', color: '#F59E0B', darkText: '#FCD34D', lightText: '#B45309', icon: 'ShoppingBag', priority: 1 },
  health: { label: 'Salud', chip: 'Salud', color: '#EF4444', darkText: '#FCA5A5', lightText: '#B91C1C', icon: 'HeartPulse', priority: 1 },
  education: { label: 'Educación', chip: 'Educación', color: '#3B82F6', darkText: '#93C5FD', lightText: '#1D4ED8', icon: 'GraduationCap', priority: 2 },
  park: { label: 'Parques y naturaleza', chip: 'Parques', color: '#10B981', darkText: '#6EE7B7', lightText: '#047857', icon: 'Trees', priority: 3 },
  culture: { label: 'Cultura y lugares emblemáticos', chip: 'Cultura', color: '#8B5CF6', darkText: '#C4B5FD', lightText: '#6D28D9', icon: 'Landmark', priority: 2 },
  money: { label: 'Bancos y cajeros', chip: 'Bancos', color: '#14B8A6', darkText: '#5EEAD4', lightText: '#0F766E', icon: 'Banknote', priority: 3 },
  lodging: { label: 'Hoteles', chip: 'Hoteles', color: '#EC4899', darkText: '#F9A8D4', lightText: '#BE185D', icon: 'BedDouble', priority: 3 },
  other: { label: 'Lugar de interés', chip: 'Otros', color: '#64748B', darkText: '#CBD5E1', lightText: '#334155', icon: 'MapPin', priority: 4 },
};

/** Chips visibles en la barra de categorías (orden de aparición). */
export const POI_CHIP_ORDER = ['transit', 'food', 'shopping', 'health', 'education', 'park', 'culture'];

/** Clases OpenMapTiles → categoría RutaQuilla. */
export const OMT_CLASS_TO_CATEGORY = {
  bus: 'transit', railway: 'transit', harbor: 'transit', airport: 'transit', aerialway: 'transit', ferry_terminal: 'transit',
  restaurant: 'food', fast_food: 'food', cafe: 'food', bar: 'food', beer: 'food', ice_cream: 'food', bakery: 'food', pub: 'food',
  shop: 'shopping', grocery: 'shopping', clothing_store: 'shopping', department_store: 'shopping', mall: 'shopping',
  supermarket: 'shopping', convenience: 'shopping', hardware: 'shopping', furniture: 'shopping', florist: 'shopping',
  jewelry: 'shopping', mobile_phone: 'shopping', shoes: 'shopping', electronics: 'shopping', alcohol_shop: 'shopping',
  hospital: 'health', doctors: 'health', dentist: 'health', pharmacy: 'health', veterinary: 'health', clinic: 'health',
  college: 'education', school: 'education', library: 'education', kindergarten: 'education', university: 'education',
  park: 'park', garden: 'park', zoo: 'park', playground: 'park', nature_reserve: 'park', pitch: 'park',
  attraction: 'culture', museum: 'culture', theatre: 'culture', cinema: 'culture', art_gallery: 'culture', monument: 'culture',
  place_of_worship: 'culture', stadium: 'culture', castle: 'culture', town_hall: 'culture', music: 'culture', landmark: 'culture',
  bank: 'money', atm: 'money', money: 'money',
  lodging: 'lodging', hotel: 'lodging',
};

/** Clases con poco valor para el usuario de bus (ruido visual). */
export const POI_EXCLUDED_CLASSES = [
  'parking', 'bicycle_parking', 'bicycle_rental', 'motorcycle_parking', 'toilets', 'entrance',
  'drinking_water', 'waste_basket', 'bench', 'charging_station', 'car', 'car_wash', 'office',
];

/** Catálogo curado (barranquillaPlaces.js) → categoría RutaQuilla. */
const CURATED_CATEGORY_MAP = {
  mall: 'shopping',
  university: 'education',
  hospital: 'health',
  landmark: 'culture',
  transit: 'transit',
  park: 'park',
};

export function getCuratedCategory(category) {
  return CURATED_CATEGORY_MAP[category] || 'other';
}

export function getPoiCategory(cls, subclass) {
  return OMT_CLASS_TO_CATEGORY[subclass] || OMT_CLASS_TO_CATEGORY[cls] || 'other';
}

export function getCategoryMeta(category) {
  return POI_CATEGORIES[category] || POI_CATEGORIES.other;
}

/** Expresión MapLibre: clase OMT → categoría. */
export function buildCategoryExpression() {
  const pairs = [];
  for (const [cls, cat] of Object.entries(OMT_CLASS_TO_CATEGORY)) {
    pairs.push(cls, cat);
  }
  return ['match', ['get', 'class'], ...pairs, 'other'];
}

function textColorExpression(categoryExpr, isDark) {
  const pairs = [];
  for (const [id, meta] of Object.entries(POI_CATEGORIES)) {
    if (id === 'other') continue;
    pairs.push(id, isDark ? meta.darkText : meta.lightText);
  }
  return ['match', categoryExpr, ...pairs, isDark ? POI_CATEGORIES.other.darkText : POI_CATEGORIES.other.lightText];
}

const VECTOR_BANDS = [
  { id: 'rq-poi-vt-major', minzoom: 14, rankFilter: ['<', ['coalesce', ['get', 'rank'], 99], 7] },
  {
    id: 'rq-poi-vt-mid',
    minzoom: 15.5,
    rankFilter: ['all', ['>=', ['coalesce', ['get', 'rank'], 99], 7], ['<', ['coalesce', ['get', 'rank'], 99], 20]],
  },
  { id: 'rq-poi-vt-minor', minzoom: 17, rankFilter: ['>=', ['coalesce', ['get', 'rank'], 99], 20] },
];

export const POI_LAYER_IDS = ['rq-poi-curated', ...VECTOR_BANDS.map((b) => b.id)];
export const NATIVE_STYLE_POI_LAYERS = ['poi_r1', 'poi_r7', 'poi_r20', 'poi_transit'];

/**
 * Construye las capas de POIs. Las capas vectoriales usan tiles OSM (solo el área visible);
 * la curada usa el GeoJSON `pois` con la propiedad `category` ya resuelta.
 */
export function buildPoiLayers({ isDark = true, activeCategory = 'all' } = {}) {
  const categoryExpr = buildCategoryExpression();
  const haloColor = isDark ? 'rgba(7,12,23,0.92)' : 'rgba(255,255,255,0.95)';

  const baseFilterVector = [
    'all',
    ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
    ['has', 'name'],
    ['!', ['in', ['get', 'class'], ['literal', POI_EXCLUDED_CLASSES]]],
  ];
  if (activeCategory !== 'all') {
    baseFilterVector.push(['==', categoryExpr, activeCategory]);
  }

  const vectorLayers = VECTOR_BANDS.map((band) => ({
    id: band.id,
    type: 'symbol',
    source: POI_SOURCE_VECTOR,
    'source-layer': 'poi',
    minzoom: band.minzoom,
    filter: [...baseFilterVector, band.rankFilter],
    layout: {
      'icon-image': ['concat', 'rq-poi-', categoryExpr],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.78, 17, 0.95],
      'icon-allow-overlap': false,
      'icon-padding': 2,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 14, 11, 17, 12.5],
      'text-variable-anchor': ['right', 'left', 'top', 'bottom'],
      'text-radial-offset': 1.15,
      'text-justify': 'auto',
      'text-max-width': 9,
      'text-optional': true,
      'text-padding': 2,
    },
    paint: {
      'text-color': textColorExpression(categoryExpr, isDark),
      'text-halo-color': haloColor,
      'text-halo-width': 1.5,
      'text-halo-blur': 0.4,
    },
  }));

  const curatedFilter = ['all', ['has', 'name']];
  if (activeCategory !== 'all') {
    curatedFilter.push(['==', ['get', 'category'], activeCategory]);
  }

  const curatedLayer = {
    id: 'rq-poi-curated',
    type: 'symbol',
    source: POI_SOURCE_CURATED,
    minzoom: 12.5,
    filter: curatedFilter,
    layout: {
      'icon-image': ['concat', 'rq-poi-featured-', ['get', 'category']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 12.5, 0.72, 15, 0.92, 17, 1],
      'icon-allow-overlap': false,
      'icon-padding': 3,
      'symbol-sort-key': ['coalesce', ['get', 'priority'], 5],
      'text-field': ['step', ['zoom'], '', 13.6, ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13.6, 11, 17, 13],
      'text-variable-anchor': ['right', 'left', 'top', 'bottom'],
      'text-radial-offset': 1.3,
      'text-justify': 'auto',
      'text-max-width': 9,
      'text-optional': true,
      'text-padding': 2,
    },
    paint: {
      'text-color': textColorExpression(['get', 'category'], isDark),
      'text-halo-color': haloColor,
      'text-halo-width': 1.6,
      'text-halo-blur': 0.4,
    },
  };

  // Orden: vectoriales primero (debajo), curada al final (se coloca primero → prioridad en colisiones)
  return [...vectorLayers.reverse(), curatedLayer];
}

/**
 * Construye el GeoJSON del catálogo curado con categoría y prioridad resueltas.
 */
export function buildCuratedPoisGeoJSON(places = []) {
  return {
    type: 'FeatureCollection',
    features: places
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p, idx) => {
        const category = getCuratedCategory(p.category);
        return {
          type: 'Feature',
          properties: {
            id: `curated-${idx}`,
            name: p.name,
            category,
            priority: getCategoryMeta(category).priority,
            subtitle: p.subtitle || 'Barranquilla, Atlántico',
            source: 'RutaQuilla',
          },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        };
      }),
  };
}

/**
 * Dibuja los íconos de categoría (normales y destacados) como ImageData a 2x.
 * `iconSvgs` es un mapa { categoria: '<svg ...>' } generado con lucide + renderToStaticMarkup.
 */
export async function createPoiIconImages(iconSvgs, isDark) {
  if (typeof document === 'undefined') return {};
  const ringColor = isDark ? '#0B1120' : '#FFFFFF';
  const images = {};

  const loadSvg = (svg) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });

  const draw = (glyph, color, featured) => {
    const size = featured ? 60 : 48; // 2x pixel ratio → 30px / 24px
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;
    const r = featured ? 22 : 18;

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1.5;

    if (featured) {
      ctx.beginPath();
      ctx.arc(c, c, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(c, c, r + 2, 0, Math.PI * 2);
    ctx.fillStyle = ringColor;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (glyph) {
      const g = featured ? 24 : 20;
      ctx.drawImage(glyph, c - g / 2, c - g / 2, g, g);
    }
    return ctx.getImageData(0, 0, size, size);
  };

  for (const [id, meta] of Object.entries(POI_CATEGORIES)) {
    const glyph = iconSvgs[id] ? await loadSvg(iconSvgs[id]) : null;
    images[`rq-poi-${id}`] = draw(glyph, meta.color, false);
    images[`rq-poi-featured-${id}`] = draw(glyph, meta.color, true);
  }
  return images;
}
