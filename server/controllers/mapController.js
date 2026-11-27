/**
 * ============================================
 * RutaQuilla - Controlador de Mapas
 * ============================================
 * 
 * Maneja funcionalidades relacionadas con mapas:
 * - Descarga offline (solo premium/Quilla-Pass)
 * - Datos de comercios patrocinados (publicidad)
 */

const axios = require('axios');
const Route = require('../models/RouteModel');
const { getSystemConfig } = require('../models/SystemConfigModel');
const { issueFormToken } = require('../services/emailSecurityService');
const { isValidCoord } = require('../middleware/security');
const { getAllPhysicalStops } = require('../services/transmetroStopsService');

const BQ_CENTER = { lat: 10.9685, lng: -74.7813 };
const BQ_BBOX = { west: -75.15, south: 10.78, east: -74.68, north: 11.12 };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const POI_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_POI_CACHE_ENTRIES = 200;

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const geocodeCache = new Map();
const reverseCache = new Map();
const poiCache = new Map();
const roadSafetyCache = new Map();

function getCachedValue(cache, key, ttlMs = CACHE_TTL_MS) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  // Refresh LRU recency
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function setCachedValue(cache, key, data, maxEntries = MAX_CACHE_ENTRIES) {
  if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Convierte direcciones tipo "Calle 65 38 20" o "Carrera 46 82 30" a formato colombiano "Calle 65 #38-20".
 */
function formatColombianAddress(rawAddr) {
  if (typeof rawAddr !== 'string') return '';
  const cleaned = rawAddr
    .replace(/\s+/g, ' ')
    .replace(/\s*#\s*/g, ' #')
    .trim();
  const streetMatch = cleaned.match(
    /^((?:Avenida\s+)?(?:Calle|Carrera|Diagonal|Transversal|Circular|Vía|Via|Autopista)\s+\d+[A-Za-z]*(?:\s+(?:Bis|Sur|Este|Norte|Oeste))?)\s+(\d+[A-Za-z]*)\s+(\d+[A-Za-z]*)$/i
  );
  if (streetMatch) {
    return `${streetMatch[1]} #${streetMatch[2]}-${streetMatch[3]}`;
  }
  const shortMatch = cleaned.match(
    /^((?:Avenida\s+)?(?:Calle|Carrera|Diagonal|Transversal|Circular|Vía|Via|Autopista)\s+\d+[A-Za-z]*)\s+#?(\d+[A-Za-z]*)\s*-\s*(\d+[A-Za-z]*)$/i
  );
  if (shortMatch) {
    return `${shortMatch[1]} #${shortMatch[2]}-${shortMatch[3]}`;
  }
  return cleaned;
}

/**
 * Normaliza consultas con nomenclatura colombiana para mejorar coincidencias en ArcGIS/OSM/Photon.
 */
function normalizeBarranquillaQuery(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/\b(?:cra|kr|k)\.?(?=\s|$|\d)/gi, 'Carrera')
    .replace(/\b(?:cll|cl)\.?(?=\s|$|\d)/gi, 'Calle')
    .replace(/\bav\.?(?=\s|$)/gi, 'Avenida')
    .replace(/\b(?:diag|dg)\.?(?=\s|$|\d)/gi, 'Diagonal')
    .replace(/\b(?:transv|tv)\.?(?=\s|$|\d)/gi, 'Transversal')
    .replace(/[#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeStreetAddress(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (/\d+\s*#\s*\d+/.test(s)) return true;
  if (/\b(?:calle|cll|cl|carrera|cra|kr|k|diagonal|diag|dg|transversal|transv|tv|circular|via|vía)\s*\.?\s*\d+/i.test(s)) {
    return true;
  }
  if (/\b(?:murillo|circunvalar|cordialidad)\b.*\d+/i.test(s)) return true;
  return false;
}

function isGenericPlaceName(raw) {
  const norm = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return !norm || [
    'barranquilla',
    'soledad',
    'malambo',
    'puerto colombia',
    'galapa',
    'atlantico',
    'colombia',
  ].includes(norm);
}

function formatPhotonFeature(feature) {
  const props = feature?.properties || {};
  const coords = feature?.geometry?.coordinates || [];
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const streetLine = props.street
    ? `${props.street}${props.housenumber ? ` #${props.housenumber}` : ''}`
    : '';
  const primary = props.name || streetLine || props.district || props.city || 'Barranquilla';
  const secondaryParts = [];
  if (streetLine && props.name && props.name !== props.street) {
    secondaryParts.push(streetLine);
  }
  const area = props.locality || props.district;
  if (area && area !== primary) secondaryParts.push(area);
  const city = props.city || props.county;
  if (city && city !== primary && !secondaryParts.includes(city)) secondaryParts.push(city);

  return {
    displayName: primary,
    subtitle: secondaryParts.join(', ') || 'Barranquilla, Atlántico',
    lat,
    lng,
    type: props.osm_value || props.type || 'place',
    category: props.osm_key || 'place',
    source: 'photon',
  };
}

function formatNominatimItem(item) {
  const lat = parseFloat(item?.lat);
  const lng = parseFloat(item?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const addr = item.address || {};
  const road = addr.road
    ? `${addr.road}${addr.house_number ? ` #${addr.house_number}` : ''}`
    : '';
  const primary = (item.name && item.name !== addr.road ? item.name : road) ||
    item.display_name?.split(',')[0]?.trim() ||
    'Barranquilla';
  const secondaryParts = [];
  if (road && primary !== road) secondaryParts.push(road);
  const area = addr.neighbourhood || addr.suburb;
  if (area && area !== primary) secondaryParts.push(area);
  const city = addr.city || addr.town || 'Barranquilla';
  if (city && city !== primary && !secondaryParts.includes(city)) secondaryParts.push(city);

  return {
    displayName: primary,
    subtitle: secondaryParts.join(', ') || 'Barranquilla, Atlántico',
    lat,
    lng,
    type: item.type || 'place',
    category: item.class || 'place',
    source: 'nominatim',
  };
}

function dedupeResults(items, { tightRadius = false } = {}) {
  const deduped = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || !isValidCoord(item.lat, item.lng, true)) continue;
    const coordPrecision = tightRadius ? 4 : 3;
    const key = `${item.displayName.toLowerCase()}|${item.lat.toFixed(coordPrecision)},${item.lng.toFixed(coordPrecision)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 6) break;
  }
  return deduped;
}

async function searchArcGisPlaces(normalizedQuery, headers) {
  try {
    const resp = await axios.get(
      'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
      {
        params: {
          f: 'json',
          SingleLine: `${normalizedQuery}, Barranquilla, Atlantico, COL`,
          location: `${BQ_CENTER.lng},${BQ_CENTER.lat}`,
          searchExtent: `${BQ_BBOX.west},${BQ_BBOX.south},${BQ_BBOX.east},${BQ_BBOX.north}`,
          outFields: 'Match_addr,Addr_type,StName,AddNum,Nbrhd,City',
          maxLocations: 6,
          langCode: 'ES',
        },
        timeout: 4500,
        headers,
      }
    );
    const candidates = Array.isArray(resp.data?.candidates) ? resp.data.candidates : [];
    const mapped = candidates
      .filter((c) => Number(c?.score) >= 75)
      .map((c) => {
        const lat = Number(c?.location?.y);
        const lng = Number(c?.location?.x);
        const attrs = c?.attributes || {};
        const rawFirst = String(attrs.Match_addr || c.address || '').split(',')[0].trim();
        const displayName = formatColombianAddress(rawFirst) || rawFirst || normalizedQuery;
        const neighborhood = String(attrs.Nbrhd || '').trim();
        const city = String(attrs.City || 'Barranquilla').trim();
        const subtitle = [neighborhood, city].filter(Boolean).join(', ') || 'Barranquilla, Atlántico';
        return {
          displayName,
          subtitle,
          lat,
          lng,
          type: attrs.Addr_type || 'address',
          category: 'address',
          source: 'arcgis',
        };
      });
    return dedupeResults(mapped, { tightRadius: true });
  } catch (err) {
    console.warn('ArcGIS geocode fallback:', err.message);
    return [];
  }
}

/**
 * GET /api/maps/geocode?q=...
 * Autocompletado geocodificado con caché LRU y cascada gratuita:
 * Direcciones viales -> ArcGIS primero (+ Geoapify/Photon/Nominatim).
 * Lugares/POIs -> Geoapify/Photon primero (+ ArcGIS/Nominatim).
 */
async function geocodePlaces(req, res) {
  try {
    const rawQ = req.query.q;
    if (typeof rawQ !== 'string') {
      return res.status(400).json({ success: false, message: 'Parámetro q requerido' });
    }

    const trimmed = rawQ.trim();
    if (trimmed.length < 2 || trimmed.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'La búsqueda debe tener entre 2 y 120 caracteres',
      });
    }

    const normalized = normalizeBarranquillaQuery(trimmed);
    const isStreetQuery = looksLikeStreetAddress(trimmed);
    const cacheKey = `${isStreetQuery ? 'st:' : 'pl:'}${normalized.toLowerCase()}`;
    const cached = getCachedValue(geocodeCache, cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, data: cached });
    }

    let results = [];
    const headers = { 'User-Agent': 'RutaQuilla/2.0 (https://rutaquilla.me)' };

    // Para direcciones colombianas exactas ("Calle 84 #46-20", "Cra 53 #76-50", "Calle 72 con Cra 43"): ArcGIS primero
    if (isStreetQuery) {
      results = await searchArcGisPlaces(normalized, headers);
    }

    // 1. Geoapify (opcional si hay API key configurada)
    if (results.length < 3 && process.env.GEOAPIFY_API_KEY) {
      try {
        const resp = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
          params: {
            text: normalized,
            apiKey: process.env.GEOAPIFY_API_KEY,
            lang: 'es',
            limit: 6,
            filter: `rect:${BQ_BBOX.west},${BQ_BBOX.south},${BQ_BBOX.east},${BQ_BBOX.north}`,
            bias: `proximity:${BQ_CENTER.lng},${BQ_CENTER.lat}`,
          },
          timeout: 5000,
          headers,
        });
        const features = resp.data?.features || [];
        const geoResults = features.map((f) => {
          const p = f.properties || {};
          const [lng, lat] = f.geometry?.coordinates || [];
          return {
            displayName: p.name || p.address_line1 || p.formatted || normalized,
            subtitle: p.address_line2 || p.suburb || p.city || 'Barranquilla, Atlántico',
            lat: Number(lat),
            lng: Number(lng),
            type: p.result_type || 'place',
            category: p.category || 'place',
            source: 'geoapify',
          };
        });
        results = dedupeResults([...results, ...geoResults], { tightRadius: isStreetQuery });
      } catch (err) {
        console.warn('Geoapify geocode fallback:', err.message);
      }
    }

    // 2. Photon (OSM gratis sin API key)
    if (results.length < 3) {
      try {
        const resp = await axios.get('https://photon.komoot.io/api/', {
          params: {
            q: normalized,
            lat: BQ_CENTER.lat,
            lon: BQ_CENTER.lng,
            bbox: `${BQ_BBOX.west},${BQ_BBOX.south},${BQ_BBOX.east},${BQ_BBOX.north}`,
            limit: 6,
          },
          timeout: 4500,
          headers,
        });
        const features = resp.data?.features || [];
        const photonResults = features.map(formatPhotonFeature);
        results = dedupeResults([...results, ...photonResults], { tightRadius: isStreetQuery });
      } catch (err) {
        console.warn('Photon geocode fallback:', err.message);
      }
    }

    // Si era búsqueda general y aún hay pocos resultados útiles, consultar ArcGIS
    if (!isStreetQuery && results.length < 2) {
      const arcResults = await searchArcGisPlaces(normalized, headers);
      results = dedupeResults([...results, ...arcResults]);
    }

    // 3. Nominatim fallback
    if (results.length === 0) {
      try {
        const resp = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: `${normalized}, Barranquilla, Colombia`,
            format: 'json',
            addressdetails: 1,
            limit: 6,
            viewbox: `${BQ_BBOX.west},${BQ_BBOX.south},${BQ_BBOX.east},${BQ_BBOX.north}`,
            bounded: 1,
          },
          timeout: 5000,
          headers: { ...headers, 'Accept-Language': 'es' },
        });
        const items = Array.isArray(resp.data) ? resp.data : [];
        results = dedupeResults(items.map(formatNominatimItem), { tightRadius: isStreetQuery });
      } catch (err) {
        console.warn('Nominatim geocode fallback failed:', err.message);
      }
    }

    if (results.length > 0) {
      setCachedValue(geocodeCache, cacheKey, results);
    }

    res.json({ success: true, cached: false, data: results });
  } catch (error) {
    console.error('Error en geocodePlaces:', error);
    res.status(500).json({ success: false, message: 'Error al buscar direcciones' });
  }
}

/**
 * GET /api/maps/reverse?lat=...&lng=...
 * Geocodificación inversa con caché LRU (Geoapify opcional -> ArcGIS -> Photon -> Nominatim).
 */
async function reverseGeocodePoint(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (!isValidCoord(lat, lng)) {
      return res.status(400).json({ success: false, message: 'Coordenadas inválidas' });
    }

    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = getCachedValue(reverseCache, cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, resolved: true, data: { displayName: cached, lat, lng } });
    }

    let displayName = null;
    const headers = { 'User-Agent': 'RutaQuilla/2.0 (https://rutaquilla.me)' };

    // 1. Geoapify opcional
    if (process.env.GEOAPIFY_API_KEY) {
      try {
        const resp = await axios.get('https://api.geoapify.com/v1/geocode/reverse', {
          params: { lat, lon: lng, apiKey: process.env.GEOAPIFY_API_KEY, lang: 'es' },
          timeout: 4500,
          headers,
        });
        const p = resp.data?.features?.[0]?.properties;
        const candidate = p?.address_line1 || p?.street || p?.name || p?.suburb || null;
        if (candidate && !isGenericPlaceName(candidate)) {
          displayName = p?.suburb && !candidate.includes(p.suburb) ? `${candidate}, ${p.suburb}` : candidate;
        }
      } catch (err) {
        console.warn('Geoapify reverse fallback:', err.message);
      }
    }

    // 2. ArcGIS World Reverse Geocode (muy preciso en nomenclatura vial de Barranquilla)
    if (!displayName) {
      try {
        const resp = await axios.get(
          'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode',
          {
            params: {
              f: 'json',
              location: `${lng},${lat}`,
              langCode: 'ES',
            },
            timeout: 4500,
            headers,
          }
        );
        const addr = resp.data?.address;
        if (addr) {
          const streetRaw = addr.ShortLabel || addr.Address || addr.PlaceName || '';
          const formattedStreet = formatColombianAddress(streetRaw);
          const hood = String(addr.Neighborhood || addr.District || '').trim();
          if (formattedStreet && !isGenericPlaceName(formattedStreet)) {
            displayName = hood && !isGenericPlaceName(hood) && !formattedStreet.toLowerCase().includes(hood.toLowerCase())
              ? `${formattedStreet}, ${hood}`
              : formattedStreet;
          } else if (hood && !isGenericPlaceName(hood)) {
            displayName = hood;
          }
        }
      } catch (err) {
        console.warn('ArcGIS reverse fallback:', err.message);
      }
    }

    // 3. Photon reverse
    if (!displayName) {
      try {
        const resp = await axios.get('https://photon.komoot.io/reverse', {
          params: { lat, lon: lng },
          timeout: 4500,
          headers,
        });
        const formatted = formatPhotonFeature(resp.data?.features?.[0]);
        if (formatted?.displayName && !isGenericPlaceName(formatted.displayName)) {
          displayName = formatted.subtitle && !formatted.subtitle.startsWith('Barranquilla')
            ? `${formatted.displayName}, ${formatted.subtitle.split(',')[0]}`
            : formatted.displayName;
        }
      } catch (err) {
        console.warn('Photon reverse fallback:', err.message);
      }
    }

    // 4. Nominatim reverse
    if (!displayName) {
      try {
        const resp = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: { lat, lon: lng, format: 'json', addressdetails: 1 },
          timeout: 4500,
          headers: { ...headers, 'Accept-Language': 'es' },
        });
        const formatted = formatNominatimItem(resp.data);
        if (formatted?.displayName && !isGenericPlaceName(formatted.displayName)) {
          displayName = formatted.subtitle && !formatted.subtitle.startsWith('Barranquilla')
            ? `${formatted.displayName}, ${formatted.subtitle.split(',')[0]}`
            : formatted.displayName;
        }
      } catch (err) {
        console.warn('Nominatim reverse fallback:', err.message);
      }
    }

    if (displayName) {
      setCachedValue(reverseCache, cacheKey, displayName);
    }

    res.json({
      success: true,
      cached: false,
      resolved: Boolean(displayName),
      data: {
        displayName: displayName || null,
        lat,
        lng,
      },
    });
  } catch (error) {
    console.error('Error en reverseGeocodePoint:', error);
    res.status(500).json({ success: false, message: 'Error en geocodificación inversa' });
  }
}

/**
 * GET /api/maps/download
 * 
 * Endpoint de descarga de mapa offline.
 * RESTRINGIDO: Solo usuarios premium (Quilla-Pass).
 * 
 * El middleware requirePremium ya verificó el acceso
 * antes de llegar a este controlador.
 * 
 * En un entorno de producción, esto generaría un archivo
 * con los tiles del mapa y las rutas en formato GeoJSON
 * para uso sin conexión.
 */
async function downloadOfflineMap(req, res) {
  try {
    // Obtener todas las rutas activas para el paquete offline (esquema v5)
    const routes = await Route.find({ activa: true })
      .select('nombre codigo operador origen destino color type fare ida regreso')
      .lean();

    const features = [];
    for (const route of routes) {
      const baseProps = {
        routeId: route._id,
        name: route.nombre,
        codigo: route.codigo || '',
        company: route.operador,
        origen: route.origen || '',
        destino: route.destino || '',
        color: route.color,
        type: route.type,
        fare: route.fare || 3700,
      };

      if (route.ida?.trazado?.coordinates?.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { ...baseProps, direction: 'ida' },
          geometry: route.ida.trazado,
        });
      }

      if (route.regreso?.trazado?.coordinates?.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { ...baseProps, direction: 'regreso' },
          geometry: route.regreso.trazado,
        });
      }
    }

    // Construir paquete GeoJSON válido para uso offline
    const offlinePackage = {
      type: 'FeatureCollection',
      metadata: {
        generatedAt: new Date().toISOString(),
        city: 'Barranquilla',
        version: '2.0.0',
        routeCount: routes.length,
        featureCount: features.length,
      },
      features,
    };

    // Enviar como archivo descargable JSON
    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Content-Disposition', 'attachment; filename="rutaquilla-offline.geojson"');
    res.json(offlinePackage);
  } catch (error) {
    console.error('Error al generar mapa offline:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar el paquete de mapa offline',
    });
  }
}

/**
 * GET /api/maps/sponsored
 * 
 * Retorna los comercios patrocinados para mostrar
 * como marcadores publicitarios en el mapa.
 * 
 * Solo se muestran a usuarios con rol 'free'.
 * Los usuarios premium no ven publicidad.
 * 
 * En producción, estos datos vendrían de una colección
 * de anunciantes en MongoDB. Aquí usamos datos estáticos
 * para demostración.
 */
async function getSponsoredLocations(req, res) {
  try {
    // Datos de comercios patrocinados en Barranquilla (demo)
    const sponsoredLocations = [
      {
        id: 'sponsor-1',
        name: 'Restaurante La Casa del Marisco',
        category: 'Restaurante',
        description: '¡Los mejores mariscos del Caribe! Descuento 15% con RutaQuilla',
        coordinates: [-74.7968, 10.9978],
        icon: 'utensils',
        promo: '15% OFF',
        color: '#F59E0B',
      },
      {
        id: 'sponsor-2',
        name: 'Farmacia Barranquilla Centro',
        category: 'Farmacia',
        description: 'Tu farmacia de confianza. Abierta 24 horas.',
        coordinates: [-74.7788, 10.9808],
        icon: 'pill',
        promo: 'Envío gratis',
        color: '#10B981',
      },
      {
        id: 'sponsor-3',
        name: 'Centro Comercial Buenavista',
        category: 'Shopping',
        description: 'Moda, tecnología y diversión. ¡Visitanos!',
        coordinates: [-74.82767, 11.01315],
        icon: 'shopping-bag',
        promo: 'Hasta 50% OFF',
        color: '#8B5CF6',
      },
      {
        id: 'sponsor-4',
        name: 'Taller Mecánico Don José',
        category: 'Automotriz',
        description: 'Revisión técnica y mantenimiento. Precio justo.',
        coordinates: [-74.8035, 10.9782],
        icon: 'wrench',
        promo: 'Diagnóstico gratis',
        color: '#EF4444',
      },
      {
        id: 'sponsor-5',
        name: 'Panadería El Trigal',
        category: 'Panadería',
        description: 'Pan artesanal y butifarras. Tradición barranquillera.',
        coordinates: [-74.8048, 10.9958],
        icon: 'cake',
        promo: '2x1 en pan',
        color: '#F97316',
      },
    ];

    res.json({
      success: true,
      count: sponsoredLocations.length,
      data: sponsoredLocations,
    });
  } catch (error) {
    console.error('Error al obtener sponsors:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ubicaciones patrocinadas',
    });
  }
}

function normalizePoiName(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapOsmPoiCategory(tags = {}) {
  const { amenity, shop, leisure, tourism, public_transport: pt } = tags;
  if (shop === 'mall' || shop === 'department_store') return 'mall';
  if (shop === 'supermarket') return 'supermarket';
  if (amenity === 'university' || amenity === 'college') return 'university';
  if (amenity === 'hospital' || amenity === 'clinic') return 'hospital';
  if (amenity === 'pharmacy') return 'pharmacy';
  if (amenity === 'bank') return 'bank';
  if (amenity === 'bus_station' || pt === 'station') return 'transit';
  if (leisure === 'park') return 'park';
  if (leisure === 'stadium' || leisure === 'sports_centre' || tourism === 'attraction' || tourism === 'museum' || tourism === 'hotel' || amenity === 'theatre' || amenity === 'cinema' || amenity === 'library') {
    return 'landmark';
  }
  if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food') return 'food';
  if (amenity === 'marketplace' || amenity === 'fuel' || amenity === 'police') return 'landmark';
  return 'landmark';
}

function formatOsmPoiElement(el) {
  const tags = el?.tags || {};
  const name = tags.name ? String(tags.name).trim() : '';
  const lat = Number(el?.lat ?? el?.center?.lat);
  const lng = Number(el?.lon ?? el?.center?.lon);
  if (!name || !isValidCoord(lat, lng, true)) return null;

  const street = tags['addr:street']
    ? `${tags['addr:street']}${tags['addr:housenumber'] ? ` #${tags['addr:housenumber']}` : ''}`
    : '';
  const area = tags['addr:suburb'] || tags['addr:neighbourhood'] || '';
  const subtitle = [street, area, tags.operator].filter(Boolean).join(', ') || 'Barranquilla, Atlántico';

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    category: mapOsmPoiCategory(tags),
    subtitle,
    lat,
    lng,
    source: 'OSM en vivo',
  };
}

/**
 * GET /api/maps/pois?south=...&west=...&north=...&east=...
 * Obtiene POIs actualizados desde OpenStreetMap (Overpass) con failover entre mirrors y caché LRU.
 */
async function getMapPOIs(req, res) {
  try {
    const south = parseFloat(req.query.south);
    const west = parseFloat(req.query.west);
    const north = parseFloat(req.query.north);
    const east = parseFloat(req.query.east);

    if (
      !isValidCoord(south, west, true) ||
      !isValidCoord(north, east, true) ||
      south >= north ||
      west >= east ||
      north - south > 0.08 ||
      east - west > 0.08
    ) {
      return res.status(400).json({
        success: false,
        message: 'Bounding box inválido o demasiado amplio',
      });
    }

    const cacheKey = `${south.toFixed(2)},${west.toFixed(2)},${north.toFixed(2)},${east.toFixed(2)}`;
    const cached = getCachedValue(poiCache, cacheKey, POI_CACHE_TTL_MS);
    if (cached) {
      return res.json({ success: true, cached: true, data: cached });
    }

    const bbox = `${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)}`;
    const query = `
      [out:json][timeout:8];
      (
        node["name"]["amenity"~"^(hospital|clinic|pharmacy|university|college|bank|bus_station|marketplace|fuel|theatre|cinema|library|police|restaurant|cafe|fast_food)$"](${bbox});
        way["name"]["amenity"~"^(hospital|clinic|pharmacy|university|college|bank|bus_station|marketplace|fuel|theatre|cinema|library|police|restaurant|cafe|fast_food)$"](${bbox});
        node["name"]["shop"~"^(mall|supermarket|department_store)$"](${bbox});
        way["name"]["shop"~"^(mall|supermarket|department_store)$"](${bbox});
        node["name"]["leisure"~"^(park|stadium|sports_centre)$"](${bbox});
        way["name"]["leisure"~"^(park|stadium|sports_centre)$"](${bbox});
        node["name"]["tourism"~"^(attraction|museum|hotel)$"](${bbox});
        way["name"]["tourism"~"^(attraction|museum|hotel)$"](${bbox});
        node["name"]["public_transport"="station"](${bbox});
      );
      out center tags 150;
    `.trim();

    let elements = null;
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        const resp = await axios.post(mirror, `data=${encodeURIComponent(query)}`, {
          timeout: 6000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'RutaQuilla/2.0 (https://rutaquilla.me)',
            Accept: 'application/json',
          },
        });
        if (Array.isArray(resp.data?.elements)) {
          elements = resp.data.elements;
          break;
        }
      } catch (err) {
        console.warn(`Overpass POI mirror failed (${mirror}):`, err.message);
      }
    }

    if (!elements) {
      return res.json({ success: true, cached: false, fallback: true, data: [] });
    }

    const deduped = [];
    for (const el of elements) {
      const poi = formatOsmPoiElement(el);
      if (!poi) continue;
      const norm = normalizePoiName(poi.name);
      const isDup = deduped.some(
        (existing) =>
          normalizePoiName(existing.name) === norm &&
          Math.abs(existing.lat - poi.lat) < 0.0005 &&
          Math.abs(existing.lng - poi.lng) < 0.0005
      );
      if (!isDup) {
        deduped.push(poi);
        if (deduped.length >= 120) break;
      }
    }

    if (deduped.length > 0) {
      setCachedValue(poiCache, cacheKey, deduped, MAX_POI_CACHE_ENTRIES);
    }

    res.json({ success: true, cached: false, data: deduped });
  } catch (error) {
    console.error('Error en getMapPOIs:', error);
    res.json({ success: true, cached: false, fallback: true, data: [] });
  }
}

/**
 * GET /api/maps/transmetro-stops
 * Retorna el catálogo deduplicado de paraderos oficiales de Transmetro (datos.gov.co hxy3-94yh).
 */
function getTransmetroStops(req, res) {
  try {
    const payload = getAllPhysicalStops();
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({
      success: true,
      count: payload.total,
      source: payload.source,
      data: payload.data,
    });
  } catch (error) {
    console.error('Error en getTransmetroStops:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener paraderos oficiales de Transmetro',
    });
  }
}

/**
 * GET /api/maps/road-safety
 * Capa opcional de seguridad vial (semaforización svyb-d6ts y fotodetección cpp6-je64 de datos.gov.co)
 * con caché en memoria de 24 horas.
 */
async function getRoadSafetyLayer(req, res) {
  try {
    const cached = getCachedValue(roadSafetyCache, 'road_safety_v1', CACHE_TTL_MS);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.json({
        success: true,
        cached: true,
        count: cached.data.length,
        counts: cached.counts,
        source: 'Datos Abiertos Colombia (datos.gov.co · svyb-d6ts & cpp6-je64)',
        data: cached.data,
      });
    }

    const headers = { 'User-Agent': 'RutaQuilla/2.0 (https://rutaquilla.me)' };
    const [semRes, fotoRes] = await Promise.allSettled([
      axios.get('https://www.datos.gov.co/resource/svyb-d6ts.json', {
        params: { $limit: 1000 },
        timeout: 7000,
        headers,
      }),
      axios.get('https://www.datos.gov.co/resource/cpp6-je64.json', {
        params: { $limit: 200 },
        timeout: 7000,
        headers,
      }),
    ]);

    const items = [];
    let semaforosCount = 0;
    let fotodeteccionCount = 0;

    if (semRes.status === 'fulfilled' && Array.isArray(semRes.value?.data)) {
      semRes.value.data.forEach((row, idx) => {
        const lat = parseFloat(row?.latitud);
        const lng = parseFloat(row?.longitud);
        if (!isValidCoord(lat, lng, true)) return;
        const code = String(row?.codigo || '').trim();
        const loc = String(row?.location || '').trim();
        semaforosCount += 1;
        items.push({
          id: `sem-${idx + 1}`,
          kind: 'semaforo',
          name: loc || (code ? `Semáforo ${code}` : 'Intersección semaforizada'),
          subtitle: code ? `Código ${code}` : 'Intersección semaforizada',
          status: String(row?.estado || 'Registrado').trim(),
          lat,
          lng,
        });
      });
    } else if (semRes.status === 'rejected') {
      console.warn('Semaforización datos.gov.co fallback:', semRes.reason?.message);
    }

    if (fotoRes.status === 'fulfilled' && Array.isArray(fotoRes.value?.data)) {
      fotoRes.value.data.forEach((row, idx) => {
        const pt = row?.point?.coordinates || row?.geocoded_column?.coordinates;
        const lat = parseFloat(row?.latitud ?? pt?.[1]);
        const lng = parseFloat(row?.longitud ?? pt?.[0]);
        if (!isValidCoord(lat, lng, true)) return;
        fotodeteccionCount += 1;
        items.push({
          id: `foto-${idx + 1}`,
          kind: 'fotodeteccion',
          name: String(row?.name || 'Cámara de fotodetección').trim(),
          subtitle: String(row?.tipo_de_infracci_n || 'Control vial').trim(),
          status: 'Activa (ref. datos.gov.co)',
          lat,
          lng,
        });
      });
    } else if (fotoRes.status === 'rejected') {
      console.warn('Fotodetección datos.gov.co fallback:', fotoRes.reason?.message);
    }

    if (items.length === 0) {
      return res.json({
        success: true,
        cached: false,
        fallback: true,
        count: 0,
        counts: { semaforos: 0, fotodeteccion: 0 },
        source: 'Datos Abiertos Colombia (datos.gov.co · svyb-d6ts & cpp6-je64)',
        data: [],
      });
    }

    const payload = {
      counts: { semaforos: semaforosCount, fotodeteccion: fotodeteccionCount },
      data: items,
    };
    setCachedValue(roadSafetyCache, 'road_safety_v1', payload, 4);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json({
      success: true,
      cached: false,
      count: items.length,
      counts: payload.counts,
      source: 'Datos Abiertos Colombia (datos.gov.co · svyb-d6ts & cpp6-je64)',
      data: items,
    });
  } catch (error) {
    console.error('Error en getRoadSafetyLayer:', error);
    return res.json({
      success: true,
      cached: false,
      fallback: true,
      count: 0,
      counts: { semaforos: 0, fotodeteccion: 0 },
      data: [],
    });
  }
}

function getMapCacheStats() {
  return {
    geocode: geocodeCache.size,
    reverse: reverseCache.size,
    pois: poiCache.size,
    roadSafety: roadSafetyCache.size,
  };
}

function clearMapCaches() {
  const cleared = getMapCacheStats();
  geocodeCache.clear();
  reverseCache.clear();
  poiCache.clear();
  roadSafetyCache.clear();
  return cleared;
}

/**
 * GET /api/maps/public-config
 * Retorna configuración pública en vivo (freemium, banner, flags de registro/reportes) y un formToken anti-bot.
 */
async function getPublicConfig(req, res) {
  try {
    const cfg = await getSystemConfig();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        registrationEnabled: cfg.registrationEnabled,
        botShieldEnabled: cfg.botShieldEnabled,
        strictEmailValidation: cfg.strictEmailValidation,
        requireEmailVerification: cfg.requireEmailVerification,
        adminLogin2FA: cfg.adminLogin2FA,
        turnstileEnabled: cfg.turnstileEnabled,
        turnstileSiteKey: cfg.turnstileSiteKey || (process.env.TURNSTILE_SITE_KEY || '').trim(),
        reportsEnabled: cfg.reportsEnabled,
        capturesEnabled: cfg.capturesEnabled,
        maxFreeSearches: cfg.maxFreeSearches,
        banner: {
          enabled: cfg.bannerEnabled,
          type: cfg.bannerType,
          text: cfg.bannerText,
        },
        appRelease: cfg.appRelease,
        formToken: issueFormToken(),
      },
    });
  } catch (error) {
    console.error('Error en getPublicConfig:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración pública',
    });
  }
}

module.exports = {
  downloadOfflineMap,
  getSponsoredLocations,
  geocodePlaces,
  reverseGeocodePoint,
  getMapPOIs,
  getTransmetroStops,
  getRoadSafetyLayer,
  getMapCacheStats,
  clearMapCaches,
  getPublicConfig,
  normalizeBarranquillaQuery,
};
