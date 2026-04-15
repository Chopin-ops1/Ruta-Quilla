/**
 * ============================================
 * RutaQuilla - Configuración de Base de Datos
 * ============================================
 * 
 * Utiliza mongodb-memory-server para ejecutar una instancia
 * de MongoDB en memoria. Esto elimina la necesidad de tener
 * MongoDB instalado localmente o configurar Atlas.
 * 
 * Nota: Los datos se pierden al reiniciar el servidor.
 * El seed se ejecuta automáticamente al iniciar.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer = null;

/**
 * Inicializa MongoDB en memoria y conecta Mongoose.
 * 
 * mongodb-memory-server descarga automáticamente un binario
 * de MongoDB la primera vez que se ejecuta (~300MB).
 * Las ejecuciones posteriores usan el binario cacheado.
 * 
 * @returns {Promise<void>}
 */
async function connectDatabase() {
  try {
    let mongoUri = process.env.MONGO_URI;

    if (mongoUri) {
      console.log('🔄 Iniciando conexión a MongoDB (Producción/Atlas)...');
    } else {
      console.log('🔄 Iniciando MongoDB en memoria (Desarrollo)...');
      mongoServer = await MongoMemoryServer.create({
        instance: { dbName: 'rutaquilla' },
      });
      mongoUri = mongoServer.getUri();
      console.log(`📦 MongoDB Memory Server iniciado en: ${mongoUri}`);
    }

    // Connect Mongoose
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(mongoServer ? '✅ Conectado a MongoDB en memoria' : '✅ Conectado a MongoDB remoto exitosamente');

    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de conexión MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB desconectado');
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

module.exports = { connectDatabase, disconnectDatabase };
