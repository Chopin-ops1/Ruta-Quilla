/**
 * ============================================
 * RutaQuilla - Merge Service
 * ============================================
 *
 * Motor de fusión geoespacial para captura colaborativa de rutas.
 *
 * Cuando un nuevo segmento llega, este servicio:
 * 1. Busca/crea el CompositeRoute correspondiente
 * 2. Determina cómo el nuevo segmento se relaciona con la geometría existente
 * 3. Fusiona el segmento (extend, fill gap, o replace)
 * 4. Actualiza métricas de completitud
 *
 * Algoritmo de merge:
 * - PREPEND: el nuevo segmento empieza antes que el composite → se pega al inicio
 * - APPEND:  el nuevo segmento termina después que el composite → se pega al final
 * - FILL:    el nuevo segmento cubre un rango intermedio → se inserta/reemplaza
 * - OVERLAP: el segmento solapa con uno existente → se elige el de mejor calidad
 */

const CompositeRoute = require('../models/CompositeRouteModel');
const Route = require('../models/RouteModel');

// ============================================
// Constantes
// ============================================

/** Radio máximo (metros) para considerar dos puntos como "contiguos" */
const PROXIMITY_THRESHOLD = 100;

/** Longitud promedio estimada de una ruta de bus en Barranquilla (metros) */
const AVG_ROUTE_LENGTH = 15000;

// ============================================
// Helpers geoespaciales
// ============================================

/**
 * Distancia Haversine entre dos puntos [lng, lat] en metros.
 */
