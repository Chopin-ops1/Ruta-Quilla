/**
 * Curated catalog of key places, landmarks, malls, universities,
 * hospitals, and neighborhoods across Barranquilla & Área Metropolitana.
 * Provides instant (0 ms) accent-insensitive local autocomplete.
 */

export const BARRANQUILLA_PLACES = [
  // ---- Centros Comerciales ----
  { name: 'C.C. Buenavista', aliases: ['buenavista', 'buenavista 1', 'buenavista 2', 'cc buenavista'], subtitle: 'Calle 98 #52-115, Alto Prado', lat: 11.0137, lng: -74.8276, category: 'mall' },
  { name: 'C.C. Viva Barranquilla', aliases: ['viva', 'viva barranquilla', 'cc viva', 'exito viva'], subtitle: 'Cra 51B #87-50, Riomar', lat: 11.0044, lng: -74.8256, category: 'mall' },
  { name: 'Mallplaza Buenavista', aliases: ['mallplaza', 'mall plaza', 'mallplaza buenavista'], subtitle: 'Calle 99 #53-55, Riomar', lat: 11.0121, lng: -74.8287, category: 'mall' },
  { name: 'C.C. Portal del Prado', aliases: ['portal del prado', 'portal', 'cc portal del prado'], subtitle: 'Calle 53 #46-192, El Prado', lat: 10.9926, lng: -74.7945, category: 'mall' },
  { name: 'C.C. Único', aliases: ['unico', 'cc unico', 'centro comercial unico'], subtitle: 'Calle 74 #38D-113, Las Delicias', lat: 10.9960, lng: -74.8037, category: 'mall' },
  { name: 'C.C. Villa Country', aliases: ['villa country', 'cc villa country'], subtitle: 'Calle 78 #53-70, Villa Country', lat: 11.0020, lng: -74.8098, category: 'mall' },
  { name: 'C.C. Country Plaza', aliases: ['country plaza', 'cc country plaza'], subtitle: 'Calle 77 #51-53, Alto Prado', lat: 11.0007, lng: -74.8065, category: 'mall' },
  { name: 'C.C. Americano', aliases: ['americano', 'cc americano'], subtitle: 'Cra 38 #74-109, Betania', lat: 10.9977, lng: -74.8037, category: 'mall' },
  { name: 'C.C. Carnaval', aliases: ['carnaval', 'cc carnaval', 'carnaval soledad'], subtitle: 'Calle 30 #22-50, Soledad', lat: 10.9168, lng: -74.7773, category: 'mall' },
  { name: 'C.C. Gran Plaza del Sol', aliases: ['gran plaza del sol', 'plaza del sol', 'soledad'], subtitle: 'Calle 30 #13-112, Soledad', lat: 10.9178, lng: -74.7697, category: 'mall' },
  { name: 'C.C. Plaza del Parque', aliases: ['plaza del parque', 'cc plaza del parque'], subtitle: 'Calle 99 #53-40, Riomar', lat: 11.0085, lng: -74.8229, category: 'mall' },
  { name: 'C.C. Miramar', aliases: ['miramar', 'cc miramar'], subtitle: 'Cra 43 #99-50, Miramar', lat: 11.0094, lng: -74.8350, category: 'mall' },
  { name: 'C.C. Nuestro Atlántico', aliases: ['nuestro atlantico', 'cc nuestro atlantico'], subtitle: 'Av. Murillo con Circunvalar, Soledad', lat: 10.9234, lng: -74.7950, category: 'mall' },
  { name: 'C.C. Parque Alegra', aliases: ['parque alegra', 'alegra', 'cc parque alegra'], subtitle: 'Calle 30 #4B-50, Suroriente', lat: 10.9416, lng: -74.7916, category: 'mall' },
  { name: 'C.C. Metrocentro', aliases: ['metrocentro', 'cc metrocentro'], subtitle: 'Calle 45 Murillo #1-85, Ciudadela', lat: 10.9317, lng: -74.8021, category: 'mall' },
  { name: 'C.C. Panorama', aliases: ['panorama', 'cc panorama'], subtitle: 'Calle 30 #8-115, Centro', lat: 10.9886, lng: -74.7897, category: 'mall' },

  // ---- Universidades y Educación ----
  { name: 'Universidad del Norte', aliases: ['uninorte', 'universidad del norte'], subtitle: 'Km 5 Vía Puerto Colombia', lat: 11.0191, lng: -74.8505, category: 'university' },
  { name: 'Universidad del Atlántico (Sede Norte)', aliases: ['uniatlantico', 'universidad del atlantico', 'ua norte'], subtitle: 'Km 7 Vía Puerto Colombia', lat: 11.0183, lng: -74.8712, category: 'university' },
  { name: 'Universidad del Atlántico (Sede Centro)', aliases: ['uniatlantico centro', 'bellas artes', 'cra 43 calle 50'], subtitle: 'Cra 43 #50-53, Centro', lat: 10.9855, lng: -74.7875, category: 'university' },
  { name: 'Universidad Libre', aliases: ['unilibre', 'universidad libre'], subtitle: 'Km 7 Vía Puerto Colombia', lat: 11.0160, lng: -74.8473, category: 'university' },
  { name: 'Universidad Simón Bolívar', aliases: ['unisimon', 'simon bolivar', 'universidad simon bolivar'], subtitle: 'Cra 59 #59-65, El Prado', lat: 10.9953, lng: -74.7927, category: 'university' },
  { name: 'Universidad Autónoma del Caribe', aliases: ['uniautonoma', 'autonoma', 'uac'], subtitle: 'Calle 90 #46-112, Riomar', lat: 11.0090, lng: -74.8194, category: 'university' },
  { name: 'Universidad de la Costa (CUC)', aliases: ['cuc', 'universidad de la costa'], subtitle: 'Calle 58 #55-66, El Prado', lat: 10.9950, lng: -74.7905, category: 'university' },
  { name: 'Universidad Metropolitana', aliases: ['unimetro', 'metropolitana', 'universidad metropolitana'], subtitle: 'Calle 76 #42-78, Ciudad Jardín', lat: 10.9987, lng: -74.8075, category: 'university' },
  { name: 'SENA Centro Colombo Alemán', aliases: ['sena', 'colombo aleman', 'sena calle 30'], subtitle: 'Calle 30 / Kra 46, Barranquilla', lat: 10.9922, lng: -74.7966, category: 'university' },
  { name: 'Institución Universitaria ITSA (Soledad)', aliases: ['itsa', 'unibarranquilla', 'instituto tecnologico'], subtitle: 'Calle 18 #39-100, Soledad', lat: 10.9228, lng: -74.7646, category: 'university' },

  // ---- Clínicas y Hospitales ----
  { name: 'Clínica Portoazul', aliases: ['portoazul', 'clinica portoazul'], subtitle: 'Km 7 Corredor Universitario', lat: 11.0227, lng: -74.8617, category: 'hospital' },
  { name: 'Clínica del Caribe', aliases: ['clinica del caribe', 'caribe'], subtitle: 'Calle 80 #49C-65, Alto Prado', lat: 11.0005, lng: -74.8045, category: 'hospital' },
  { name: 'Clínica Reina Catalina', aliases: ['reina catalina', 'clinica reina catalina'], subtitle: 'Calle 82 #47-12, Alto Prado', lat: 11.0040, lng: -74.8130, category: 'hospital' },
  { name: 'Clínica General del Norte', aliases: ['general del norte', 'clinica general del norte'], subtitle: 'Calle 70 #48-35, El Prado', lat: 11.0002, lng: -74.8027, category: 'hospital' },
  { name: 'Clínica La Asunción', aliases: ['la asuncion', 'clinica la asuncion'], subtitle: 'Calle 70B #41-93, Delicias', lat: 10.9988, lng: -74.8029, category: 'hospital' },
  { name: 'Clínica Iberoamérica', aliases: ['iberoamerica', 'clinica iberoamerica'], subtitle: 'Cra 50 #85-209, Alto Prado', lat: 11.0108, lng: -74.8240, category: 'hospital' },
  { name: 'Hospital Universidad del Norte', aliases: ['hospital uninorte', 'hospital universidad del norte'], subtitle: 'Calle 30 Vía Aeropuerto, Soledad', lat: 10.9277, lng: -74.7867, category: 'hospital' },
  { name: 'Camino Adelita de Char', aliases: ['adelita de char', 'camino adelita'], subtitle: 'Cra 21B #53-20, La Manga / El Carmen', lat: 10.9600, lng: -74.8140, category: 'hospital' },

  // ---- Lugares Emblemáticos, Transporte y Parques ----
  { name: 'Gran Malecón del Río', aliases: ['malecon', 'gran malecon', 'malecon del rio'], subtitle: 'Vía 40 con Puerta de Oro, Río Magdalena', lat: 11.0110, lng: -74.7875, category: 'landmark' },
  { name: 'Ventana al Mundo', aliases: ['ventana al mundo', 'aleta'], subtitle: 'Glorieta Vía 40 - Las Flores', lat: 11.0315, lng: -74.8327, category: 'landmark' },
  { name: 'Ventana de Campeones (Aleta del Tiburón)', aliases: ['ventana de campeones', 'aleta del tiburon', 'junior'], subtitle: 'Isla La Loma / Gran Malecón', lat: 11.0128, lng: -74.7878, category: 'landmark' },
  { name: 'Estadio Metropolitano Roberto Meléndez', aliases: ['estadio metropolitano', 'el metro', 'metropolitano'], subtitle: 'Calle 45 Murillo con Circunvalar', lat: 10.9269, lng: -74.8007, category: 'landmark' },
  { name: 'Estadio Romelio Martínez', aliases: ['romelio martinez', 'estadio romelio'], subtitle: 'Calle 72 con Cra 46', lat: 10.9938, lng: -74.8035, category: 'landmark' },
  { name: 'Estadio Édgar Rentería', aliases: ['edgar renteria', 'estadio beisbol', 'tomas arrieta'], subtitle: 'Vía 40 #50B-54, Barrio Abajo', lat: 10.9899, lng: -74.7897, category: 'landmark' },
  { name: 'Terminal de Transportes de Barranquilla', aliases: ['terminal', 'terminal de transportes', 'terminal soledad'], subtitle: 'Calle 30 / Prolongación Murillo, Soledad', lat: 10.9038, lng: -74.8031, category: 'transit' },
  { name: 'Aeropuerto Internacional Ernesto Cortissoz', aliases: ['aeropuerto', 'cortissoz', 'ernesto cortissoz'], subtitle: 'Autopista al Aeropuerto, Soledad', lat: 10.8896, lng: -74.7808, category: 'transit' },
  { name: 'Paseo Bolívar', aliases: ['paseo bolivar', 'calle 34', 'centro paseo bolivar'], subtitle: 'Calle 34 #41-44, Centro Histórico', lat: 10.9799, lng: -74.7810, category: 'landmark' },
  { name: 'Plaza de la Paz', aliases: ['plaza de la paz', 'catedral', 'catedral metropolitana'], subtitle: 'Calle 53 con Cra 45, El Rosario', lat: 10.9885, lng: -74.7900, category: 'landmark' },
  { name: 'Parque Venezuela', aliases: ['parque venezuela', 'venezuela'], subtitle: 'Calle 90 con Cra 42F, Villa Santos', lat: 11.0051, lng: -74.8213, category: 'park' },
  { name: 'Parque Electrificadora', aliases: ['parque electrificadora', 'la electrificadora'], subtitle: 'Calle 85 con Cra 64, Riomar', lat: 11.0063, lng: -74.8168, category: 'park' },
  { name: 'Parque Sagrado Corazón', aliases: ['sagrado corazon', 'parque sagrado corazon'], subtitle: 'Calle 80 con Cra 42F, Ciudad Jardín', lat: 11.0004, lng: -74.8152, category: 'park' },
  { name: 'Zoológico de Barranquilla', aliases: ['zoologico', 'zoo', 'zoologico barranquilla'], subtitle: 'Calle 77 #68-40, La Concepción', lat: 11.0102, lng: -74.7988, category: 'park' },
  { name: 'Puerta de Oro (Centro de Eventos)', aliases: ['puerta de oro', 'centro de eventos'], subtitle: 'Vía 40 #79B-06, Siape', lat: 11.0104, lng: -74.7916, category: 'landmark' },
  { name: 'Intendencia Fluvial', aliases: ['intendencia fluvial', 'intendencia', 'caño de la ahuyama'], subtitle: 'Calle 30 #46-10, Centro', lat: 10.9822, lng: -74.7736, category: 'landmark' },
  { name: 'Ecoparque Ciénaga de Mallorquín', aliases: ['ecoparque', 'cienaga de mallorquin', 'mallorquin'], subtitle: 'Vía Puerto Colombia / La Playa', lat: 11.0350, lng: -74.8445, category: 'park' },
  { name: 'Caimán del Río (Gran Malecón)', aliases: ['caiman del rio', 'malecon gastronomia'], subtitle: 'Gran Malecón del Río, Sector Gastronómico', lat: 11.0063, lng: -74.7785, category: 'landmark' },
  { name: 'Museo del Carnaval de Barranquilla', aliases: ['museo del carnaval', 'carnaval'], subtitle: 'Cra 54 #49B-39, Barrio Abajo', lat: 10.9928, lng: -74.7877, category: 'landmark' },
  { name: 'Parque Cultural del Caribe', aliases: ['parque cultural', 'parque cultural del caribe'], subtitle: 'Calle 36 #46-66, Centro', lat: 10.9863, lng: -74.7780, category: 'landmark' },
  { name: 'Jardín Botánico de Barranquilla', aliases: ['jardin botanico', 'parque jardin botanico'], subtitle: 'Calle 45 Murillo #31B, La Victoria', lat: 10.9510, lng: -74.7973, category: 'park' },
  { name: 'Clínica Bonnadona Prevenir', aliases: ['bonnadona', 'clinica bonnadona'], subtitle: 'Cra 49C #82-70, Alto Prado', lat: 11.0027, lng: -74.8168, category: 'hospital' },
  { name: 'Clínica La Misericordia', aliases: ['la misericordia', 'clinica misericordia'], subtitle: 'Calle 80 #47-34, Alto Prado', lat: 10.9994, lng: -74.8139, category: 'hospital' },

  // ---- Estaciones Principales de Transmetro ----
  { name: 'Estación Portal de Soledad (Transmetro)', aliases: ['portal de soledad', 'transmetro soledad'], subtitle: 'Troncal Murillo — Soledad', lat: 10.9073, lng: -74.8011, category: 'transit' },
  { name: 'Estación Joe Arroyo (Transmetro)', aliases: ['estacion joe arroyo', 'joe arroyo transmetro'], subtitle: 'Cra 46 con Calle 74 — Troncal Olaya Herrera', lat: 10.9947, lng: -74.8078, category: 'transit' },
  { name: 'Estación Alfredo Correa de Andréis', aliases: ['alfredo correa', 'estacion alfredo correa'], subtitle: 'Cra 46 entre Calles 60 y 62 — Transmetro', lat: 10.9894, lng: -74.7975, category: 'transit' },
  { name: 'Estación Catedral (Transmetro)', aliases: ['estacion catedral', 'catedral transmetro'], subtitle: 'Cra 46 entre Calles 50 y 53 — Transmetro', lat: 10.9877, lng: -74.7888, category: 'transit' },
  { name: 'Estación Parque Cultural (Transmetro)', aliases: ['estacion parque cultural', 'parque cultural transmetro'], subtitle: 'Cra 46 entre Calles 36 y 39 — Transmetro', lat: 10.9864, lng: -74.7780, category: 'transit' },
  { name: 'Estación La Arenosa (Transmetro)', aliases: ['estacion la arenosa', 'la arenosa'], subtitle: 'Av. Murillo entre Cras 41 y 43 — Transmetro', lat: 10.9819, lng: -74.7893, category: 'transit' },
  { name: 'Estación Chiquinquirá (Transmetro)', aliases: ['estacion chiquinquira', 'chiquinquira transmetro'], subtitle: 'Av. Murillo entre Cras 33 y 38 — Transmetro', lat: 10.9708, lng: -74.7772, category: 'transit' },
  { name: 'Estación La Ocho (Transmetro)', aliases: ['estacion la ocho', 'la ocho transmetro'], subtitle: 'Av. Murillo entre Cras 8 y 8C — Transmetro', lat: 10.9459, lng: -74.7942, category: 'transit' },
  { name: 'Estación Buenos Aires (Transmetro)', aliases: ['estacion buenos aires', 'buenos aires transmetro'], subtitle: 'Av. Murillo entre Cras 7 y 7G — Transmetro', lat: 10.9419, lng: -74.7995, category: 'transit' },
  { name: 'Estación Estadio Metropolitano (Transmetro)', aliases: ['estacion estadio metropolitano', 'joaquin barrios polo'], subtitle: 'Av. Murillo entre Cras 1G y 2A — Transmetro', lat: 10.9270, lng: -74.8005, category: 'transit' },

  // ---- Barrios y Zonas Principales ----
  { name: 'Barrio El Prado', aliases: ['prado', 'el prado'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.9963, lng: -74.7958, category: 'neighborhood' },
  { name: 'Barrio Alto Prado', aliases: ['alto prado'], subtitle: 'Localidad Riomar', lat: 11.0038, lng: -74.8087, category: 'neighborhood' },
  { name: 'Barrio Altos del Prado', aliases: ['altos del prado'], subtitle: 'Localidad Riomar', lat: 11.0091, lng: -74.8162, category: 'neighborhood' },
  { name: 'Barrio Riomar', aliases: ['riomar'], subtitle: 'Localidad Riomar', lat: 11.0132, lng: -74.8224, category: 'neighborhood' },
  { name: 'Barrio Villa Santos', aliases: ['villa santos'], subtitle: 'Localidad Riomar', lat: 11.0082, lng: -74.8266, category: 'neighborhood' },
  { name: 'Barrio Villa Carolina', aliases: ['villa carolina'], subtitle: 'Localidad Riomar', lat: 11.0155, lng: -74.8155, category: 'neighborhood' },
  { name: 'Barrio El Golf', aliases: ['el golf', 'golf'], subtitle: 'Localidad Riomar', lat: 11.0069, lng: -74.8091, category: 'neighborhood' },
  { name: 'Barrio Los Nogales', aliases: ['los nogales', 'nogales'], subtitle: 'Localidad Norte - Centro Histórico', lat: 11.0018, lng: -74.8211, category: 'neighborhood' },
  { name: 'Barrio Ciudad Jardín', aliases: ['ciudad jardin'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.9998, lng: -74.8092, category: 'neighborhood' },
  { name: 'Barrio Boston', aliases: ['boston'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.9912, lng: -74.7955, category: 'neighborhood' },
  { name: 'Barrio El Recreo', aliases: ['el recreo', 'recreo'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.9854, lng: -74.7966, category: 'neighborhood' },
  { name: 'Barrio Las Delicias', aliases: ['delicias', 'las delicias'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.9942, lng: -74.8056, category: 'neighborhood' },
  { name: 'Barrio Olaya', aliases: ['olaya'], subtitle: 'Localidad Suroccidente', lat: 10.9845, lng: -74.8112, category: 'neighborhood' },
  { name: 'Barrio San Felipe', aliases: ['san felipe'], subtitle: 'Localidad Suroccidente', lat: 10.9762, lng: -74.8093, category: 'neighborhood' },
  { name: 'Barrio Los Andes', aliases: ['los andes'], subtitle: 'Localidad Suroccidente', lat: 10.9746, lng: -74.8035, category: 'neighborhood' },
  { name: 'Barrio El Silencio', aliases: ['el silencio', 'silencio'], subtitle: 'Localidad Suroccidente', lat: 10.9788, lng: -74.8142, category: 'neighborhood' },
  { name: 'Barrio Las Palmas', aliases: ['las palmas'], subtitle: 'Localidad Suroriente', lat: 10.9502, lng: -74.7905, category: 'neighborhood' },
  { name: 'Barrio Simón Bolívar', aliases: ['barrio simon bolivar', 'simon bolivar'], subtitle: 'Localidad Suroriente', lat: 10.9410, lng: -74.7785, category: 'neighborhood' },
  { name: 'Barrio La Unión', aliases: ['la union'], subtitle: 'Localidad Suroriente', lat: 10.9532, lng: -74.7880, category: 'neighborhood' },
  { name: 'Barrio San José', aliases: ['san jose'], subtitle: 'Localidad Suroriente', lat: 10.9615, lng: -74.7945, category: 'neighborhood' },
  { name: 'Barrio Chiquinquirá', aliases: ['chiquinquira'], subtitle: 'Localidad Suroriente', lat: 10.9668, lng: -74.7885, category: 'neighborhood' },
  { name: 'Barrio Montes', aliases: ['montes'], subtitle: 'Localidad Suroriente', lat: 10.9708, lng: -74.7842, category: 'neighborhood' },
  { name: 'Barrio Rebolo', aliases: ['rebolo'], subtitle: 'Localidad Suroriente', lat: 10.9673, lng: -74.7775, category: 'neighborhood' },
  { name: 'Centro de Barranquilla', aliases: ['centro', 'el centro'], subtitle: 'Centro Histórico, Barranquilla', lat: 10.9788, lng: -74.7795, category: 'neighborhood' },
  { name: 'Barranquillita', aliases: ['barranquillita', 'mercado'], subtitle: 'Zona Comercial Centro', lat: 10.9765, lng: -74.7731, category: 'neighborhood' },
  { name: 'Barrio Las Nieves', aliases: ['las nieves'], subtitle: 'Localidad Suroriente', lat: 10.9585, lng: -74.7824, category: 'neighborhood' },
  { name: 'Ciudadela 20 de Julio', aliases: ['ciudadela', '20 de julio', 'ciudadela 20 de julio'], subtitle: 'Localidad Metropolitana', lat: 10.9310, lng: -74.8058, category: 'neighborhood' },
  { name: 'Barrio Las Flores', aliases: ['las flores'], subtitle: 'Localidad Riomar', lat: 11.0365, lng: -74.8286, category: 'neighborhood' },
  { name: 'Corregimiento La Playa', aliases: ['la playa', 'eduardo santos'], subtitle: 'Vía a Puerto Colombia', lat: 11.0285, lng: -74.8631, category: 'neighborhood' },
  { name: 'Alameda del Río', aliases: ['alameda del rio', 'alameda'], subtitle: 'Circunvalar con Cra 43', lat: 10.9990, lng: -74.8415, category: 'neighborhood' },
  { name: 'Caribe Verde', aliases: ['caribe verde'], subtitle: 'Localidad Suroccidente', lat: 10.9535, lng: -74.8410, category: 'neighborhood' },
  { name: 'Villas de San Pablo', aliases: ['villas de san pablo', 'san pablo'], subtitle: 'Localidad Suroccidente', lat: 10.9605, lng: -74.8485, category: 'neighborhood' },
  { name: 'Soledad 2000', aliases: ['soledad 2000'], subtitle: 'Soledad, Atlántico', lat: 10.9095, lng: -74.7945, category: 'neighborhood' },
  { name: 'Hipódromo (Soledad)', aliases: ['hipodromo'], subtitle: 'Soledad, Atlántico', lat: 10.9225, lng: -74.7695, category: 'neighborhood' },
  { name: 'Barrio El Carmen', aliases: ['el carmen'], subtitle: 'Localidad Suroccidente', lat: 10.9620, lng: -74.8055, category: 'neighborhood' },
  { name: 'Barrio Cevillar', aliases: ['cevillar'], subtitle: 'Localidad Suroccidente', lat: 10.9600, lng: -74.8005, category: 'neighborhood' },
  { name: 'Barrio La Victoria', aliases: ['la victoria'], subtitle: 'Localidad Metropolitana', lat: 10.9465, lng: -74.7965, category: 'neighborhood' },
  { name: 'Barrio El Santuario', aliases: ['santuario', 'el santuario'], subtitle: 'Localidad Metropolitana', lat: 10.9420, lng: -74.7995, category: 'neighborhood' },
  { name: 'Puerto Colombia (Centro)', aliases: ['puerto colombia', 'muelle de puerto colombia'], subtitle: 'Puerto Colombia, Atlántico', lat: 10.9885, lng: -74.9545, category: 'neighborhood' },
];

function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Search local Barranquilla landmarks/neighborhoods with accent-insensitive ranking.
 */
export function searchLocalPlaces(query, limit = 5) {
  const q = normalizeText(query);
  if (q.length < 2) return [];

  const scored = [];
  for (const place of BARRANQUILLA_PLACES) {
    const normName = normalizeText(place.name);
    const normAliases = (place.aliases || []).map(normalizeText);
    const normSub = normalizeText(place.subtitle);

    let score = 0;
    if (normName.startsWith(q) || normAliases.some(a => a.startsWith(q))) {
      score = 100;
    } else {
      const words = `${normName} ${normAliases.join(' ')}`.split(/\s+/);
      if (words.some(w => w.startsWith(q))) {
        score = 80;
      } else if (normAliases.some(a => a.includes(q)) || normName.includes(q)) {
        score = 60;
      } else if (normSub.includes(q)) {
        score = 35;
      }
    }

    if (score > 0) {
      scored.push({ place, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name));

  return scored.slice(0, limit).map(({ place }) => ({
    displayName: place.name,
    subtitle: place.subtitle,
    lat: place.lat,
    lng: place.lng,
    type: place.category,
    category: place.category,
    source: 'local',
  }));
}

/**
 * Curated point-of-interest subset (excluding broad neighborhood centroids)
 * rendered immediately as interactive WebGL markers/labels on MapComponent.
 */
export const CURATED_MAP_POIS = BARRANQUILLA_PLACES.filter((p) => p.category !== 'neighborhood');
