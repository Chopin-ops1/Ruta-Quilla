/**
 * ============================================
 * RutaQuilla - Servidor Express Principal
 * ============================================
 * 
 * Configuración principal del servidor Express con:
 * - MongoDB en memoria (mongodb-memory-server)
 * - CORS para desarrollo local
 * - Compresión gzip para redes 3G/4G lentas
 * - Rate limiting para protección básica
 * - Auto-seed de datos en el primer inicio
 * - Servir archivos estáticos del frontend en producción
 * 
 * Optimizado para baja latencia en conexiones inestables:
 * - Compresión de respuestas HTTP
 * - Payloads JSON mínimos
 * - Pool de conexiones MongoDB configurado
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { connectDatabase, disconnectDatabase } = require('./config/database');

// Importar rutas
const routeRoutes = require('./routes/routeRoutes');
const userRoutes = require('./routes/userRoutes');
const mapRoutes = require('./routes/mapRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Middlewares Globales
// ============================================

/**
 * Helmet: Configura headers HTTP de seguridad.
 * Deshabilitamos contentSecurityPolicy en desarrollo
 * para permitir carga de tiles del mapa desde CDNs.
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite HMR in dev
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: [
        "'self'", 'data:', 'blob:',
        '*.openstreetmap.org',
        '*.cartocdn.com',
        '*.tile.openstreetmap.org',
        '*.googleapis.com',
        '*.gstatic.com',
        '*.google.com',
      ],
      connectSrc: [
        "'self'",
        'https://nominatim.openstreetmap.org',
        'https://router.project-osrm.org',
        'https://overpass-api.de',
        'https://basemaps.cartocdn.com',
        'https://maps.googleapis.com',
        'https://roads.googleapis.com',
        'https://places.googleapis.com',
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

/**
 * Compresión gzip: Reduce el tamaño de las respuestas HTTP.
 * Crítico para usuarios con conexiones 3G/4G en Barranquilla.
 * Un payload de 50KB se puede reducir a ~10KB con gzip.
 */
app.use(compression({
  level: 6, // Balance entre velocidad de compresión y ratio
  threshold: 1024, // Solo comprimir respuestas > 1KB
  filter: (req, res) => {
    // Comprimir JSON y texto, no imágenes/binarios
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

/**
 * CORS: Permitir requests del frontend de desarrollo.
 * En producción, restringir a dominios específicos.
 */
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://rutaquilla.me', 'https://www.rutaquilla.me']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Rate Limiting: Protección contra abuso de la API.
 * Limita a 100 requests por IP cada 15 minutos.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 300,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.',
    code: 'RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Demasiados intentos. Espera 15 minutos.', code: 'AUTH_RATE_LIMIT' },
  standardHeaders: true, legacyHeaders: false,
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/', limiter);

// Parsear JSON con límite de tamaño
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// Logging de requests en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ============================================
// Rutas de la API
// ============================================

app.use('/api/routes', routeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/maps', mapRoutes);

// Endpoint de salud del servidor
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'RutaQuilla API funcionando correctamente 🚌',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// Servir Frontend en Producción
// ============================================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// ============================================
// Manejo de Errores Global
// ============================================

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================
// Inicialización del Servidor
// ============================================

/**
 * Función de seed automático: Poblado de datos de demostración
 * 
 * Se ejecuta al iniciar el servidor si la base de datos
 * está vacía (mongodb-memory-server pierde datos al reiniciar).
 */
async function seedDatabase() {
  const Route = require('./models/RouteModel');
  const User = require('./models/UserModel');

  const routeCount = await Route.countDocuments();
  
  if (routeCount === 0) {
    console.log('📦 Base de datos vacía. Ejecutando seed automático...');
    
    try {
      // Cargar rutas
      const fs = require('fs');
      const path = require('path');
      const seedData = require('./data/seed.json');
      let routesList = [];
      try {
        const v5Path = path.join(__dirname, 'data', 'routes_v5.json');
        const newRoutesPath = path.join(__dirname, 'data', 'routes_new.json');
        if (fs.existsSync(v5Path)) {
          routesList = JSON.parse(fs.readFileSync(v5Path, 'utf8'));
          console.log(`  📂 Cargadas ${routesList.length} rutas desde routes_v5.json (v5 geocodificadas)`);
        } else if (fs.existsSync(newRoutesPath)) {
          routesList = JSON.parse(fs.readFileSync(newRoutesPath, 'utf8'));
          console.log(`  📂 Cargadas ${routesList.length} rutas desde routes_new.json`);
        } else {
          routesList = seedData.routes || [];
          console.log(`  📂 Cargadas ${routesList.length} rutas desde seed.json`);
        }
      } catch (e) {
        console.log('⚠️ Error al cargar rutas:', e.message);
        routesList = seedData.routes || [];
      }
      
      // Insertar rutas
      if (routesList.length > 0) {
        await Route.insertMany(routesList);
        console.log(`  ✅ ${routesList.length} rutas insertadas en DB`);
      }

      // Crear usuarios de demo
      if (seedData.users && seedData.users.length > 0) {
        for (const userData of seedData.users) {
          const user = new User(userData);
          await user.save(); // Usa el pre-save hook para hashear passwords
        }
        console.log(`  ✅ ${seedData.users.length} usuarios de demo creados`);
      }

      console.log('🌱 Seed completado exitosamente');
    } catch (error) {
      console.error('❌ Error en seed:', error.message);
    }
  } else {
    console.log(`📊 Base de datos ya tiene ${routeCount} rutas`);
  }
}

/**
 * Arrancar servidor:
 * 1. Conectar MongoDB en memoria
 * 2. Poblar datos de demo
 * 3. Iniciar Express en el puerto configurado
 */
async function startServer() {
  try {
    // Paso 1: Conectar base de datos
    await connectDatabase();

    // Paso 2: Poblar datos de demostración
    await seedDatabase();

    // Paso 3: Iniciar servidor HTTP vinculando explícitamente a 0.0.0.0 para plataformas Cloud
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('============================================');
      console.log('  🚌 RutaQuilla API Server');
      console.log('============================================');
      console.log(`  📡 Puerto:     ${PORT}`);
      console.log(`  🌍 Entorno:    ${process.env.NODE_ENV || 'development'}`);
      console.log(`  📚 API Base:   http://localhost:${PORT}/api`);
      console.log(`  💊 Health:     http://localhost:${PORT}/api/health`);
      console.log('============================================');
      console.log('');
    });

    // Manejo de señales de cierre graceful
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} recibido. Cerrando servidor...`);
      server.close(async () => {
        await disconnectDatabase();
        console.log('👋 Servidor cerrado correctamente');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