function haversineM(p1, p2) {
  const R = 6371000;
  const lat1 = (p1[1] * Math.PI) / 180;
  const lat2 = (p2[1] * Math.PI) / 180;
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLon = ((p2[0] - p1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcula la longitud total de un polyline en metros.
 * @param {Array<[number,number]>} coords - Array de [lng, lat]
 * @returns {number} Longitud en metros
 */
function polylineLength(coords) {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineM(coords[i], coords[i + 1]);
  }
  return total;
}

/**
 * Encuentra el índice del punto más cercano en un polyline a un punto dado.
 * @param {[number,number]} point - [lng, lat]
 * @param {Array<[number,number]>} coords - Polyline
 * @returns {{ index: number, distance: number }}
 */
function closestPointIndex(point, coords) {
  let minDist = Infinity;
  let bestIdx = 0;

  for (let i = 0; i < coords.length; i++) {
    const d = haversineM(point, coords[i]);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }

  return { index: bestIdx, distance: minDist };
}

/**
 * Elimina puntos duplicados consecutivos en un polyline.
 * Dos puntos se consideran duplicados si están a < 1m de distancia.
 */
function deduplicateCoords(coords) {
  if (coords.length < 2) return coords;
  const result = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (haversineM(coords[i - 1], coords[i]) > 1) {
      result.push(coords[i]);
    }
  }
  return result;
}

/**
 * Limpia coordenadas a 6 decimales de precisión (~0.11m).
 */
function cleanCoords(coords) {
  return coords.map(c => [
    Math.round(c[0] * 1e6) / 1e6,
    Math.round(c[1] * 1e6) / 1e6,
  ]);
}

// ============================================
// Core Merge Logic
// ============================================

/**
 * Encuentra o crea un CompositeRoute para la ruta dada.
 *
 * @param {string} routeName
 * @param {string} company
 * @param {string} direction - 'ida' | 'vuelta'
 * @returns {Promise<{ composite: Document, isNew: boolean }>}
 */
async function findOrCreateComposite(routeName, company, direction) {
  // Normalizar para matching flexible
  const normalizedName = routeName.trim();
  const normalizedCompany = company.trim();

  let composite = await CompositeRoute.findOne({
    routeName: normalizedName,
    company: normalizedCompany,
    direction,
    status: { $ne: 'promoted' }, // No fusionar en composites ya promovidos
  });

  if (composite) {
    return { composite, isNew: false };
  }

  // No existe → se creará al hacer el primer merge
  return { composite: null, isNew: true };
}

/**
 * Fusiona un nuevo segmento GPS en el CompositeRoute correspondiente.
 *
 * Esta es la función principal del merge engine. Determina automáticamente
 * cómo encaja el nuevo segmento y actualiza la geometría fusionada.
 *
 * @param {object} params
 * @param {string} params.routeName
 * @param {string} params.company
 * @param {string} params.direction
 * @param {Array<[number,number]>} params.coordinates - Coordenadas del nuevo segmento
 * @param {string} params.captureId - ID del CapturedRoute
 * @param {string} params.userId
 * @param {string} params.userName
 * @param {number} params.averageAccuracy
 * @param {number} params.pointCount
 *
 * @returns {Promise<{ composite: Document, mergeType: string, contributionPercent: number }>}
 */
async function mergeSegment({
  routeName, company, direction,
  coordinates, captureId, userId, userName,
  averageAccuracy, pointCount,
}) {
  // ---- Input validation ----
  if (!routeName || !company || !['ida', 'vuelta'].includes(direction)) {
    throw new Error('routeName, company, y direction (ida/vuelta) son requeridos');
  }
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error('Se requieren al menos 2 coordenadas');
  }
  // Limit coordinate array size to prevent memory abuse
  if (coordinates.length > 10000) {
    throw new Error('Máximo 10,000 coordenadas permitidas por segmento');
  }

  const cleanedCoords = cleanCoords(coordinates);

  const { composite: existing, isNew } = await findOrCreateComposite(
    routeName, company, direction
  );

  // ---- CASO 1: Primer segmento — crear el composite ----
  if (isNew || !existing) {
    const segLength = polylineLength(cleanedCoords);

    const composite = new CompositeRoute({
      routeName: routeName.trim(),
      company: company.trim(),
      direction,
      mergedGeometry: {
        type: 'LineString',
        coordinates: cleanedCoords,
      },
      segments: [{
        captureId,
        userId,
        userName,
        startPoint: cleanedCoords[0],
        endPoint: cleanedCoords[cleanedCoords.length - 1],
        pointCount,
        averageAccuracy,
        overlapRange: {
          fromIndex: 0,
          toIndex: cleanedCoords.length - 1,
        },
      }],
      totalLength: segLength,
      contributorCount: 1,
      lastContribution: new Date(),
      status: 'building',
      completionEstimate: estimateCompletion(segLength, routeName, company),
    });

    await composite.save();

    return {
      composite,
      mergeType: 'new',
      contributionPercent: 100,
    };
  }

  // ---- CASO 2: Composite existe — determinar tipo de merge ----
  const existingCoords = existing.mergedGeometry.coordinates;
  const newStart = cleanedCoords[0];
  const newEnd = cleanedCoords[cleanedCoords.length - 1];

  // Encontrar los puntos más cercanos del composite al inicio/fin del nuevo segmento
  const startProj = closestPointIndex(newStart, existingCoords);
  const endProj = closestPointIndex(newEnd, existingCoords);

  let mergedCoords;
  let mergeType;

  // ---- Determinar tipo de merge ----

  // PREPEND: El inicio del nuevo segmento está lejos del composite
  // y el final está cerca del inicio del composite
  if (startProj.distance > PROXIMITY_THRESHOLD && endProj.index <= existingCoords.length * 0.3) {
    // El nuevo segmento extiende al inicio
    const overlapIdx = endProj.index;
    const newPart = cleanedCoords.slice(0, -1); // Sin el último punto (ya existe)
    mergedCoords = deduplicateCoords([...newPart, ...existingCoords.slice(overlapIdx)]);
    mergeType = 'prepend';
  }
  // APPEND: El final del nuevo segmento está lejos del composite
  // y el inicio está cerca del final del composite
  else if (endProj.distance > PROXIMITY_THRESHOLD && startProj.index >= existingCoords.length * 0.7) {
    // El nuevo segmento extiende al final
    const overlapIdx = startProj.index;
    const newPart = cleanedCoords.slice(1); // Sin el primer punto (ya existe)
    mergedCoords = deduplicateCoords([...existingCoords.slice(0, overlapIdx + 1), ...newPart]);
    mergeType = 'append';
  }
  // FILL: El segmento llena un vacío o cubre un rango intermedio
  else if (startProj.distance <= PROXIMITY_THRESHOLD && endProj.distance <= PROXIMITY_THRESHOLD) {
    // Ambos extremos caen dentro del composite — posible overlap/fill
    const fromIdx = Math.min(startProj.index, endProj.index);
    const toIdx = Math.max(startProj.index, endProj.index);

    // Verificar si el nuevo segmento tiene mejor calidad que el existente
    const existingSlice = existingCoords.slice(fromIdx, toIdx + 1);
    const existingDensity = existingSlice.length;
    const newDensity = cleanedCoords.length;

    if (newDensity > existingDensity || averageAccuracy < getSegmentAccuracy(existing, fromIdx, toIdx)) {
      // Reemplazar el tramo con el nuevo (mejor calidad)
      mergedCoords = deduplicateCoords([
        ...existingCoords.slice(0, fromIdx),
        ...cleanedCoords,
        ...existingCoords.slice(toIdx + 1),
      ]);
      mergeType = 'replace';
    } else {
      // El existente es mejor, solo registrar la contribución
      mergedCoords = existingCoords;
      mergeType = 'overlap_kept';
    }
  }
  // EXTEND BOTH: El segmento cubre más que el composite
  else if (startProj.distance > PROXIMITY_THRESHOLD && endProj.distance > PROXIMITY_THRESHOLD) {
    // El nuevo segmento se extiende por ambos lados o es un tramo completamente nuevo
    // Intentar encontrar el mejor punto de fusión
    const closestToStart = closestPointIndex(existingCoords[0], cleanedCoords);
    const closestToEnd = closestPointIndex(existingCoords[existingCoords.length - 1], cleanedCoords);

    if (closestToStart.distance <= PROXIMITY_THRESHOLD || closestToEnd.distance <= PROXIMITY_THRESHOLD) {
      // Hay algún punto de contacto
      if (closestToStart.index < closestToEnd.index) {
        // El composite está contenido dentro del nuevo segmento
        mergedCoords = deduplicateCoords(cleanedCoords);
        mergeType = 'encompass';
      } else {
        mergedCoords = deduplicateCoords([...cleanedCoords, ...existingCoords]);
        mergeType = 'extend_both';
      }
    } else {
      // Sin punto de contacto — segmentos disjuntos, no fusionar geometría
      // Pero sí registrar el segmento como contribución separada
      mergedCoords = existingCoords;
      mergeType = 'disjoint';
    }
  }
  // Default: simple append
  else {
    mergedCoords = deduplicateCoords([...existingCoords, ...cleanedCoords]);
    mergeType = 'default_append';
  }

  // ---- Actualizar el composite ----

  // Recalcular el rango que cubre este nuevo segmento en la geometría fusionada
  const finalStartProj = closestPointIndex(newStart, mergedCoords);
  const finalEndProj = closestPointIndex(newEnd, mergedCoords);

  // Agregar segmento
  existing.segments.push({
    captureId,
    userId,
    userName,
    startPoint: newStart,
    endPoint: newEnd,
    pointCount,
    averageAccuracy,
    overlapRange: {
      fromIndex: Math.min(finalStartProj.index, finalEndProj.index),
      toIndex: Math.max(finalStartProj.index, finalEndProj.index),
    },
  });

  // Actualizar geometría
  existing.mergedGeometry.coordinates = mergedCoords;
  existing.totalLength = polylineLength(mergedCoords);

  // Contar contribuidores únicos
  const uniqueUsers = new Set(existing.segments.map(s => s.userId.toString()));
  existing.contributorCount = uniqueUsers.size;

  existing.lastContribution = new Date();
  existing.completionEstimate = estimateCompletion(existing.totalLength, routeName, company);

  // Si el estimate es >= 90%, marcar como potencialmente completa
  if (existing.completionEstimate >= 90 && existing.status === 'building') {
    existing.status = 'complete';
  }

  await existing.save();

  // Calcular contribución de este segmento
  const segmentLength = polylineLength(cleanedCoords);
  const contributionPercent = existing.totalLength > 0
    ? Math.min(100, Math.round((segmentLength / existing.totalLength) * 100))
    : 100;

  return {
    composite: existing,
    mergeType,
    contributionPercent,
  };
}

