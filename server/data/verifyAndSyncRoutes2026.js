/**
 * ============================================
 * RutaQuilla - Verificación y Sincronización Fiel 2026
 * ============================================
 *
 * Verifica ruta por ruta en MongoDB Atlas contra:
 *   - rutas_barranquilla.json
 *   - rutas_barranquilla.geojson
 *
 * Reglas:
 * 1. Si una ruta ya coincide exactamente en geometría y metadatos, NO se toca ("intact").
 * 2. Solo actualiza rutas con diferencias (coordenadas exactas del GeoJSON o nombres/códigos).
 * 3. Desactiva (activa: false) rutas legacy ajenas al dataset_2026 que duplicaban empresas/trazados.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Route = require('../models/RouteModel');

const SOURCE_DIR =
  process.argv[2] ||
  path.join('C:', 'Users', 'USER', 'Downloads', 'Nueva carpeta (3)', 'rutas-barranquilla');

const SOURCE_JSON = path.join(SOURCE_DIR, 'rutas_barranquilla.json');
const SOURCE_GEOJSON = path.join(SOURCE_DIR, 'rutas_barranquilla.geojson');

function dedupeLngLat(coords) {
  const out = [];
  for (const pt of coords) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== lng || prev[1] !== lat) {
      out.push([lng, lat]);
    }
  }
  return out;
}

function buildSegment(coords, startName, endName) {
  return {
    puntoPartida: {
      nombre: startName,
      coordenadas: { type: 'Point', coordinates: coords[0] },
    },
    puntoFinal: {
      nombre: endName,
      coordenadas: { type: 'Point', coordinates: coords[coords.length - 1] },
    },
    trazado: {
      type: 'LineString',
      coordinates: coords,
    },
  };
}

function coordsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI no está configurado en .env');
    process.exit(1);
  }
  if (!fs.existsSync(SOURCE_JSON) || !fs.existsSync(SOURCE_GEOJSON)) {
    console.error(`❌ Faltan archivos fuente en ${SOURCE_DIR}`);
    process.exit(1);
  }

  const rawJson = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
  const rawGeo = JSON.parse(fs.readFileSync(SOURCE_GEOJSON, 'utf8'));
  const activeRoutes = (Array.isArray(rawJson) ? rawJson : rawJson.rutas).filter(
    (r) => r.activa === true && Array.isArray(r.recorrido?.puntos) && r.recorrido.puntos.length >= 2
  );

  const geoById = new Map();
  for (const f of rawGeo.features) {
    if (!f.properties?.activa || f.geometry?.type !== 'LineString') continue;
    const id = String(f.properties.id);
    if (!geoById.has(id)) geoById.set(id, {});
    geoById.get(id)[f.properties.sentido] = f.geometry.coordinates;
  }

  console.log('🔄 Conectando a MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 12000,
    socketTimeoutMS: 60000,
  });
  console.log('✅ Conectado a MongoDB Atlas');

  try {
    const dbRoutes = await Route.find({ fuente: 'dataset_2026' }).lean();
    const dbByExternalId = new Map(dbRoutes.map((d) => [String(d.externalId), d]));

    let intactCount = 0;
    let updatedExactCount = 0;
    let updatedDedupFallbackCount = 0;
    let legacyDeactivated = 0;

    for (const r of activeRoutes) {
      const extId = String(r.id);
      const db = dbByExternalId.get(extId);
      const g = geoById.get(extId) || {};

      const geoIda = g.ida || g.unico || r.recorrido.puntos.map((p) => [p[1], p[0]]);
      const geoReg = g.regreso || [];
      const hasReg = geoReg.length >= 2;

      const rawName = String(r.nombre || '').trim();
      const rawDesc = r.descripcion ? String(r.descripcion).trim() : '';
      const isShortCode = /^[A-Z0-9-]{1,8}$/i.test(rawName);
      const expectedCodigo = isShortCode ? rawName : '';
      const expectedNombre = (isShortCode ? rawDesc || rawName : rawName).slice(0, 100);

      const descParts = rawDesc.split(/\s+[-–→]\s+/);
      const origenLabel = descParts[0]?.trim() || db?.origen || 'Inicio';
      const destinoLabel =
        descParts.length > 1 ? descParts[descParts.length - 1].trim() : rawDesc || db?.destino || 'Destino';

      if (!db) {
        console.warn(`⚠️ Falta ruta ${extId} (${rawName}) en DB — creando...`);
        await Route.create({
          externalId: extId,
          nombre: expectedNombre,
          codigo: expectedCodigo,
          descripcion: rawDesc,
          operador: String(r.empresa || 'Otra').trim(),
          sistema: r.sistema === 'masivo' ? 'masivo' : 'urbano',
          tipoVehiculo: r.tipo_vehiculo === 'tren' ? 'tren' : 'bus',
          tipoRecorrido: r.recorrido?.tipo === 'circular' ? 'circular' : 'lineal',
          esIntermunicipal: false,
          distanciaKm: Number(r.recorrido?.distancia_km) || 0,
          tieneRegreso: hasReg,
          origen: origenLabel,
          destino: destinoLabel,
          barriosCubiertos: r.zonas ? String(r.zonas).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [],
          horarios: r.horarios || null,
          metodosPago: Array.isArray(r.metodos_pago) && r.metodos_pago.length ? r.metodos_pago : ['Efectivo'],
          paradas: Array.isArray(r.paradas) ? r.paradas : [],
          tieneParadas: Array.isArray(r.paradas) && r.paradas.length > 0,
          actualizadoFuente: r.actualizado ? new Date(r.actualizado) : null,
          geometriaOSM: true,
          ida: buildSegment(geoIda, origenLabel, destinoLabel),
          ...(hasReg ? { regreso: buildSegment(geoReg, destinoLabel, origenLabel) } : {}),
          activa: true,
          fuente: 'dataset_2026',
          type: 'official',
          fare: 3700,
        });
        updatedExactCount++;
        continue;
      }

      const dbIda = db.ida?.trazado?.coordinates || [];
      const dbReg = db.regreso?.trazado?.coordinates || [];

      const idaMatches = coordsEqual(dbIda, geoIda);
      const regMatches = hasReg ? coordsEqual(dbReg, geoReg) : dbReg.length === 0;
      const metaMatches =
        db.activa === true &&
        db.nombre === expectedNombre &&
        (db.codigo || '') === expectedCodigo &&
        (db.descripcion || '') === rawDesc &&
        db.operador === String(r.empresa || '').trim() &&
        Boolean(db.tieneRegreso) === hasReg;

      if (idaMatches && regMatches && metaMatches) {
        intactCount++;
        continue;
      }

      const setPayload = {
        activa: true,
        nombre: expectedNombre,
        codigo: expectedCodigo,
        descripcion: rawDesc,
        tieneRegreso: hasReg,
      };
      if (!idaMatches) {
        setPayload.ida = buildSegment(geoIda, db.origen || origenLabel, db.destino || destinoLabel);
      }
      if (hasReg && !regMatches) {
        setPayload.regreso = buildSegment(geoReg, db.destino || destinoLabel, db.origen || origenLabel);
      }

      const updateOp = { $set: setPayload };
      if (!hasReg && dbReg.length > 0) {
        updateOp.$unset = { regreso: '' };
      }

      try {
        await Route.updateOne({ _id: db._id }, updateOp);
        updatedExactCount++;
      } catch (err) {
        // MongoDB 2dsphere puede rechazar segmentos degenerados si algún archivo tuviera duplicados inválidos
        if (err.code === 16755 || /16755|2dsphere|Can't extract geo keys/i.test(err.message)) {
          const fallbackSet = { ...setPayload };
          if (!idaMatches) {
            fallbackSet.ida = buildSegment(
              dedupeLngLat(geoIda),
              db.origen || origenLabel,
              db.destino || destinoLabel
            );
          }
          if (hasReg && !regMatches) {
            fallbackSet.regreso = buildSegment(
              dedupeLngLat(geoReg),
              db.destino || destinoLabel,
              db.origen || origenLabel
            );
          }
          await Route.updateOne(
            { _id: db._id },
            { $set: fallbackSet, ...(updateOp.$unset ? { $unset: updateOp.$unset } : {}) }
          );
          updatedDedupFallbackCount++;
        } else {
          throw err;
        }
      }
    }

    // Desactivar rutas manuales legacy ajenas al dataset_2026 (respaldadas en backup_routes_pre_2026.json)
    const legacyRes = await Route.updateMany(
      { fuente: { $ne: 'dataset_2026' }, activa: true },
      {
        $set: {
          activa: false,
          'audit.observaciones': 'Desactivada tras migración fiel dataset_2026 (respaldada en backup_routes_pre_2026.json)',
        },
      }
    );
    legacyDeactivated = legacyRes.modifiedCount || 0;

    await Route.syncIndexes();
    const totalActive = await Route.countDocuments({ activa: true });
    const operatorsActive = (await Route.distinct('operador', { activa: true })).length;

    console.log('\n=== VERIFICACIÓN Y SINCRONIZACIÓN FIEL 2026 ===');
    console.log({
      rutasDatasetActivas: activeRoutes.length,
      intactasSinTocar: intactCount,
      actualizadasGeoJsonExacto: updatedExactCount,
      actualizadasConFallback2dsphere: updatedDedupFallbackCount,
      legacyDesactivadas: legacyDeactivated,
      totalActivasEnAtlas: totalActive,
      empresasActivasEnAtlas: operatorsActive,
    });
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

run().catch((err) => {
  console.error('❌ Error en verificación/sincronización:', err);
  process.exit(1);
});
