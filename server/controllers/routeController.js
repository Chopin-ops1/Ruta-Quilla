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
const { getSystemConfig } = require('../models/SystemConfigModel');
const { logAdminAction } = require('../models/AdminLogModel');
const { mergeSegment } = require('../services/mergeService');
const { isValidCoord } = require('../middleware/security');
const {
  getOfficialStopsForRoute,
  findNearestOfficialStop,
} = require('../services/transmetroStopsService');

function getDefaultFare() {
  const colombiaNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return colombiaNow.getUTCDay() === 0 ? 3800 : 3700;
}

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

    const sysConfig = await getSystemConfig();
    if (!sysConfig.capturesEnabled && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'CAPTURES_DISABLED',
        message: 'La captura comunitaria GPS está pausada temporalmente por el administrador.',
      });
    }

    // Validate required fields & input bounds
    if (typeof routeName !== 'string' || typeof company !== 'string' || !direction || !coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: routeName, company, direction, coordinates',
      });
    }

    const cleanRouteName = routeName.trim();
    const cleanCompany = company.trim();
    if (!cleanRouteName || cleanRouteName.length > 100 || !cleanCompany || cleanCompany.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'routeName y company deben tener entre 1 y 100 caracteres',
      });
    }

    if (!['ida', 'vuelta'].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: 'direction debe ser "ida" o "vuelta"',
      });
    }

    if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren entre 2 y 5000 coordenadas para trazar una ruta',
      });
    }

    // Validate coordinate format [lng, lat]
    const validCoordinates = coordinates.filter(coord => {
      return Array.isArray(coord) &&
             coord.length === 2 &&
             isValidCoord(coord[1], coord[0]);
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
      routeName: cleanRouteName,
      company: cleanCompany,
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

    // ---- Collaborative Merge ----
    // Fusionar este segmento con el CompositeRoute correspondiente
    let mergeResult = null;
    try {
      mergeResult = await mergeSegment({
        routeName: cleanRouteName,
        company: cleanCompany,
        direction,
        coordinates: cleanedCoordinates,
        captureId: capture._id,
        userId: req.user._id,
        userName: req.user.name,
        averageAccuracy: averageAccuracy || 0,
        pointCount: cleanedCoordinates.length,
      });

      // Vincular la captura con su composite
      capture.compositeRouteId = mergeResult.composite._id;
      await capture.save();
    } catch (mergeErr) {
      // El merge es best-effort: si falla, la captura individual ya está guardada
      console.error('⚠️ Error en merge colaborativo (captura guardada igualmente):', mergeErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Ruta capturada exitosamente. Un administrador la revisará pronto.',
      data: {
        id: capture._id,
        status: capture.status,
        // Collaborative merge feedback
        collaborative: mergeResult ? {
          compositeId: mergeResult.composite._id,
          mergeType: mergeResult.mergeType,
          contributionPercent: mergeResult.contributionPercent,
          totalContributors: mergeResult.composite.contributorCount,
          routeCompletion: mergeResult.composite.completionEstimate,
          compositeStatus: mergeResult.composite.status,
          totalSegments: mergeResult.composite.segments.length,
        } : null,
      },
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
    const { lat, lng, radius = 500, limit = 10, includeGeometry = 'true' } = req.query;

    // Validar parámetros requeridos
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros requeridos: lat (latitud), lng (longitud)',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = Math.min(Math.max(parseInt(radius, 10) || 500, 50), 5000);
    const maxResults = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    // Validar rangos
    if (!isValidCoord(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas fuera de rango. Lat: -90 a 90, Lng: -180 a 180',
      });
    }

    const projectFields = {
      externalId: 1,
      nombre: 1,
      codigo: 1,
      descripcion: 1,
      operador: 1,
      sistema: 1,
      esIntermunicipal: 1,
      distanciaKm: 1,
      tieneRegreso: 1,
      tieneParadas: 1,
      origen: 1,
      destino: 1,
      horarios: 1,
      metodosPago: 1,
      color: 1,
      type: 1,
      fare: 1,
      distance: { $round: ['$distance', 0] },
    };

    if (includeGeometry !== 'false') {
      projectFields.ida = 1;
      projectFields.regreso = 1;
    }

    const [nearIda, nearRegreso] = await Promise.all([
      Route.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [longitude, latitude], // GeoJSON: [lng, lat]
            },
            distanceField: 'distance',
            maxDistance: searchRadius,
            spherical: true,
            key: 'ida.trazado',
            query: { activa: true },
          },
        },
        { $limit: maxResults },
        { $project: projectFields },
      ]),
      Route.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            distanceField: 'distance',
            maxDistance: searchRadius,
            spherical: true,
            key: 'regreso.trazado',
            query: { activa: true },
          },
        },
        { $limit: maxResults },
        { $project: projectFields },
      ]),
    ]);

    const byId = new Map();
    for (const r of [...nearIda, ...nearRegreso]) {
      const id = String(r._id);
      const existing = byId.get(id);
      if (!existing || r.distance < existing.distance) {
        byId.set(id, r);
      }
    }

    const routes = [...byId.values()]
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults);

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
 * - operador | company: 'Sobrusa' | 'Coolitoral' | etc.
 * - includeInactive: 'true' para incluir inactivas
 */
