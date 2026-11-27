/**
 * ============================================
 * RutaQuilla - Reparación Quirúrgica de Rutas en Zigzag (2026)
 * ============================================
 *
 * Reglas estrictas:
 * 1. NUNCA toca rutas Transmetro (sistema === 'masivo') ni rutas comunitarias (type === 'community').
 * 2. Toma como referencia el trazado oficial de rutas_actuales.json.
 * 3. Solo modifica rutas urbanas con espigas laterales (>= 148° / rebotes), nudos GPS en terminales
 *    o zigzags alternados de carril dentro de una franja recta (<= 18 m).
 * 4. Cualquier ruta urbana sin artefactos ni desfase de corte queda 100% intacta en MongoDB.
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
if (!process.env.MONGO_URI) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const mongoose = require('mongoose');
const Route = require('../models/RouteModel');

const SOURCE_JSON =
  process.argv[2] ||
  path.join('C:', 'Users', 'USER', 'Downloads', 'Nueva carpeta (3)', 'barranquilla-actual', 'rutas_actuales.json');

const BACKUP_JSON = path.join(__dirname, 'backup_routes_pre_zigzag_fix.json');
const SPLIT_SYNC_IDS = new Set(['A20lWPPfOi', 'u9xpGO5IEk']);

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function signedTurn(b1, b2) {
  let d = b2 - b1;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function signedCrossTrackM(latA, lngA, latB, lngB, latP, lngP) {
  const kx = Math.cos((latA * Math.PI) / 180) * 111320;
  const ky = 110540;
  const x2 = (lngB - lngA) * kx;
  const y2 = (latB - latA) * ky;
  const xp = (lngP - lngA) * kx;
  const yp = (latP - latA) * ky;
  const len = Math.hypot(x2, y2);
  if (len < 1) return { xtrack: 0, alongFrac: 0 };
  return {
    xtrack: (x2 * yp - y2 * xp) / len,
    alongFrac: (xp * x2 + yp * y2) / (len * len),
  };
}

/**
 * Limpieza quirúrgica sobre array [lat, lng][].
 * Devuelve { pts: [lat, lng][], stats: { spikes, knots, snakes } }.
 */
