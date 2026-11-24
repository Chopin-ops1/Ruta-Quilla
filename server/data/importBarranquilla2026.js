/**
 * ============================================
 * RutaQuilla - Migración Dataset Barranquilla 2026
 * ============================================
 *
 * - Respalda todas las rutas existentes en `backup_routes_pre_2026.json`
 * - Importa las 209 rutas activas (urbanas, Transmetro e intermunicipales)
 *   desde `rutas_barranquilla.json`
 * - Convierte coordenadas [lat, lng] -> GeoJSON [lng, lat]
 * - Separa circulares (ida / regreso) de lineales (ida única, sin regreso)
 * - Conserva rutas comunitarias existentes (`type === 'community'`)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Route = require('../models/RouteModel');

const SOURCE_JSON =
  process.argv[2] ||
  path.join('C:', 'Users', 'USER', 'Downloads', 'Nueva carpeta (3)', 'rutas-barranquilla', 'rutas_barranquilla.json');

const BACKUP_JSON = path.join(__dirname, 'backup_routes_pre_2026.json');

const OPERATOR_COLORS = {
  Transmetro: '#0EA5E9',
  Coolitoral: '#06B6D4',
  Sobusa: '#F59E0B',
  'Alianza Sodis': '#A855F7',
  Coochofal: '#14B8A6',
  Cootrantico: '#EC4899',
  'Expreso Colombia ( Excolcar )': '#6366F1',
  Cootragal: '#10B981',
  Cootransoriente: '#F97316',
  'Expreso del Atlantico': '#EAB308',
  Cootransa: '#22C55E',
  Cootransguajaro: '#0D9488',
  'La Carolina': '#818CF8',
  'Transportes Lolaya': '#EF4444',
  Cootrasol: '#22D3EE',
  Transmecar: '#34D399',
  'Transportes Monterrey': '#FB923C',
  Trasalianco: '#F43F5E',
  Cooasoatlan: '#EA580C',
  Transurbar: '#FB7185',
  Cootrab: '#8B5CF6',
  Cootracolsur: '#D946EF',
  Cootransco: '#C084FC',
  Cootransnorte: '#7C3AED',
  'Flota Angulo': '#FBBF24',
  Sotranspa: '#4ADE80',
  'Transportes Costa Azul': '#38BDF8',
  Trasalfa: '#2DD4BF',
  Cootransporcar: '#A78BFA',
  Embusa: '#F472B6',
  'Flota Roja': '#DC2626',
  Transoledad: '#3B82F6',
  'Tren Bocas de Ceniza': '#B45309',
};

const FALLBACK_PALETTE = [
  '#06B6D4', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#3B82F6', '#F97316', '#14B8A6',
];

const INTERMUNICIPAL_OPERATORS = new Set([
  'Cootragal',
  'Cootransa',
  'Cootransguajaro',
  'Cootransoriente',
  'Expreso Colombia ( Excolcar )',
  'Expreso del Atlantico',
  'Transportes Costa Azul',
  'Sotranspa',
]);

const INTERMUNICIPAL_REGEX =
  /sabanalarga|usiacur|calamar|tubar|campeche|polonuevo|p\/nuevo|baranoa|repel|manat|arroyo hondo|suan|santa luc|pioj|juan de acosta|luruaco|palmar de varela|santo tom|sabanagrande|ponedera|candelaria|campo de la cruz/i;

function getOperatorColor(empresa) {
  if (empresa && OPERATOR_COLORS[empresa]) return OPERATOR_COLORS[empresa];
  const str = String(empresa || 'Otra');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

function dedupeLngLat(points) {
  const out = [];
  for (const pt of points) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const coord = [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== coord[0] || prev[1] !== coord[1]) {
      out.push(coord);
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

function mapRouteDocument(r) {
  const rawName = String(r.nombre || '').trim();
  const rawDesc = r.descripcion ? String(r.descripcion).trim() : '';
  const isShortCode = /^[A-Z0-9-]{1,8}$/i.test(rawName);

  const codigo = isShortCode ? rawName : '';
  const nombre = (isShortCode
    ? rawDesc || rawName
    : rawName
  ).slice(0, 100);

  const empresa = String(r.empresa || 'Otra').trim().slice(0, 100);
  const sistema = r.sistema === 'masivo' ? 'masivo' : 'urbano';
  const tipoRecorrido = r.recorrido?.tipo === 'circular' ? 'circular' : 'lineal';
  const distanciaKm = Number(r.recorrido?.distancia_km) || 0;

  const esIntermunicipal =
    INTERMUNICIPAL_OPERATORS.has(empresa) ||
    (tipoRecorrido === 'lineal' && sistema !== 'masivo' && distanciaKm > 25) ||
    INTERMUNICIPAL_REGEX.test(`${rawName} ${rawDesc}`);

  const puntos = r.recorrido.puntos;
  const isCircularSplit =
    tipoRecorrido === 'circular' &&
    Number.isInteger(r.recorrido?.indice_retorno) &&
    r.recorrido.indice_retorno >= 1 &&
    r.recorrido.indice_retorno < puntos.length - 1;

  let idaCoords = dedupeLngLat(
    isCircularSplit ? puntos.slice(0, r.recorrido.indice_retorno + 1) : puntos
  );
  if (idaCoords.length < 2) {
    idaCoords = dedupeLngLat(puntos);
  }

  let regresoCoords = [];
  if (isCircularSplit) {
    regresoCoords = dedupeLngLat(puntos.slice(r.recorrido.indice_retorno));
  }

  const hasRegreso = regresoCoords.length >= 2;

  const barriosCubiertos = r.zonas
    ? String(r.zonas)
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const paradas = Array.isArray(r.paradas)
    ? r.paradas
        .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
        .map((p, idx) => ({
          orden: Number(p.orden) || idx + 1,
          indice: Number.isInteger(p.indice) ? p.indice : 0,
          sentido: p.sentido === 'regreso' ? 'regreso' : 'ida',
          nombre: String(p.nombre || `Parada ${idx + 1}`).trim(),
          lat: Number(p.lat),
          lng: Number(p.lng),
        }))
    : [];

  const descParts = rawDesc.split(/\s+[-–→]\s+/);
  const origenLabel = descParts[0]?.trim() || 'Inicio';
  const destinoLabel =
    descParts.length > 1 ? descParts[descParts.length - 1].trim() : rawDesc || 'Destino';

  const doc = {
    externalId: String(r.id),
    nombre,
    codigo,
    descripcion: rawDesc,
    operador: empresa,
    sistema,
    tipoVehiculo: r.tipo_vehiculo === 'tren' ? 'tren' : 'bus',
    tipoRecorrido,
    esIntermunicipal,
    distanciaKm,
    tieneRegreso: hasRegreso,
    origen: origenLabel,
    destino: destinoLabel,
    barriosCubiertos,
    horarios: r.horarios || null,
    metodosPago:
      Array.isArray(r.metodos_pago) && r.metodos_pago.length > 0
        ? r.metodos_pago
        : ['Efectivo'],
    paradas,
    tieneParadas: paradas.length > 0,
    actualizadoFuente: r.actualizado ? new Date(r.actualizado) : null,
    color: getOperatorColor(empresa),
    geometriaOSM: true,
    ida: buildSegment(idaCoords, origenLabel, destinoLabel),
    activa: true,
    trazadoIncompleto: false,
    audit: {
      revisadoManualmente: true,
      observaciones: 'Importado dataset Barranquilla 2026',
    },
    fuente: 'dataset_2026',
    type: 'official',
    fare: 3700,
  };

  if (hasRegreso) {
    doc.regreso = buildSegment(regresoCoords, destinoLabel, origenLabel);
  }

  return doc;
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

  console.log('🔄 Conectando a MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 12000,
    socketTimeoutMS: 60000,
  });
  console.log('✅ Conectado a MongoDB Atlas');

  try {
    // 1. Respaldo de rutas actuales
    const existing = await Route.find({}).lean();
    fs.writeFileSync(BACKUP_JSON, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`💾 Respaldo guardado (${existing.length} rutas) en ${BACKUP_JSON}`);

    // 2. Cargar y transformar dataset 2026 (solo rutas activas con trazado >= 2 pts)
    const rawRoutes = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
    const activeRoutes = rawRoutes.filter(
      (r) =>
        r.activa === true &&
        Array.isArray(r.recorrido?.puntos) &&
        r.recorrido.puntos.length >= 2
    );

    const docs = activeRoutes.map(mapRouteDocument);
    console.log(`📦 Transformadas ${docs.length} rutas activas desde ${SOURCE_JSON}`);

    // 3. Reemplazar rutas oficiales anteriores preservando rutas comunitarias
    const delRes = await Route.deleteMany({ type: { $ne: 'community' } });
    console.log(`🗑️  Eliminadas ${delRes.deletedCount} rutas oficiales anteriores`);

    // 4. Insertar nuevas rutas en lote
    const inserted = await Route.insertMany(docs, { ordered: true });
    console.log(`✅ Insertadas ${inserted.length} rutas nuevas en Atlas`);

    // 5. Sincronizar índices 2dsphere
    await Route.syncIndexes();
    console.log('✅ Índices MongoDB (incluidos 2dsphere) sincronizados correctamente');

    const masivoCount = docs.filter((d) => d.sistema === 'masivo').length;
    const urbanoCount = docs.filter((d) => d.sistema === 'urbano').length;
    const interCount = docs.filter((d) => d.esIntermunicipal).length;
    const regCount = docs.filter((d) => d.tieneRegreso).length;
    const totalStops = docs.reduce((s, d) => s + d.paradas.length, 0);

    console.log('\n=== RESUMEN IMPORTACIÓN ===');
    console.log({
      totalInsertadas: inserted.length,
      masivoTransmetro: masivoCount,
      urbanoColectivo: urbanoCount,
      intermunicipales: interCount,
      conIdaYRegreso: regCount,
      soloIdaLineal: inserted.length - regCount,
      paradasTotales: totalStops,
    });
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

run().catch((err) => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