async function getAllRoutes(req, res) {
  try {
    const { type, operador, company, includeInactive, sistema, intermunicipal, includeGeometry } = req.query;

    // Construir filtro dinámico (esquema v5 + dataset 2026)
    const filter = {};
    if (includeInactive !== 'true') {
      filter.activa = true;
    }
    if (typeof type === 'string' && ['official', 'community'].includes(type)) {
      filter.type = type;
    }
    if (typeof sistema === 'string' && ['urbano', 'masivo'].includes(sistema)) {
      filter.sistema = sistema;
    }
    if (intermunicipal === 'true') {
      filter.esIntermunicipal = true;
    } else if (intermunicipal === 'false') {
      filter.esIntermunicipal = false;
    }
    const operatorFilter = typeof operador === 'string' ? operador : (typeof company === 'string' ? company : null);
    if (operatorFilter) {
      filter.operador = operatorFilter;
    }

    const baseFields =
      'externalId nombre codigo descripcion operador sistema tipoVehiculo tipoRecorrido esIntermunicipal ' +
      'distanciaKm tieneRegreso tieneParadas origen destino barriosCubiertos recorridoTextual ' +
      'horarios metodosPago color geometriaOSM activa trazadoIncompleto type fare createdAt ' +
      'actualizadoFuente resolucionPdf codigoAMBQ';

    const selectFields = includeGeometry === 'true' ? `${baseFields} ida regreso paradas` : baseFields;

    const routes = await Route.find(filter)
      .select(selectFields)
      .sort({ operador: 1, codigo: 1, nombre: 1 })
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
    const route = await Route.findById(req.params.id).lean();

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Ruta no encontrada',
      });
    }

    if (route.sistema === 'masivo') {
      const official = getOfficialStopsForRoute(route);
      if (official) {
        route.paradasOficiales = official.paradasOficiales;
        if (official.variantesOficiales.length > 1) {
          route.variantesOficiales = official.variantesOficiales;
        }
        route.fuenteParadas = official.fuenteParadas;
      }
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
    const { origin, destination } = req.body || {};

    const originLat = parseFloat(origin?.lat);
    const originLng = parseFloat(origin?.lng);
    const destLat = parseFloat(destination?.lat);
    const destLng = parseFloat(destination?.lng);

    if (!isValidCoord(originLat, originLng) || !isValidCoord(destLat, destLng)) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren coordenadas válidas en origin { lat, lng } y destination { lat, lng }',
      });
    }

    // Max walking distance to consider a route reachable (1.5 km)
    const MAX_WALK = 1500;
    const defaultFare = getDefaultFare();

    // 1) Find all active routes whose LineString passes near the origin (check both ida and regreso)
    const nearOriginIda = await Route.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [originLng, originLat] },
          distanceField: 'distToOrigin',
          maxDistance: MAX_WALK,
          spherical: true,
          key: 'ida.trazado',
          query: { activa: true },
        },
      },
      { $limit: 60 },
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
          query: { activa: true },
        },
      },
      { $limit: 60 },
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

      const boardStop =
        route.sistema === 'masivo'
          ? findNearestOfficialStop(route, boardProj.point[0], boardProj.point[1], 350)
          : null;
      const alightStop =
        route.sistema === 'masivo'
          ? findNearestOfficialStop(route, alightProj.point[0], alightProj.point[1], 350)
          : null;

      options.push({
        route: {
          _id: route._id,
          name: route.nombre,
          codigo: route.codigo || '',
          descripcion: route.descripcion || '',
          company: route.operador,
          color: route.color,
          type: route.type,
          sistema: route.sistema || 'urbano',
          esIntermunicipal: Boolean(route.esIntermunicipal),
          horarios: route.horarios || null,
          metodosPago: route.metodosPago || [],
          fare: route.fare || defaultFare,
        },
        direction: dir,
        boardPoint: {
          coordinates: boardProj.point,
          walkDistance: Math.round(boardDist),
          walkMinutes: Math.ceil(boardDist / 80),
          ...(boardStop ? { nearestStop: boardStop } : {}),
        },
        alightPoint: {
          coordinates: alightProj.point,
          walkDistance: Math.round(alightDist),
          walkMinutes: Math.ceil(alightDist / 80),
          ...(alightStop ? { nearestStop: alightStop } : {}),
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

    // 3) If fewer than 3 direct routes, search 1-transfer combinations
    let finalOptions = [...uniqueOptions];
    if (uniqueOptions.length < 3) {
      const [nearDestIda, nearDestVuelta] = await Promise.all([
        Route.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [destLng, destLat] },
              distanceField: 'distToDest',
              maxDistance: MAX_WALK,
              spherical: true,
              key: 'ida.trazado',
              query: { activa: true },
            },
          },
          { $limit: 45 },
          { $addFields: { matchDirection: 'ida' } },
        ]),
        Route.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [destLng, destLat] },
              distanceField: 'distToDest',
              maxDistance: MAX_WALK,
              spherical: true,
              key: 'regreso.trazado',
              query: { activa: true },
            },
          },
          { $limit: 45 },
          { $addFields: { matchDirection: 'regreso' } },
        ]),
      ]);

      const nearDest = [...nearDestIda, ...nearDestVuelta];

      const originLegs = [];
      for (const routeA of nearOrigin.slice(0, 30)) {
        const dirA = routeA.matchDirection;
        const coordsA = routeA[dirA]?.trazado?.coordinates;
        if (!coordsA || coordsA.length < 2) continue;
        const boardProj = closestPointOnLine([originLng, originLat], coordsA);
        if (boardProj.distance > MAX_WALK) continue;
        originLegs.push({ routeA, dirA, coordsA, boardProj });
      }

      const destLegs = [];
      for (const routeB of nearDest.slice(0, 30)) {
        const dirB = routeB.matchDirection;
        const coordsB = routeB[dirB]?.trazado?.coordinates;
        if (!coordsB || coordsB.length < 2) continue;
        const alightProj = closestPointOnLine([destLng, destLat], coordsB);
        if (alightProj.distance > MAX_WALK) continue;
        destLegs.push({ routeB, dirB, coordsB, alightProj });
      }

      const transferCandidates = [];
      for (const legA of originLegs) {
        for (const legB of destLegs) {
          if (String(legA.routeA._id) === String(legB.routeB._id)) continue;

          const transfer = findBestTransfer(
            legA.coordsA,
            legA.boardProj.segmentIndex,
            legB.coordsB,
            legB.alightProj.segmentIndex
          );

          if (!transfer || transfer.distance > 450) continue;
          if (transfer.idxA <= legA.boardProj.segmentIndex || transfer.idxB >= legB.alightProj.segmentIndex) {
            continue;
          }

          const busSeg1 = sliceLineString(legA.coordsA, legA.boardProj, {
            point: transfer.pointA,
            segmentIndex: transfer.idxA,
            fraction: 0,
          });
          const busSeg2 = sliceLineString(
            legB.coordsB,
            { point: transfer.pointB, segmentIndex: transfer.idxB, fraction: 0 },
            legB.alightProj
          );

          const boardDist = legA.boardProj.distance;
          const transferWalk = transfer.distance;
          const alightDist = legB.alightProj.distance;
          const totalWalk = boardDist + transferWalk + alightDist;
          const walkMinutes = Math.ceil(totalWalk / 80);

          const bus1Dist = lineStringLength(busSeg1);
          const bus2Dist = lineStringLength(busSeg2);
          const totalBusDist = bus1Dist + bus2Dist;
          const bus1Min = Math.ceil(bus1Dist / 250);
          const bus2Min = Math.ceil(bus2Dist / 250);
          const totalBusMinutes = bus1Min + bus2Min;
          const fareA = legA.routeA.fare || defaultFare;
          const fareB = legB.routeB.fare || defaultFare;
          const combinedFare = fareA + fareB;
          const sistemasNoIntegrados = (legA.routeA.sistema || 'urbano') !== (legB.routeB.sistema || 'urbano');
          const transferBoardStop =
            legA.routeA.sistema === 'masivo'
              ? findNearestOfficialStop(legA.routeA, legA.boardProj.point[0], legA.boardProj.point[1], 350)
              : null;
          const transferAlightStop =
            legB.routeB.sistema === 'masivo'
              ? findNearestOfficialStop(legB.routeB, legB.alightProj.point[0], legB.alightProj.point[1], 350)
              : null;

          transferCandidates.push({
            isTransfer: true,
            route: {
              _id: legA.routeA._id,
              name: legA.routeA.nombre,
              codigo: legA.routeA.codigo || '',
              descripcion: legA.routeA.descripcion || '',
              company: legA.routeA.operador,
              color: legA.routeA.color,
              type: legA.routeA.type,
              sistema: legA.routeA.sistema || 'urbano',
              esIntermunicipal: Boolean(legA.routeA.esIntermunicipal),
              horarios: legA.routeA.horarios || null,
              metodosPago: legA.routeA.metodosPago || [],
              fare: combinedFare,
            },
            direction: legA.dirA,
            boardPoint: {
              coordinates: legA.boardProj.point,
              walkDistance: Math.round(boardDist),
              walkMinutes: Math.ceil(boardDist / 80),
              ...(transferBoardStop ? { nearestStop: transferBoardStop } : {}),
            },
            alightPoint: {
              coordinates: legB.alightProj.point,
              walkDistance: Math.round(alightDist),
              walkMinutes: Math.ceil(alightDist / 80),
              ...(transferAlightStop ? { nearestStop: transferAlightStop } : {}),
            },
            busSegment: busSeg1,
            totalWalkDistance: Math.round(totalWalk),
            totalWalkMinutes: walkMinutes,
            busDistance: Math.round(totalBusDist),
            busMinutes: totalBusMinutes,
            totalMinutes: walkMinutes + totalBusMinutes + 4,
            score: totalWalk * 1.5 + totalBusDist * 0.3 + 900,
            transfer: {
              transferPoint: transfer.pointA,
              secondBoardPoint: transfer.pointB,
              walkDistance: Math.round(transferWalk),
              walkMinutes: Math.ceil(transferWalk / 80),
              sistemasNoIntegrados,
              secondRoute: {
                _id: legB.routeB._id,
                name: legB.routeB.nombre,
                codigo: legB.routeB.codigo || '',
                descripcion: legB.routeB.descripcion || '',
                company: legB.routeB.operador,
                color: legB.routeB.color,
                type: legB.routeB.type,
                sistema: legB.routeB.sistema || 'urbano',
                esIntermunicipal: Boolean(legB.routeB.esIntermunicipal),
                horarios: legB.routeB.horarios || null,
                metodosPago: legB.routeB.metodosPago || [],
                fare: fareB,
              },
              secondDirection: legB.dirB,
              secondBusSegment: busSeg2,
              secondBusDistance: Math.round(bus2Dist),
              secondBusMinutes: bus2Min,
            },
          });
        }
      }

      transferCandidates.sort((a, b) => a.score - b.score);
      const uniqueTransfers = [];
      const seenTransfers = new Set();
      for (const tc of transferCandidates) {
        const key = `${tc.route._id}-${tc.direction}->${tc.transfer.secondRoute._id}-${tc.transfer.secondDirection}`;
        if (!seenTransfers.has(key)) {
          seenTransfers.add(key);
          uniqueTransfers.push(tc);
        }
      }

      finalOptions = [...uniqueOptions, ...uniqueTransfers];
      finalOptions.sort((a, b) => a.score - b.score);
    }

    // Mark the best option
    if (finalOptions.length > 0) {
      finalOptions.forEach((o) => { delete o.isOptimal; });
      finalOptions[0].isOptimal = true;
    }

    res.json({
      success: true,
      count: finalOptions.length,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
      options: finalOptions.slice(0, 5), // Max 5 options
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
 * Find the closest transfer pair between route A (from startSegA+1 onward)
 * and route B (from index 0 up to endSegB-1).
 */
function findBestTransfer(coordsA, startSegA, coordsB, endSegB) {
  if (!Array.isArray(coordsA) || !Array.isArray(coordsB)) return null;
  const startA = startSegA + 1;
  const endA = coordsA.length - 1;
  const endB = Math.min(endSegB - 1, coordsB.length - 2);
  if (startA > endA || endB < 0) return null;

  const strideA = Math.max(1, Math.floor((endA - startA + 1) / 45));
  const strideB = Math.max(1, Math.floor((endB + 1) / 45));

  let best = null;
  for (let i = startA; i <= endA; i += strideA) {
    const pA = coordsA[i];
    for (let j = 0; j <= endB; j += strideB) {
      const pB = coordsB[j];
      const dist = haversineM(pA[1], pA[0], pB[1], pB[0]);
      if (!best || dist < best.distance) {
        best = { idxA: i, idxB: j, distance: dist, pointA: pA, pointB: pB };
      }
    }
  }
  return best;
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
    'Excolcar': '#3B82F6',
    'Otra': '#6B7280',
  };
  return colors[company] || colors['Otra'];
}

const HEX_COLOR_RE = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

function filterValidLineCoords(coords) {
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((c) => Array.isArray(c) && c.length >= 2 && isValidCoord(Number(c[1]), Number(c[0])))
    .map((c) => [Number(c[0]), Number(c[1])]);
}

/**
 * POST /api/routes/admin/create
 * Create a new official route (admin only).
 */
async function createRoute(req, res) {
  try {
    const {
      nombre, operador, color, ida, regreso, fare, codigo, origen, destino,
      codigoAMBQ, resolucionPdf, sistema, esIntermunicipal, tipoRecorrido, descripcion, activa,
    } = req.body || {};

    const cleanNombre = typeof nombre === 'string' ? nombre.trim() : '';
    const cleanOperador = typeof operador === 'string' ? operador.trim() : '';
    const idaCoords = filterValidLineCoords(ida?.trazado?.coordinates);

    if (!cleanNombre || !cleanOperador || idaCoords.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: nombre, operador y al menos 2 coordenadas válidas en ida',
      });
    }

    const regCoords = filterValidLineCoords(regreso?.trazado?.coordinates);
    const safeRecorrido = ['circular', 'lineal'].includes(tipoRecorrido)
      ? tipoRecorrido
      : (regCoords.length >= 2 ? 'circular' : 'lineal');
    const safeColorHex = typeof color === 'string' && HEX_COLOR_RE.test(color.trim())
      ? color.trim()
      : getCompanyColor(cleanOperador);
    const safeFare = Number.isFinite(Number(fare)) && Number(fare) >= 0 && Number(fare) <= 50000
      ? Math.round(Number(fare))
      : getDefaultFare();

    const cleanOrigen = typeof origen === 'string' ? origen.trim().slice(0, 120) : '';
    const cleanDestino = typeof destino === 'string' ? destino.trim().slice(0, 120) : '';
    const distanciaKm = Math.round((lineStringLength(idaCoords) / 1000) * 100) / 100;

    // Build route object
    const routeData = {
      nombre: cleanNombre.slice(0, 100),
      operador: cleanOperador.slice(0, 100),
      color: safeColorHex,
      sistema: ['urbano', 'masivo'].includes(sistema) ? sistema : 'urbano',
      esIntermunicipal: Boolean(esIntermunicipal),
      tipoRecorrido: safeRecorrido,
      descripcion: typeof descripcion === 'string' ? descripcion.trim().slice(0, 300) : '',
      distanciaKm,
      tieneRegreso: regCoords.length >= 2,
      type: 'official',
      fare: safeFare,
      fuente: 'manual',
      activa: activa !== undefined ? Boolean(activa) : true,
      trazadoIncompleto: false,
      geometriaOSM: false,
      audit: { revisadoManualmente: true, observaciones: `Creada por admin ${req.user.email}` },
      ida: {
        puntoPartida: {
          nombre: cleanOrigen || 'Inicio Ida',
          coordenadas: {
            type: 'Point',
            coordinates: idaCoords[0],
          },
        },
        puntoFinal: {
          nombre: cleanDestino || 'Fin Ida',
          coordenadas: {
            type: 'Point',
            coordinates: idaCoords[idaCoords.length - 1],
          },
        },
        trazado: {
          type: 'LineString',
          coordinates: idaCoords,
        },
      },
    };

    if (regCoords.length >= 2) {
      routeData.regreso = {
        puntoPartida: {
          nombre: cleanDestino || 'Inicio Vuelta',
          coordenadas: { type: 'Point', coordinates: regCoords[0] },
        },
        puntoFinal: {
          nombre: cleanOrigen || 'Fin Vuelta',
          coordenadas: { type: 'Point', coordinates: regCoords[regCoords.length - 1] },
        },
        trazado: { type: 'LineString', coordinates: regCoords },
      };
    } else if (safeRecorrido === 'circular') {
      routeData.tieneRegreso = true;
      routeData.regreso = {
        puntoPartida: {
          nombre: cleanDestino || 'Inicio Vuelta',
          coordenadas: { type: 'Point', coordinates: idaCoords[idaCoords.length - 1] },
        },
        puntoFinal: {
          nombre: cleanOrigen || 'Fin Vuelta',
          coordenadas: { type: 'Point', coordinates: idaCoords[0] },
        },
        trazado: { type: 'LineString', coordinates: [...idaCoords].reverse() },
      };
    }

    if (typeof codigo === 'string' && codigo.trim()) routeData.codigo = codigo.trim().slice(0, 30);
    if (cleanOrigen) routeData.origen = cleanOrigen;
    if (cleanDestino) routeData.destino = cleanDestino;
    if (typeof codigoAMBQ === 'string' && codigoAMBQ.trim()) routeData.codigoAMBQ = codigoAMBQ.trim().slice(0, 40);
    if (typeof resolucionPdf === 'string' && resolucionPdf.trim()) routeData.resolucionPdf = resolucionPdf.trim().slice(0, 120);

    const route = new Route(routeData);
    await route.save();

    await logAdminAction({
      req,
      action: 'ROUTE_CREATE',
      category: 'route',
      targetType: 'Route',
      targetId: route._id,
      summary: `Ruta creada: ${route.codigo ? `${route.codigo} — ` : ''}${route.nombre} (${route.operador})`,
    });

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

    const updates = req.body || {};

    if (typeof updates.nombre === 'string' && updates.nombre.trim()) {
      route.nombre = updates.nombre.trim().slice(0, 100);
    }
    if (typeof updates.operador === 'string' && updates.operador.trim()) {
      route.operador = updates.operador.trim().slice(0, 100);
    }
    if (typeof updates.color === 'string' && HEX_COLOR_RE.test(updates.color.trim())) {
      route.color = updates.color.trim();
    }
    if (updates.fare !== undefined) {
      const f = Number(updates.fare);
      if (Number.isFinite(f) && f >= 0 && f <= 50000) route.fare = Math.round(f);
    }
    if (typeof updates.codigo === 'string') route.codigo = updates.codigo.trim().slice(0, 30);
    if (typeof updates.descripcion === 'string') route.descripcion = updates.descripcion.trim().slice(0, 300);
    if (typeof updates.sistema === 'string' && ['urbano', 'masivo'].includes(updates.sistema)) {
      route.sistema = updates.sistema;
    }
    if (updates.esIntermunicipal !== undefined) route.esIntermunicipal = Boolean(updates.esIntermunicipal);
    if (typeof updates.tipoRecorrido === 'string' && ['circular', 'lineal'].includes(updates.tipoRecorrido)) {
      route.tipoRecorrido = updates.tipoRecorrido;
    }
    if (typeof updates.origen === 'string') route.origen = updates.origen.trim().slice(0, 120);
    if (typeof updates.destino === 'string') route.destino = updates.destino.trim().slice(0, 120);
    if (updates.activa !== undefined) route.activa = Boolean(updates.activa);
    if (typeof updates.codigoAMBQ === 'string') route.codigoAMBQ = updates.codigoAMBQ.trim().slice(0, 40);
    if (typeof updates.resolucionPdf === 'string') route.resolucionPdf = updates.resolucionPdf.trim().slice(0, 120);
    if (updates.trazadoIncompleto !== undefined) route.trazadoIncompleto = Boolean(updates.trazadoIncompleto);

    // Update ida — auto-generate puntoPartida/puntoFinal from validated coordinates
    if (updates.ida?.trazado?.coordinates !== undefined) {
      const coords = filterValidLineCoords(updates.ida.trazado.coordinates);
      if (coords.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El trazado de ida requiere al menos 2 coordenadas válidas',
        });
      }
      route.ida = {
        puntoPartida: {
          nombre: route.origen || 'Inicio Ida',
          coordenadas: { type: 'Point', coordinates: coords[0] },
        },
        puntoFinal: {
          nombre: route.destino || 'Fin Ida',
          coordenadas: { type: 'Point', coordinates: coords[coords.length - 1] },
        },
        trazado: { type: 'LineString', coordinates: coords },
      };
      route.distanciaKm = Math.round((lineStringLength(coords) / 1000) * 100) / 100;
    }

    // Update or clear regreso
    if (updates.clearRegreso === true) {
      route.regreso = undefined;
      route.tieneRegreso = false;
    } else if (updates.regreso?.trazado?.coordinates !== undefined) {
      const coords = filterValidLineCoords(updates.regreso.trazado.coordinates);
      if (coords.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El trazado de regreso requiere al menos 2 coordenadas válidas',
        });
      }
      route.regreso = {
        puntoPartida: {
          nombre: route.destino || 'Inicio Vuelta',
          coordenadas: { type: 'Point', coordinates: coords[0] },
        },
        puntoFinal: {
          nombre: route.origen || 'Fin Vuelta',
          coordenadas: { type: 'Point', coordinates: coords[coords.length - 1] },
        },
        trazado: { type: 'LineString', coordinates: coords },
      };
      route.tieneRegreso = true;
    }

    if (!route.audit) route.audit = {};
    route.audit.revisadoManualmente =
      updates.revisadoManualmente !== undefined ? Boolean(updates.revisadoManualmente) : true;
    route.audit.observaciones =
      typeof updates.auditObservaciones === 'string' && updates.auditObservaciones.trim()
        ? updates.auditObservaciones.trim().slice(0, 300)
        : `Actualizada por admin ${req.user.email} el ${new Date().toISOString()}`;
    route.updatedAt = new Date();

    await route.save();

    await logAdminAction({
      req,
      action: 'ROUTE_UPDATE',
      category: 'route',
      targetType: 'Route',
      targetId: route._id,
      summary: `Ruta actualizada: ${route.codigo ? `${route.codigo} — ` : ''}${route.nombre}`,
    });

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
 * PATCH /api/routes/:id/toggle-active
 * Alterna o establece rápidamente si una ruta está activa (admin only).
 */