function cleanUrbanPolyline(rawPts) {
  if (!Array.isArray(rawPts) || rawPts.length < 4) {
    return {
      pts: Array.isArray(rawPts) ? rawPts.map((p) => [Number(p[0]), Number(p[1])]) : [],
      stats: { spikes: 0, knots: 0, snakes: 0 },
    };
  }

  let pts = rawPts
    .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
    .map((p) => [Number(p[0]), Number(p[1])]);

  const stats = { spikes: 0, knots: 0, snakes: 0 };
  if (pts.length < 4) return { pts, stats };

  // Pase 1: espigas de 1 o 2 vértices (rebotes de separador ~180°)
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    const next = [pts[0]];
    let i = 1;
    while (i < pts.length - 1) {
      const A = next[next.length - 1];
      const B = pts[i];
      const C = pts[i + 1];
      const dAB = haversineM(A[0], A[1], B[0], B[1]);
      const dBC = haversineM(B[0], B[1], C[0], C[1]);
      const chordAC = haversineM(A[0], A[1], C[0], C[1]);

      const turn =
        dAB >= 3 && dBC >= 3
          ? Math.abs(signedTurn(bearingDeg(A[0], A[1], B[0], B[1]), bearingDeg(B[0], B[1], C[0], C[1])))
          : 0;

      const isSingleSpike =
        (turn >= 148 && (chordAC <= 28 || (chordAC < 0.24 * (dAB + dBC) && Math.max(dAB, dBC) < 220))) ||
        (chordAC <= 4 && dAB >= 5 && dBC >= 5);

      if (isSingleSpike) {
        stats.spikes++;
        changed = true;
        i++;
        continue;
      }

      if (i + 2 < pts.length) {
        const D = pts[i + 2];
        const chordAD = haversineM(A[0], A[1], D[0], D[1]);
        const dCD = haversineM(C[0], C[1], D[0], D[1]);
        const pathABCD = dAB + dBC + dCD;
        if (chordAD <= 25 && pathABCD >= 35 && pathABCD <= 450 && chordAD < 0.18 * pathABCD) {
          stats.spikes += 2;
          changed = true;
          i += 2;
          continue;
        }
      }

      next.push(B);
      i++;
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    if (!changed || pts.length < 4) break;
  }

  // Pase 2: nudos / garabatos GPS en terminales o retornos locales
  if (pts.length >= 5) {
    const next = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let collapsed = false;
      for (let win = Math.min(16, pts.length - 1 - i); win >= 4; win--) {
        const A = pts[i];
        const E = pts[i + win];
        const netAE = haversineM(A[0], A[1], E[0], E[1]);
        let path = 0;
        let rev140 = 0;
        let rev145 = 0;

        for (let k = i; k < i + win; k++) {
          const d1 = haversineM(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
          path += d1;
          if (k < i + win - 1) {
            const d2 = haversineM(pts[k + 1][0], pts[k + 1][1], pts[k + 2][0], pts[k + 2][1]);
            if (d1 > 4 && d2 > 4) {
              const t = Math.abs(
                signedTurn(
                  bearingDeg(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]),
                  bearingDeg(pts[k + 1][0], pts[k + 1][1], pts[k + 2][0], pts[k + 2][1])
                )
              );
              if (t >= 140) rev140++;
              if (t >= 145) rev145++;
            }
          }
        }

        if (
          (netAE <= 45 && rev140 >= 2 && path >= Math.max(90, netAE * 4)) ||
          (netAE <= 220 && rev145 >= 3 && path >= Math.max(250, netAE * 3.2))
        ) {
          stats.knots++;
          i += win;
          next.push(pts[i]);
          collapsed = true;
          break;
        }
      }

      if (!collapsed) {
        i++;
        next.push(pts[i]);
      }
    }
    if (next.length >= 2) pts = next;
  }

  // Pase 3: zigzag alternado de carril dentro de una franja recta (<= 18 m de cross-track)
  if (pts.length >= 6) {
    const smoothed = pts.map((p) => [p[0], p[1]]);
    for (let i = 0; i + 5 < pts.length; i++) {
      const A = pts[i];
      const F = pts[i + 5];
      const chordAF = haversineM(A[0], A[1], F[0], F[1]);
      if (chordAF < 80 || chordAF > 550) continue;

      let allInCorridor = true;
      const metrics = [];
      for (let k = i + 1; k < i + 5; k++) {
        const m = signedCrossTrackM(A[0], A[1], F[0], F[1], pts[k][0], pts[k][1]);
        if (Math.abs(m.xtrack) > 18 || m.alongFrac <= 0.03 || m.alongFrac >= 0.97) {
          allInCorridor = false;
          break;
        }
        metrics.push({ idx: k, ...m });
      }
      if (!allInCorridor) continue;

      let altTurns = 0;
      let prevSign = 0;
      for (let k = i; k < i + 4; k++) {
        const d1 = haversineM(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
        const d2 = haversineM(pts[k + 1][0], pts[k + 1][1], pts[k + 2][0], pts[k + 2][1]);
        if (d1 < 6 || d2 < 6) continue;
        const t = signedTurn(
          bearingDeg(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]),
          bearingDeg(pts[k + 1][0], pts[k + 1][1], pts[k + 2][0], pts[k + 2][1])
        );
        if (Math.abs(t) >= 28) {
          const s = Math.sign(t);
          if (prevSign !== 0 && s === -prevSign) altTurns++;
          prevSign = s;
        }
      }

      const maxX = Math.max(...metrics.map((m) => Math.abs(m.xtrack)));
      if (altTurns >= 2 && maxX >= 4.5) {
        for (const m of metrics) {
          const orig = pts[m.idx];
          const projLat = A[0] + m.alongFrac * (F[0] - A[0]);
          const projLng = A[1] + m.alongFrac * (F[1] - A[1]);
          smoothed[m.idx] = [
            orig[0] * 0.25 + projLat * 0.75,
            orig[1] * 0.25 + projLng * 0.75,
          ];
        }
        stats.snakes++;
        i += 3;
      }
    }
    pts = smoothed;
  }

  return { pts, stats };
}

/**
 * Convierte [lat, lng][] -> GeoJSON [lng, lat][] eliminando duplicados consecutivos < minDistM,
 * preservando siempre inicio y fin para evitar errores 2dsphere.
 */
