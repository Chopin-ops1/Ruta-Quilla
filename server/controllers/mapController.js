/**
 * ============================================
 * RutaQuilla - Controlador de Mapas
 * ============================================
 * 
 * Maneja funcionalidades relacionadas con mapas:
 * - Descarga offline (solo premium/Quilla-Pass)
 * - Datos de comercios patrocinados (publicidad)
 */

const Route = require('../models/RouteModel');

/**
 * GET /api/maps/download
 * 
 * Endpoint de descarga de mapa offline.
 * RESTRINGIDO: Solo usuarios premium (Quilla-Pass).
 * 
 * El middleware requirePremium ya verificó el acceso
 * antes de llegar a este controlador.
 * 
 * En un entorno de producción, esto generaría un archivo
 * con los tiles del mapa y las rutas en formato GeoJSON
 * para uso sin conexión.
 */
async function downloadOfflineMap(req, res) {
  try {
    // Obtener todas las rutas oficiales para el paquete offline
    const routes = await Route.find({ type: 'official' })
      .select('name company geometry stops color')
      .lean();

    // Construir paquete GeoJSON para uso offline
    const offlinePackage = {
      type: 'FeatureCollection',
      metadata: {
        generatedAt: new Date().toISOString(),
        city: 'Barranquilla',
        version: '1.0.0',
        routeCount: routes.length,
      },
      features: routes.map(route => ({
        type: 'Feature',
        properties: {
          name: route.name,
          company: route.company,
          color: route.color,
          stops: route.stops,
        },
        geometry: route.geometry,
      })),
    };

    // Enviar como archivo descargable JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="rutaquilla-offline.geojson"');
    res.json(offlinePackage);
  } catch (error) {
    console.error('Error al generar mapa offline:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar el paquete de mapa offline',
    });
  }
}

/**
 * GET /api/maps/sponsored
 * 
 * Retorna los comercios patrocinados para mostrar
 * como marcadores publicitarios en el mapa.
 * 
 * Solo se muestran a usuarios con rol 'free'.
 * Los usuarios premium no ven publicidad.
 * 
 * En producción, estos datos vendrían de una colección
 * de anunciantes en MongoDB. Aquí usamos datos estáticos
 * para demostración.
 */
async function getSponsoredLocations(req, res) {
  try {
    // Datos de comercios patrocinados en Barranquilla (demo)
    const sponsoredLocations = [
      {
        id: 'sponsor-1',
        name: 'Restaurante La Casa del Marisco',
        category: 'Restaurante',
        description: '¡Los mejores mariscos del Caribe! Descuento 15% con RutaQuilla',
        coordinates: [-74.7960, 10.9920],
        icon: 'utensils',
        promo: '15% OFF',
        color: '#F59E0B',
      },
      {
        id: 'sponsor-2',
        name: 'Farmacia Barranquilla Centro',
        category: 'Farmacia',
        description: 'Tu farmacia de confianza. Abierta 24 horas.',
        coordinates: [-74.7880, 10.9790],
        icon: 'pill',
        promo: 'Envío gratis',
        color: '#10B981',
      },
      {
        id: 'sponsor-3',
        name: 'Centro Comercial Buenavista',
        category: 'Shopping',
        description: 'Moda, tecnología y diversión. ¡Visitanos!',
        coordinates: [-74.8100, 11.0050],
        icon: 'shopping-bag',
        promo: 'Hasta 50% OFF',
        color: '#8B5CF6',
      },
      {
        id: 'sponsor-4',
        name: 'Taller Mecánico Don José',
        category: 'Automotriz',
        description: 'Revisión técnica y mantenimiento. Precio justo.',
        coordinates: [-74.8150, 10.9770],
        icon: 'wrench',
        promo: 'Diagnóstico gratis',
        color: '#EF4444',
      },
      {
        id: 'sponsor-5',
        name: 'Panadería El Trigal',
        category: 'Panadería',
        description: 'Pan artesanal y butifarras. Tradición barranquillera.',
        coordinates: [-74.8050, 10.9850],
        icon: 'cake',
        promo: '2x1 en pan',
        color: '#F97316',
      },
    ];

    res.json({
      success: true,
      count: sponsoredLocations.length,
      data: sponsoredLocations,
    });
  } catch (error) {
    console.error('Error al obtener sponsors:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ubicaciones patrocinadas',
    });
  }
}

module.exports = {
  downloadOfflineMap,
  getSponsoredLocations,
};