async function toggleRouteActive(req, res) {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }

    const nextActive = req.body?.activa !== undefined ? Boolean(req.body.activa) : !route.activa;
    route.activa = nextActive;
    route.updatedAt = new Date();
    await route.save();

    await logAdminAction({
      req,
      action: 'ROUTE_TOGGLE',
      category: 'route',
      targetType: 'Route',
      targetId: route._id,
      summary: `Ruta ${nextActive ? 'activada' : 'pausada'}: ${route.codigo ? `${route.codigo} — ` : ''}${route.nombre}`,
      metadata: { activa: nextActive },
    });

    res.json({
      success: true,
      message: nextActive ? `Ruta "${route.nombre}" activada` : `Ruta "${route.nombre}" pausada`,
      data: {
        _id: route._id,
        nombre: route.nombre,
        codigo: route.codigo,
        activa: route.activa,
      },
    });
  } catch (error) {
    console.error('Error al cambiar estado de ruta:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar el estado de la ruta' });
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

    await logAdminAction({
      req,
      action: 'ROUTE_DELETE',
      category: 'route',
      targetType: 'Route',
      targetId: route._id,
      summary: `Ruta eliminada: ${route.codigo ? `${route.codigo} — ` : ''}${route.nombre} (${route.operador})`,
    });

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
 * Delete ALL routes (bloqueado en producción salvo ALLOW_BULK_ROUTE_WIPE=true + confirmación textual).
 */
async function deleteAllRoutes(req, res) {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_BULK_ROUTE_WIPE !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'El borrado masivo de rutas está deshabilitado en producción por seguridad.',
        code: 'BULK_WIPE_DISABLED',
      });
    }

    if (req.body?.confirmPhrase !== 'ELIMINAR TODAS LAS RUTAS') {
      return res.status(400).json({
        success: false,
        message: 'Se requiere frase de confirmación exacta: ELIMINAR TODAS LAS RUTAS',
        code: 'CONFIRMATION_REQUIRED',
      });
    }

    const result = await Route.deleteMany({});

    await logAdminAction({
      req,
      action: 'ROUTE_DELETE_ALL',
      category: 'security',
      targetType: 'Route',
      summary: `Borrado masivo ejecutado (${result.deletedCount} rutas)`,
      metadata: { deletedCount: result.deletedCount },
    });

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
  toggleRouteActive,
  deleteRoute,
  deleteAllRoutes,
};
