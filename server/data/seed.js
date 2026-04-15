/**
 * ============================================
 * RutaQuilla - Script de Seed Manual
 * ============================================
 * 
 * Uso: node data/seed.js
 * 
 * Pobla la base de datos con datos de demostración
 * desde seed.json. Incluye rutas de transporte y
 * usuarios de prueba.
 * 
 * NOTA: Este script también se ejecuta automáticamente
 * al iniciar el servidor si la base de datos está vacía.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { connectDatabase, disconnectDatabase } = require('../config/database');
const Route = require('../models/RouteModel');
const User = require('../models/UserModel');
const seedData = require('./seed.json');

async function seed() {
  try {
    console.log('🌱 Iniciando seed de datos...\n');

    // Conectar a MongoDB en memoria
    await connectDatabase();

    // Limpiar colecciones existentes
    await Route.deleteMany({});
    await User.deleteMany({});
    console.log('  🗑️  Colecciones limpiadas');

    // Cargar rutas prioritariamente desde routes_new.json
    const fs = require('fs');
    const path = require('path');
    let routeSeed = [];
    try {
      const newRoutesPath = path.join(__dirname, 'routes_new.json');
      if (fs.existsSync(newRoutesPath)) {
        routeSeed = JSON.parse(fs.readFileSync(newRoutesPath, 'utf8'));
        console.log(`  📂 Cargadas ${routeSeed.length} rutas desde routes_new.json (Overpass API)`);
      } else {
        routeSeed = seedData.routes || [];
        console.log(`  📂 Cargadas ${routeSeed.length} rutas desde seed.json (Fallback)`);
      }
    } catch (e) {
      console.log('⚠️ Error al cargar rutas:', e.message);
      routeSeed = seedData.routes || [];
    }

    // Insertar rutas
    if (routeSeed.length > 0) {
      await Route.insertMany(routeSeed);
      console.log(`  ✅ ${routeSeed.length} rutas insertadas en DB`);
    }

    // Insertar usuarios (uno por uno para que el pre-save hook hashee passwords)
    if (seedData.users) {
      for (const userData of seedData.users) {
        const user = new User(userData);
        await user.save();
      }
      console.log(`  ✅ ${seedData.users.length} usuarios creados:`);
      seedData.users.forEach(u => {
        console.log(`     - ${u.name} (${u.email}) [${u.role}]`);
      });
    }

    // Verificar índices geoespaciales
    const indexes = await Route.collection.indexes();
    console.log(`\n  📊 Índices MongoDB: ${indexes.length}`);
    indexes.forEach(idx => {
      console.log(`     - ${JSON.stringify(idx.key)}`);
    });

    console.log('\n🎉 Seed completado exitosamente!\n');

    // Desconectar
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

seed();
