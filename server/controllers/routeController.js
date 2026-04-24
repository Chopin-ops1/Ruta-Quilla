/**
 * ============================================
 * RutaQuilla - Controlador de Rutas
 * ============================================
 * 
 * Controlador MVC que maneja la lógica de negocio
 * para las rutas de transporte. Incluye:
 * 
 * - Captura de rutas GPS (crowdsourcing)
 * - Búsqueda radial geoespacial ($geoNear)
 * - Listado y filtrado de rutas
 * - Detalle de ruta individual
 */

const Route = require('../models/RouteModel');
const CapturedRoute = require('../models/CapturedRouteModel');

/**
 * POST /api/routes/capture
 * 
 * Captures a GPS route from a user riding a bus.
 * Saves to the CapturedRoute collection (separate from official routes)
 * for admin review and verification.
 * 
 * Body esperado:
 * {
 *   routeName: "C20 - Cra 38",
 *   company: "Sobrusa",
 *   direction: "ida" | "vuelta",
 *   coordinates: [[lng, lat], [lng, lat], ...],
 *   averageAccuracy: 12.5,
 *   durationSeconds: 1800
 * }
 */
async function captureRoute(req, res) {
  try {
    const { routeName, company, direction, coordinates, averageAccuracy, durationSeconds } = req.body;

    // Require authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión para capturar rutas',
      });
    }

    // Validate required fields
    if (!routeName || !company || !direction || !coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: routeName, company, direction, coordinates',
      });
    }

    if (!['ida', 'vuelta'].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: 'direction debe ser "ida" o "vuelta"',
      });
    }

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren al menos 2 coordenadas para trazar una ruta',
      });
    }

    // Validate coordinate format [lng, lat]
    const validCoordinates = coordinates.filter(coord => {
      return Array.isArray(coord) &&
             coord.length === 2 &&
             typeof coord[0] === 'number' &&
             typeof coord[1] === 'number' &&
             coord[0] >= -180 && coord[0] <= 180 &&
             coord[1] >= -90 && coord[1] <= 90;
    });

    if (validCoordinates.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas inválidas. Formato esperado: [[longitud, latitud], ...]',
      });
    }

    // Clean coordinates to 6 decimal places (~0.11m precision)
    const cleanedCoordinates = validCoordinates.map(coord => [
      Math.round(coord[0] * 1e6) / 1e6,
      Math.round(coord[1] * 1e6) / 1e6,
    ]);

    // First coordinate = boarding point
    const boardingCoord = cleanedCoordinates[0];

    const capture = new CapturedRoute({
      routeName,
      company,
      direction,
      boardingPoint: {
        type: 'Point',
        coordinates: boardingCoord,
      },
      geometry: {
        type: 'LineString',
        coordinates: cleanedCoordinates,
      },
      pointCount: cleanedCoordinates.length,
      averageAccuracy: averageAccuracy || 0,
      durationSeconds: durationSeconds || 0,
      userId: req.user._id,
      userName: req.user.name,
      status: 'pending',
    });

    await capture.save();

    res.status(201).json({
      success: true,
      message: 'Ruta capturada exitosamente. Un administrador la revisará pronto.',
      data: { id: capture._id, status: capture.status },
    });
  } catch (error) {
    console.error('Error al capturar ruta:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al guardar la ruta',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * GET /api/routes/nearby?lat=x&lng=y&radius=500
 * 
 * Búsqueda radial geoespacial: Encuentra rutas de bus
 * que pasen cerca de la ubicación del usuario.
 * 
 * Utiliza el pipeline de agregación $geoNear de MongoDB,
 * que requiere un índice 2dsphere en el campo geometry.
 * 
 * $geoNear calcula la distancia en metros desde el punto
 * dado hasta el punto más cercano del LineString de cada ruta.
 * Los resultados se devuelven ordenados por distancia ascendente.
 * 
 * Parámetros de query:
 * - lat: Latitud del punto de búsqueda (requerido)
 * - lng: Longitud del punto de búsqueda (requerido)
 * - radius: Radio de búsqueda en metros (default: 500)
 * - limit: Máximo de resultados (default: 10)
 */
async function getNearbyRoutes(req, res) {
  try {
    const { lat, lng, radius = 500, limit = 10 } = req.query;

    // Validar parámetros requeridos
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros requeridos: lat (latitud), lng (longitud)',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = parseInt(radius);
    const maxResults = parseInt(limit);

    // Validar rangos
    if (isNaN(latitude) || isNaN(longitude) ||
        latitude < -90 || latitude > 90 ||
        longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas fuera de rango. Lat: -90 a 90, Lng: -180 a 180',
      });
    }

    /**
     * Pipeline de agregación $geoNear
     * 
     * Etapa $geoNear debe ser la primera en el pipeline.
     * 
     * - near: Punto GeoJSON desde donde se mide la distancia
     * - distanceField: Campo donde se almacena la distancia calculada
     * - maxDistance: Radio máximo de búsqueda en metros
     * - spherical: true = usar geometría esférica (obligatorio con 2dsphere)
     * 
     * MongoDB recorre el índice 2dsphere para encontrar los
     * LineStrings cuyo punto más cercano esté dentro del radio.
     */
    const routes = await Route.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude], // GeoJSON: [lng, lat]
          },
          distanceField: 'distance', // Distancia en metros
          maxDistance: searchRadius,
          spherical: true,
        },
      },
      // Ordenar por distancia ascendente (más cercana primero)
      { $sort: { distance: 1 } },
      // Limitar resultados
      { $limit: maxResults },
      // Proyectar campos relevantes (optimización de payload)
      {
        $project: {
          name: 1,
          company: 1,
          type: 1,
          geometry: 1,
          stops: 1,
          color: 1,
          verified: 1,
          distance: { $round: ['$distance', 0] }, // Redondear metros
        },
      },
    ]);

    res.json({
      success: true,
      count: routes.length,
      searchPoint: { lat: latitude, lng: longitude },
      radius: searchRadius,
      data: routes,
    });
  } catch (error) {
    console.error('Error en búsqueda radial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar rutas cercanas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * GET /api/routes
 * 
 * Lista todas las rutas con filtros opcionales.
 * 
 * Query params:
 * - type: 'official' | 'community'
 * - company: 'Sobrusa' | 'Coolitoral' | etc.
 * - verified: 'true' | 'false'
 */
async function getAllRoutes(req, res) {
  try {
    const { type, company, verified } = req.query;

    // Construir filtro dinámico
    const filter = {};
    if (type) filter.type = type;
    if (company) filter.company = company;
    if (verified !== undefined) filter.verified = verified === 'true';

    const routes = await Route.find(filter)
      .select('nombre codigo operador origen destino barriosCubiertos recorridoTextual color tieneParadas geometriaOSM ida regreso activa trazadoIncompleto type fare createdAt resolucionPdf codigoAMBQ')
      .sort({ operador: 1, nombre: 1 }) 
      .lean();

    res.json({
      success: true,
      count: routes.length,
      data: routes,
    });
  } catch (error) {
    console.error('Error al listar rutas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las rutas',
    });
  }
}

/**
 * GET /api/routes/auditoria
 * 
 * Devuelve todas las rutas pendientes de auditoría manual.
 */
async function getRouteAudit(req, res) {
  try {
    const routes = await Route.find({ 'audit.revisadoManualmente': false })
      .select('nombre operador geometriaOSM trazadoIncompleto ida regreso audit')
      .lean();

    // Custom sorting: nominatim first, incomplete next, then by coordinates ascending
    routes.sort((a, b) => {
      if (!a.geometriaOSM && b.geometriaOSM) return -1;
      if (a.geometriaOSM && !b.geometriaOSM) return 1;
      
      if (a.trazadoIncompleto && !b.trazadoIncompleto) return -1;
      if (!a.trazadoIncompleto && b.trazadoIncompleto) return 1;

      const aLen = (a.ida?.trazado?.coordinates?.length || 0) + (a.regreso?.trazado?.coordinates?.length || 0);
      const bLen = (b.ida?.trazado?.coordinates?.length || 0) + (b.regreso?.trazado?.coordinates?.length || 0);
      return aLen - bLen;
    });

    res.json({
      success: true,
      count: routes.length,
      data: routes,
    });
  } catch (error) {
    console.error('Error al obtener auditoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener auditoría de rutas',
    });
  }
}