function toCleanGeoJsonCoords(latLngPts, minDistM = 1.5) {
  const raw = [];
  for (let i = 0; i < latLngPts.length; i++) {
    const lat = Math.round(Number(latLngPts[i][0]) * 1e6) / 1e6;
    const lng = Math.round(Number(latLngPts[i][1]) * 1e6) / 1e6;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (raw.length === 0) {
      raw.push([lng, lat]);
      continue;
    }
    const prev = raw[raw.length - 1];
    const dist = haversineM(prev[1], prev[0], lat, lng);
    const isLast = i === latLngPts.length - 1;
    if (dist >= minDistM || (isLast && (prev[0] !== lng || prev[1] !== lat))) {
      raw.push([lng, lat]);
    }
  }
  if (raw.length < 2 && latLngPts.length >= 2) {
    const first = latLngPts[0];
    const last = latLngPts[latLngPts.length - 1];
    return [
      [Math.round(first[1] * 1e6) / 1e6, Math.round(first[0] * 1e6) / 1e6],
      [Math.round(last[1] * 1e6) / 1e6, Math.round(last[0] * 1e6) / 1e6],
    ];
  }
  return raw;
}

function buildSegmentUpdate(existingSeg, coordsLngLat, fallbackStart, fallbackEnd) {
  return {
    puntoPartida: {
      nombre: existingSeg?.puntoPartida?.nombre || fallbackStart || 'Inicio',
      coordenadas: { type: 'Point', coordinates: coordsLngLat[0] },
    },
    puntoFinal: {
      nombre: existingSeg?.puntoFinal?.nombre || fallbackEnd || 'Destino',
      coordenadas: { type: 'Point', coordinates: coordsLngLat[coordsLngLat.length - 1] },
    },
    trazado: {
      type: 'LineString',
      coordinates: coordsLngLat,
    },
  };
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI no está configurado en .env');
    process.exit(1);
  }
  if (!fs.existsSync(SOURCE_JSON)) {
    console.error(`❌ No existe el archivo fuente: ${SOURCE_JSON}`);
    process.exit(1);
  }

  const actualRoutes = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
  const actualById = new Map(actualRoutes.map((r) => [String(r.id), r]));

  console.log('🔄 Conectando a MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 12000,
    socketTimeoutMS: 60000,
  });
  console.log('✅ Conectado a MongoDB Atlas');

  try {
    const dbRoutes = await Route.find({ activa: true }).lean();

    let masivoIntactCount = 0;
    let communityIntactCount = 0;
    let urbanIntactCount = 0;
    let totalSpikesRemoved = 0;
    let totalKnotsCollapsed = 0;
    let totalSnakesSmoothed = 0;

    const plannedUpdates = [];

    for (const db of dbRoutes) {
      if (db.type === 'community') {
        communityIntactCount++;
        continue;
      }
      if (db.sistema === 'masivo') {
        masivoIntactCount++;
        continue;
      }
      const extId = db.externalId ? String(db.externalId) : '';
      const src = extId ? actualById.get(extId) : null;
      if (!src || !src.recorrido) {
        urbanIntactCount++;
        continue;
      }

      const rawIda = Array.isArray(src.recorrido.ida) ? src.recorrido.ida : [];
      const rawReg = Array.isArray(src.recorrido.regreso) ? src.recorrido.regreso : [];

      const cIda = cleanUrbanPolyline(rawIda);
      const cReg = cleanUrbanPolyline(rawReg);

      const fixSpikes = cIda.stats.spikes + cReg.stats.spikes;
      const fixKnots = cIda.stats.knots + cReg.stats.knots;
      const fixSnakes = cIda.stats.snakes + cReg.stats.snakes;
      const totalFixes = fixSpikes + fixKnots + fixSnakes;
      const needsSplitSync = SPLIT_SYNC_IDS.has(extId);

      if (totalFixes === 0 && !needsSplitSync) {
        urbanIntactCount++;
        continue;
      }

      const idaCoords = toCleanGeoJsonCoords(cIda.pts, 1.5);
      const regCoords = rawReg.length >= 2 ? toCleanGeoJsonCoords(cReg.pts, 1.5) : [];

      if (idaCoords.length < 2) {
        urbanIntactCount++;
        continue;
      }

      totalSpikesRemoved += fixSpikes;
      totalKnotsCollapsed += fixKnots;
      totalSnakesSmoothed += fixSnakes;

      plannedUpdates.push({
        db,
        extId,
        idaCoords,
        regCoords,
        fixSpikes,
        fixKnots,
        fixSnakes,
        needsSplitSync,
      });
    }

    // Respaldar únicamente las rutas que se van a modificar
    fs.writeFileSync(
      BACKUP_JSON,
      JSON.stringify(plannedUpdates.map((u) => u.db), null, 2),
      'utf8'
    );
    console.log(`💾 Respaldo guardado (${plannedUpdates.length} rutas) en ${BACKUP_JSON}`);

    const reportRows = [];
    let geoFallbackCount = 0;

    for (const item of plannedUpdates) {
      const { db, extId, idaCoords, regCoords, fixSpikes, fixKnots, fixSnakes, needsSplitSync } = item;
      const hasReg = regCoords.length >= 2;
      const obs = `Limpieza quirúrgica 2026: ${fixSpikes} espigas, ${fixKnots} nudos, ${fixSnakes} zigzags${
        needsSplitSync ? ', sincronía ida/regreso' : ''
      }`;

      const setPayload = {
        tieneRegreso: hasReg,
        ida: buildSegmentUpdate(db.ida, idaCoords, db.origen || 'Inicio', db.destino || 'Destino'),
        'audit.revisadoManualmente': true,
        'audit.observaciones': obs,
      };
      if (hasReg) {
        setPayload.regreso = buildSegmentUpdate(db.regreso, regCoords, db.destino || 'Destino', db.origen || 'Inicio');
      }

      const updateOp = { $set: setPayload };
      if (!hasReg && db.regreso) {
        updateOp.$unset = { regreso: '' };
      }

      try {
        await Route.updateOne({ _id: db._id }, updateOp);
      } catch (err) {
        if (err.code === 16755 || /16755|2dsphere|Can't extract geo keys/i.test(err.message)) {
          geoFallbackCount++;
          const safeIda = toCleanGeoJsonCoords(
            idaCoords.map((c) => [c[1], c[0]]),
            8
          );
          const safeReg = hasReg
            ? toCleanGeoJsonCoords(
                regCoords.map((c) => [c[1], c[0]]),
                8
              )
            : [];
          const fbPayload = {
            ...setPayload,
            tieneRegreso: safeReg.length >= 2,
            ida: buildSegmentUpdate(db.ida, safeIda, db.origen || 'Inicio', db.destino || 'Destino'),
          };
          if (safeReg.length >= 2) {
            fbPayload.regreso = buildSegmentUpdate(db.regreso, safeReg, db.destino || 'Destino', db.origen || 'Inicio');
          }
          await Route.updateOne(
            { _id: db._id },
            { $set: fbPayload, ...(safeReg.length < 2 && db.regreso ? { $unset: { regreso: '' } } : {}) }
          );
        } else {
          throw err;
        }
      }

      reportRows.push({
        codigo: db.codigo || '',
        nombre: db.nombre.slice(0, 28),
        operador: db.operador.slice(0, 18),
        extId,
        spikes: fixSpikes,
        knots: fixKnots,
        snakes: fixSnakes,
      });
    }

    await Route.syncIndexes();

    console.log('\n=== REPORTE DE REPARACIÓN QUIRÚRGICA ===');
    console.log({
      rutasActivasEvaluadas: dbRoutes.length,
      masivoTransmetroIntactas: masivoIntactCount,
      comunitariasIntactas: communityIntactCount,
      urbanasLimpiasSinTocar: urbanIntactCount,
      rutasReparadas: plannedUpdates.length,
      totalEspigasEliminadas: totalSpikesRemoved,
      totalNudosColapsados: totalKnotsCollapsed,
      totalZigzagsSuavizados: totalSnakesSmoothed,
      fallbacks2dsphere: geoFallbackCount,
    });

    if (reportRows.length > 0) {
      reportRows.sort((a, b) => (b.spikes * 3 + b.knots * 4 + b.snakes * 2) - (a.spikes * 3 + a.knots * 4 + a.snakes * 2));
      console.table(reportRows.slice(0, 20));
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

run().catch((err) => {
  console.error('❌ Error en reparación quirúrgica:', err);
  process.exit(1);
});