/**
 * Obtiene la precisión promedio del segmento que cubre un rango dado.
 */
function getSegmentAccuracy(composite, fromIdx, toIdx) {
  // Buscar segmentos que cubren este rango
  const overlapping = composite.segments.filter(s =>
    s.overlapRange.fromIndex <= toIdx && s.overlapRange.toIndex >= fromIdx
  );

  if (overlapping.length === 0) return Infinity;

  return overlapping.reduce((sum, s) => sum + s.averageAccuracy, 0) / overlapping.length;
}

/**
 * Estima el porcentaje de completitud de un composite basado en
 * la longitud actual vs rutas oficiales similares en la BD.
 *
 * @param {number} currentLength - Longitud actual en metros
 * @param {string} routeName
 * @param {string} company
 * @returns {number} 0-100
 */
function estimateCompletion(currentLength, routeName, company) {
  // Heurística simple: comparar contra longitud promedio de rutas de Barranquilla
  // Las rutas de bus en Barranquilla tienen entre 10-25km típicamente
  const percent = Math.min(100, Math.round((currentLength / AVG_ROUTE_LENGTH) * 100));
  return percent;
}

/**
 * Busca el composite estimado de referencia buscando rutas oficiales
 * similares (misma empresa, nombre parecido).
 * Esto mejora el estimado de completitud.
 *
 * @param {string} routeName
 * @param {string} company
 * @param {string} direction
 * @returns {Promise<number|null>} Longitud de referencia en metros, o null
 */
async function findReferenceLength(routeName, company, direction) {
  try {
    // Escape regex special characters for safety
    const safeName = routeName.split(/[-\u2013]/)[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const official = await Route.findOne({
      operador: company,
      nombre: { $regex: safeName, $options: 'i' },
    }).select('ida regreso').lean();

    if (!official) return null;

    const field = direction === 'ida' ? 'ida' : 'regreso';
    const coords = official[field]?.trazado?.coordinates;
    if (!coords || coords.length < 2) return null;

    return polylineLength(coords);
  } catch {
    return null;
  }
}

// ============================================
// Exports
// ============================================

module.exports = {
  mergeSegment,
  findOrCreateComposite,
  estimateCompletion,
  findReferenceLength,
  haversineM,
  polylineLength,
  closestPointIndex,
  PROXIMITY_THRESHOLD,
};