/**
 * GET /api/routes/:id
 * 
 * Obtiene el detalle completo de una ruta por su ID.
 */
async function getRouteById(req, res) {
  try {
    const route = await Route.findById(req.params.id)
      .populate('contributorId', 'name contributions');

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Ruta no encontrada',
      });
    }

    res.json({
      success: true,
      data: route,
    });
  } catch (error) {
    console.error('Error al obtener ruta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la ruta',
    });
  }
}

/**
 * POST /api/routes/navigate
 *
 * Busca las mejores opciones de transporte público entre un
 * origen y un destino.
 *
 * MODELO BARRANQUILLA: Los buses NO tienen paradas fijas.
 * El pasajero sube y baja donde quiera a lo largo de la ruta.
 *
 * Para cada ruta candidata calcula:
 * - Punto más cercano de la ruta al origen (punto de subida dinámico)
 * - Punto más cercano de la ruta al destino (punto de bajada dinámico)
 * - Distancia real a caminar desde/hasta esos puntos
 * - Segmento exacto de la ruta entre board y alight (para dibujar en el mapa)
 *
 * Body esperado:
 * {
 *   origin: { lat: 10.99, lng: -74.78 },
 *   destination: { lat: 10.96, lng: -74.80 }
 * }
 */
async function navigateRoute(req, res) {
  try {
    const { origin, destination } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren origin { lat, lng } y destination { lat, lng }',
      });
    }

    const originLat = parseFloat(origin.lat);
    const originLng = parseFloat(origin.lng);
    const destLat = parseFloat(destination.lat);
    const destLng = parseFloat(destination.lng);

    // Max walking distance to consider a route reachable (1.5 km)
    const MAX_WALK = 1500;

    // 1) Find all routes whose LineString passes near the origin (check both ida and regreso)
    const nearOriginIda = await Route.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [originLng, originLat] },
          distanceField: 'distToOrigin',
          maxDistance: MAX_WALK,
          spherical: true,
          key: 'ida.trazado',
        },
      },
      { $limit: 30 },
      { $addFields: { matchDirection: 'ida' } }
    ]);

    const nearOriginVuelta = await Route.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [originLng, originLat] },
          distanceField: 'distToOrigin',
          maxDistance: MAX_WALK,
          spherical: true,
          key: 'regreso.trazado',
        },
      },
      { $limit: 30 },
      { $addFields: { matchDirection: 'regreso' } }
    ]);

    const nearOrigin = [...nearOriginIda, ...nearOriginVuelta];

    // 2) Collect and check destination for the matches
    // To simplify: we don't do a full intersection query for dest. 
    // We just check the matched routes to see if their corresponding line passes near dest.
    
    const options = [];
    
    for (const route of nearOrigin) {
      const dir = route.matchDirection; // 'ida' | 'regreso'
      const coords = route[dir]?.trazado?.coordinates;
      if (!coords || coords.length < 2) continue;

      // Project origin
      const boardProj = closestPointOnLine([originLng, originLat], coords);
      
      // Project destination
      const alightProj = closestPointOnLine([destLng, destLat], coords);

      // Verify dest is actually close enough
      if (alightProj.distance > MAX_WALK) continue;

      // Directionality Check: board point must come BEFORE alight point
      if (boardProj.segmentIndex > alightProj.segmentIndex ||
          (boardProj.segmentIndex === alightProj.segmentIndex &&
           boardProj.fraction >= alightProj.fraction)) {
        continue; // Bus goes in the wrong direction on this segment
      }

      // Valid option found! Calculate segment
      const busSegCoords = sliceLineString(coords, boardProj, alightProj);

      const boardDist = boardProj.distance;
      const alightDist = alightProj.distance;
      const totalWalk = boardDist + alightDist;
      const walkMinutes = Math.ceil(totalWalk / 80);
      const busDist = lineStringLength(busSegCoords);
      const busMinutes = Math.ceil(busDist / 250);

      options.push({
        route: {
          _id: route._id,
          name: route.nombre,
          company: route.operador,
          color: route.color,
          type: route.type,
          fare: route.fare || 2600,
        },
        direction: dir,
        boardPoint: {
          coordinates: boardProj.point,
          walkDistance: Math.round(boardDist),
          walkMinutes: Math.ceil(boardDist / 80),
        },
        alightPoint: {
          coordinates: alightProj.point,
          walkDistance: Math.round(alightDist),
          walkMinutes: Math.ceil(alightDist / 80),
        },
        busSegment: busSegCoords,
        totalWalkDistance: Math.round(totalWalk),
        totalWalkMinutes: walkMinutes,
        busDistance: Math.round(busDist),
        busMinutes,
        totalMinutes: walkMinutes + busMinutes,
        score: totalWalk * 1.5 + busDist * 0.3,
      });
    }

    // Sort by score (optimal first)
    options.sort((a, b) => a.score - b.score);

    // Filter out duplicates (same route, same direction) choosing the best score
    const uniqueOptions = [];
    const seen = new Set();
    for (const opt of options) {
      const key = `${opt.route._id}-${opt.direction}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueOptions.push(opt);
      }
    }

    // Mark the best option
    if (uniqueOptions.length > 0) {
      uniqueOptions[0].isOptimal = true;
    }

    res.json({
      success: true,
      count: uniqueOptions.length,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
      options: uniqueOptions.slice(0, 5), // Max 5 options
    });
  } catch (error) {
    console.error('Error en navegación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular rutas de navegación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// ============================================
// Geometry Helpers
// ============================================

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

/**
 * Find the closest point on a LineString to a given point.
 * Works in [lng, lat] coordinate space.
 *
 * Returns:
 * - point: [lng, lat] of the closest point on the line
 * - distance: distance in meters from the input point to that closest point
 * - segmentIndex: which segment (0-based) of the line the closest point falls on
 * - fraction: how far along that segment (0.0 to 1.0)
 */
function closestPointOnLine(point, lineCoords) {
  let minDist = Infinity;
  let closestPt = lineCoords[0];
  let bestSegIdx = 0;
  let bestFraction = 0;

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const a = lineCoords[i];
    const b = lineCoords[i + 1];

    // Project point onto segment a→b
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const proj = [a[0] + t * dx, a[1] + t * dy];
    const d = haversineM(point[1], point[0], proj[1], proj[0]);

    if (d < minDist) {
      minDist = d;
      closestPt = proj;
      bestSegIdx = i;
      bestFraction = t;
    }
  }

  return {
    point: [
      Math.round(closestPt[0] * 1e6) / 1e6,
      Math.round(closestPt[1] * 1e6) / 1e6,
    ],
    distance: minDist,
    segmentIndex: bestSegIdx,
    fraction: bestFraction,
  };
}

/**
 * Extract a sub-section of a LineString between two projected points.
 * Returns an array of [lng, lat] coordinates.
 */
function sliceLineString(lineCoords, fromProj, toProj) {
  const result = [fromProj.point];

  // Add all intermediate vertices between fromProj and toProj
  const startSeg = fromProj.segmentIndex;
  const endSeg = toProj.segmentIndex;

  for (let i = startSeg + 1; i <= endSeg; i++) {
    result.push(lineCoords[i]);
  }

  // Add the destination projected point
  result.push(toProj.point);

  return result;
}

/**
 * Calculate the total length of a polyline in meters.
 * Accepts an array of [lng, lat] coordinates.
 */
function lineStringLength(coords) {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineM(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
  }
  return total;
}

/**
 * Asigna un color representativo por empresa de transporte.
 */
function getCompanyColor(company) {
  const colors = {
    'Sobrusa': '#F59E0B',
    'Coolitoral': '#06B6D4',
    'Transmecar': '#10B981',
    'Sobusa': '#EAB308',
    'Cootransnorte': '#8B5CF6',
    'Embusa': '#EC4899',
    'Flota Angulo': '#F97316',
    'Sodis': '#A855F7',
    'Lolaya': '#EF4444',
    'Lucero San Felipe': '#F472B6',
    'Coochofal': '#14B8A6',
    'Cootrasol': '#22D3EE',
    'La Carolina': '#818CF8',
    'Otra': '#6B7280',
  };
  return colors[company] || colors['Otra'];
}

/**
 * POST /api/routes/admin/create
 * Create a new official route (admin only).
 */
async function createRoute(req, res) {
  try {
    const { nombre, operador, color, ida, regreso, fare, codigo, origen, destino, codigoAMBQ, resolucionPdf } = req.body;

    if (!nombre || !operador || !ida?.trazado?.coordinates?.length) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: nombre, operador, ida.trazado.coordinates',
      });
    }

    // Build route object
    const routeData = {
      nombre,
      operador,
      color: color || getCompanyColor(operador),
      type: 'official',
      fare: fare || 2600,
      fuente: 'manual',
      activa: true,
      trazadoIncompleto: false,
      geometriaOSM: false,
      audit: { revisadoManualmente: true, observaciones: `Creada por admin ${req.user.email}` },
      ida: {
        puntoPartida: {
          nombre: origen || 'Inicio Ida',
          coordenadas: {
            type: 'Point',
            coordinates: ida.trazado.coordinates[0],
          },
        },
        puntoFinal: {
          nombre: destino || 'Fin Ida',
          coordenadas: {
            type: 'Point',
            coordinates: ida.trazado.coordinates[ida.trazado.coordinates.length - 1],
          },
        },
        trazado: {
          type: 'LineString',
          coordinates: ida.trazado.coordinates,
        },
      },
      regreso: regreso?.trazado?.coordinates?.length >= 2
        ? {
            puntoPartida: {
              nombre: destino || 'Inicio Vuelta',
              coordenadas: {
                type: 'Point',
                coordinates: regreso.trazado.coordinates[0],
              },
            },
            puntoFinal: {
              nombre: origen || 'Fin Vuelta',
              coordenadas: {
                type: 'Point',
                coordinates: regreso.trazado.coordinates[regreso.trazado.coordinates.length - 1],
              },
            },
            trazado: {
              type: 'LineString',
              coordinates: regreso.trazado.coordinates,
            },
          }
        : {
            // Mirror ida as regreso if not provided
            puntoPartida: {
              nombre: destino || 'Inicio Vuelta',
              coordenadas: {
                type: 'Point',
                coordinates: ida.trazado.coordinates[ida.trazado.coordinates.length - 1],
              },
            },
            puntoFinal: {
              nombre: origen || 'Fin Vuelta',
              coordenadas: {
                type: 'Point',
                coordinates: ida.trazado.coordinates[0],
              },
            },
            trazado: {
              type: 'LineString',
              coordinates: [...ida.trazado.coordinates].reverse(),
            },
          },
    };

    if (codigo) routeData.codigo = codigo;
    if (origen) routeData.origen = origen;
    if (destino) routeData.destino = destino;
    if (codigoAMBQ) routeData.codigoAMBQ = codigoAMBQ;
    if (resolucionPdf) routeData.resolucionPdf = resolucionPdf;

    const route = new Route(routeData);
    await route.save();

    res.status(201).json({
      success: true,
      message: 'Ruta creada exitosamente',
      data: route,
    });
  } catch (error) {
    console.error('Error al crear ruta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la ruta',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * PUT /api/routes/:id
 * Update an existing route (admin only).
 */
async function updateRoute(req, res) {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }

    const updates = req.body;

    // Update simple fields
    const simpleFields = ['nombre', 'operador', 'color', 'fare', 'codigo', 'origen', 'destino', 'activa', 'codigoAMBQ', 'resolucionPdf', 'trazadoIncompleto'];
    for (const field of simpleFields) {
      if (updates[field] !== undefined) {
        route[field] = updates[field];
      }
    }

    // Update ida — auto-generate puntoPartida/puntoFinal from coordinates
    if (updates.ida?.trazado?.coordinates?.length >= 2) {
      const coords = updates.ida.trazado.coordinates;
      route.ida = {
        puntoPartida: {
          nombre: updates.origen || route.origen || 'Inicio Ida',
          coordenadas: { type: 'Point', coordinates: coords[0] },
        },
        puntoFinal: {
          nombre: updates.destino || route.destino || 'Fin Ida',
          coordenadas: { type: 'Point', coordinates: coords[coords.length - 1] },
        },
        trazado: { type: 'LineString', coordinates: coords },
      };
    }

    // Update regreso — auto-generate puntoPartida/puntoFinal from coordinates
    if (updates.regreso?.trazado?.coordinates?.length >= 2) {
      const coords = updates.regreso.trazado.coordinates;
      route.regreso = {
        puntoPartida: {
          nombre: updates.destino || route.destino || 'Inicio Vuelta',
          coordenadas: { type: 'Point', coordinates: coords[0] },
        },
        puntoFinal: {
          nombre: updates.origen || route.origen || 'Fin Vuelta',
          coordenadas: { type: 'Point', coordinates: coords[coords.length - 1] },
        },
        trazado: { type: 'LineString', coordinates: coords },
      };
    }

    route.audit.revisadoManualmente = true;
    route.audit.observaciones = `Actualizada por admin ${req.user.email} el ${new Date().toISOString()}`;
    route.updatedAt = new Date();

    await route.save();

    res.json({
      success: true,
      message: 'Ruta actualizada',
      data: route,
    });
  } catch (error) {
    console.error('Error al actualizar ruta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la ruta',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * DELETE /api/routes/:id
 * Delete a route (admin only).
 */
async function deleteRoute(req, res) {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }

    res.json({
      success: true,
      message: `Ruta "${route.nombre}" eliminada`,
    });
  } catch (error) {
    console.error('Error al eliminar ruta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la ruta',
    });
  }
}

/**
 * DELETE /api/routes/admin/all
 * Delete ALL routes (admin only — use with caution).
 */
async function deleteAllRoutes(req, res) {
  try {
    const result = await Route.deleteMany({});
    res.json({
      success: true,
      message: `${result.deletedCount} rutas eliminadas`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error al eliminar todas las rutas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar las rutas',
    });
  }
}

module.exports = {
  captureRoute,
  getNearbyRoutes,
  getAllRoutes,
  getRouteAudit,
  getRouteById,
  navigateRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  deleteAllRoutes,
};
