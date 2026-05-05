/**
 * ============================================
 * RutaQuilla - Configuración de Base de Datos
 * ============================================
 * 
 * Estrategia de conexión:
 * 1. Si MONGO_URI existe en .env → conectar a MongoDB Atlas (persistente)
 * 2. Si no existe → usar mongodb-memory-server (datos en RAM, se pierden al reiniciar)
 * 
 * En producción siempre debe usarse MONGO_URI (Atlas).
 * En desarrollo se recomienda también usar MONGO_URI para
 * evitar pérdida de datos al reiniciar el servidor.
 */

const mongoose = require('mongoose');

let mongoServer = null;

/**
 * Inicializa la conexión a MongoDB.
 * Prioriza MONGO_URI (Atlas) sobre memoria.
 * 
 * @returns {Promise<void>}
 */
async function connectDatabase() {
  try {
    let mongoUri = process.env.MONGO_URI;

    if (mongoUri) {
      // ---- Conexión persistente (Atlas / cualquier MongoDB externo) ----
      console.log('🔄 Conectando a MongoDB Atlas...');

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        // Retry on initial connection failure
        retryWrites: true,
      });

      console.log('✅ Conectado a MongoDB Atlas (datos persistentes)');
    } else {
      // ---- Fallback: MongoDB en memoria (solo si no hay URI) ----
      console.log('⚠️  MONGO_URI no definido. Usando MongoDB en memoria (datos NO persisten)');
      console.log('   → Configura MONGO_URI en .env para persistencia');

      // Dynamic import to avoid loading the heavy binary when not needed
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create({
        instance: { dbName: 'rutaquilla' },
      });
      mongoUri = mongoServer.getUri();
      console.log(`📦 MongoDB Memory Server iniciado en: ${mongoUri}`);

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log('✅ Conectado a MongoDB en memoria');
    }

    // ---- Event listeners for connection stability ----
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de conexión MongoDB:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado. Mongoose intentará reconectar automáticamente.');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconectado exitosamente');
    });

  } catch (error) {
    console.error('❌ Error al iniciar MongoDB:', error);
    process.exit(1);
  }
}

/**
 * Cierra la conexión a MongoDB y detiene el servidor en memoria.
 * Se llama al apagar el servidor (SIGINT/SIGTERM).
 */
async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
      console.log('🔌 MongoDB desconectado y servidor en memoria detenido');
    } else {
      console.log('🔌 MongoDB desconectado exitosamente');
    }
  } catch (error) {
    console.error('❌ Error al desconectar MongoDB:', error);
  }
}

/**
 * Check if the database is currently connected and responsive.
 */
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1; // 1 = connected
}

module.exports = { connectDatabase, disconnectDatabase, isDatabaseConnected };
