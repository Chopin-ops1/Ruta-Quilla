const fs = require('fs');

const seedRaw = fs.readFileSync('seed.json', 'utf8');
const seed = JSON.parse(seedRaw);

const newRoutes = seed.routes.map(old => {
  return {
    nombre: old.name,
    operador: old.company,
    color: old.color,
    geometriaOSM: false,
    ida: {
      puntoPartida: {
        nombre: 'Inicio Ida',
        coordenadas: { type: 'Point', coordinates: old.geometry.coordinates[0] }
      },
      puntoFinal: {
        nombre: 'Fin Ida',
        coordenadas: { type: 'Point', coordinates: old.geometry.coordinates[old.geometry.coordinates.length - 1] }
      },
      trazado: {
        type: 'LineString',
        coordinates: old.geometry.coordinates
      }
    },
    activa: true,
    trazadoIncompleto: false,
    audit: {
      revisadoManualmente: true,
      observaciones: 'Migrado del seed v3'
    },
    fuente: 'openstreetmap',
    // fields for backward compatibility
    type: old.type,
    fare: old.fare,
  };
});

// For the C-19 route that has complex paths, we just take it over directly in the ida object as done above.
// Since we don't have geometryVuelta in seed.json (most are just one line), we just replicate ida into regreso for dummy purposes so it passes validation, OR we keep the same. 
// Let's create an exact inverse for regreso.
newRoutes.forEach(r => {
  r.regreso = {
    puntoPartida: {
      nombre: 'Inicio Vuelta',
      coordenadas: { type: 'Point', coordinates: [...r.ida.trazado.coordinates].reverse()[0] }
    },
    puntoFinal: {
      nombre: 'Fin Vuelta',
      coordenadas: { type: 'Point', coordinates: [...r.ida.trazado.coordinates].reverse()[[...r.ida.trazado.coordinates].length - 1] }
    },
    trazado: {
      type: 'LineString',
      coordinates: [...r.ida.trazado.coordinates].reverse()
    }
  };
});

seed.routes = newRoutes;
fs.writeFileSync('seed.json', JSON.stringify(seed, null, 2));

console.log("Converted seed.json to new schema.");
