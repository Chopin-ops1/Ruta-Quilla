/**
 * Curated catalog of key places, landmarks, malls, universities,
 * hospitals, and neighborhoods across Barranquilla & Área Metropolitana.
 * Provides instant (0 ms) accent-insensitive local autocomplete.
 */

export const BARRANQUILLA_PLACES = [
  // ---- Centros Comerciales ----
  { name: 'C.C. Buenavista', aliases: ['buenavista', 'buenavista 1', 'buenavista 2', 'cc buenavista'], subtitle: 'Calle 98 #52-115, Buenavista', lat: 11.01315, lng: -74.82767, category: 'mall' },
  { name: 'C.C. Viva Barranquilla', aliases: ['viva', 'viva barranquilla', 'cc viva', 'exito viva'], subtitle: 'Cra 51B #87-50, Alto Prado', lat: 11.00915, lng: -74.82082, category: 'mall' },
  { name: 'Mallplaza Buenavista', aliases: ['mallplaza', 'mall plaza', 'mallplaza buenavista'], subtitle: 'Cra 55 #99-51, Buenavista', lat: 11.01557, lng: -74.82871, category: 'mall' },
  { name: 'C.C. Portal del Prado', aliases: ['portal del prado', 'portal', 'cc portal del prado'], subtitle: 'Calle 53 #46-192, El Prado', lat: 10.98954, lng: -74.78858, category: 'mall' },
  { name: 'C.C. Único', aliases: ['unico', 'cc unico', 'centro comercial unico'], subtitle: 'Calle 74 #38D-113, Betania', lat: 10.98942, lng: -74.81268, category: 'mall' },
  { name: 'C.C. Villa Country', aliases: ['villa country', 'cc villa country'], subtitle: 'Calle 78 #53-70, Villa Country', lat: 11.00429, lng: -74.80626, category: 'mall' },
  { name: 'C.C. Country Plaza', aliases: ['country plaza', 'cc country plaza'], subtitle: 'Cra 53 #76-239, Alto Prado', lat: 11.00472, lng: -74.80744, category: 'mall' },
  { name: 'C.C. Americano', aliases: ['americano', 'cc americano'], subtitle: 'Cra 38 #74-109, Olaya / Betania', lat: 10.98487, lng: -74.81351, category: 'mall' },
  { name: 'C.C. Carnaval', aliases: ['carnaval', 'cc carnaval', 'carnaval soledad'], subtitle: 'Calle 30 #1-25, Soledad', lat: 10.90561, lng: -74.77394, category: 'mall' },
  { name: 'C.C. Gran Plaza del Sol', aliases: ['gran plaza del sol', 'plaza del sol', 'soledad'], subtitle: 'Calle 30 #30-15, Hipódromo, Soledad', lat: 10.92640, lng: -74.78074, category: 'mall' },
  { name: 'C.C. Plaza del Parque', aliases: ['plaza del parque', 'cc plaza del parque'], subtitle: 'Calle 99 #53-40, Buenavista', lat: 11.01507, lng: -74.82636, category: 'mall' },
  { name: 'C.C. Miramar', aliases: ['miramar', 'cc miramar'], subtitle: 'Cra 43 #99-50, Miramar', lat: 11.00345, lng: -74.83528, category: 'mall' },
  { name: 'C.C. Nuestro Atlántico', aliases: ['nuestro atlantico', 'cc nuestro atlantico'], subtitle: 'Calle 63 #13-71, Soledad', lat: 10.90578, lng: -74.80226, category: 'mall' },
  { name: 'C.C. Parque Alegra', aliases: ['parque alegra', 'alegra', 'cc parque alegra'], subtitle: 'Calle 30 #6B-50, Suroriente', lat: 10.94513, lng: -74.78303, category: 'mall' },
  { name: 'C.C. Metrocentro', aliases: ['metrocentro', 'cc metrocentro'], subtitle: 'Calle 45 Murillo #1-85, Ciudadela', lat: 10.93100, lng: -74.79974, category: 'mall' },
  { name: 'C.C. Panorama', aliases: ['panorama', 'cc panorama'], subtitle: 'Calle 30 #6B-150, La Unión', lat: 10.94539, lng: -74.78514, category: 'mall' },

  // ---- Universidades y Educación ----
  { name: 'Universidad del Norte', aliases: ['uninorte', 'universidad del norte'], subtitle: 'Km 5 Vía Puerto Colombia', lat: 11.01995, lng: -74.85080, category: 'university' },
  { name: 'Universidad del Atlántico (Sede Norte)', aliases: ['uniatlantico', 'universidad del atlantico', 'ua norte'], subtitle: 'Km 7 Vía Puerto Colombia', lat: 11.01771, lng: -74.87433, category: 'university' },
  { name: 'Universidad del Atlántico (Sede Centro)', aliases: ['uniatlantico centro', 'bellas artes', 'cra 43 calle 50'], subtitle: 'Cra 43 #50-53, El Rosario', lat: 10.98304, lng: -74.79006, category: 'university' },
  { name: 'Universidad Libre (Sede Norte)', aliases: ['unilibre', 'universidad libre', 'unilibre norte'], subtitle: 'Km 7 Vía Puerto Colombia', lat: 11.02145, lng: -74.86520, category: 'university' },
  { name: 'Universidad Libre (Sede Centro)', aliases: ['unilibre centro', 'universidad libre centro'], subtitle: 'Cra 46 #48-170, Barrio Abajo', lat: 10.98894, lng: -74.78809, category: 'university' },
  { name: 'Universidad Simón Bolívar', aliases: ['unisimon', 'simon bolivar', 'universidad simon bolivar'], subtitle: 'Cra 59 #59-65, El Prado', lat: 10.99486, lng: -74.79273, category: 'university' },
  { name: 'Universidad Autónoma del Caribe', aliases: ['uniautonoma', 'autonoma', 'uac'], subtitle: 'Calle 90 #46-112, Nuevo Horizonte', lat: 11.00438, lng: -74.82360, category: 'university' },
  { name: 'Universidad de la Costa (CUC)', aliases: ['cuc', 'universidad de la costa'], subtitle: 'Calle 58 #55-66, El Prado', lat: 10.99549, lng: -74.78994, category: 'university' },
  { name: 'Universidad Metropolitana', aliases: ['unimetro', 'metropolitana', 'universidad metropolitana'], subtitle: 'Calle 76 #42-78, Ciudad Jardín', lat: 10.99295, lng: -74.81322, category: 'university' },
  { name: 'SENA Centro Colombo Alemán', aliases: ['sena', 'colombo aleman', 'sena calle 30'], subtitle: 'Calle 30 #3E-164, Suroriente', lat: 10.94192, lng: -74.78242, category: 'university' },
  { name: 'Institución Universitaria de Barranquilla - IUB (Soledad)', aliases: ['itsa', 'iub', 'unibarranquilla', 'instituto tecnologico'], subtitle: 'Calle 18 #39-100, Soledad', lat: 10.93545, lng: -74.76478, category: 'university' },

  // ---- Clínicas y Hospitales ----
  { name: 'Clínica Portoazul', aliases: ['portoazul', 'clinica portoazul'], subtitle: 'Cra 30 Corredor Universitario, Puerto Colombia', lat: 11.01560, lng: -74.84622, category: 'hospital' },
  { name: 'Clínica del Caribe', aliases: ['clinica del caribe', 'caribe'], subtitle: 'Calle 80 #49C-65, Alto Prado', lat: 11.00161, lng: -74.81322, category: 'hospital' },
  { name: 'Clínica Oftalmológica del Caribe', aliases: ['clinica oftalmologica', 'oftalmologica del caribe'], subtitle: 'Cra 51B #86-17, Alto Prado', lat: 11.00668, lng: -74.81992, category: 'hospital' },
  { name: 'Clínica Reina Catalina', aliases: ['reina catalina', 'clinica reina catalina'], subtitle: 'Calle 82 #47-12, Alto Prado', lat: 11.00143, lng: -74.81600, category: 'hospital' },
  { name: 'Clínica General del Norte', aliases: ['general del norte', 'clinica general del norte'], subtitle: 'Calle 70 #48-35, Colombia', lat: 10.99523, lng: -74.80289, category: 'hospital' },
  { name: 'Clínica La Asunción', aliases: ['la asuncion', 'clinica la asuncion'], subtitle: 'Calle 70B #41-93, Las Delicias', lat: 10.98947, lng: -74.80685, category: 'hospital' },
  { name: 'Clínica Iberoamérica', aliases: ['iberoamerica', 'clinica iberoamerica'], subtitle: 'Cra 50 #85-209, Alto Prado', lat: 11.00549, lng: -74.82032, category: 'hospital' },
  { name: 'Clínica Bonnadona Prevenir', aliases: ['bonnadona', 'clinica bonnadona'], subtitle: 'Cra 49C #82-70, Alto Prado', lat: 11.00266, lng: -74.81673, category: 'hospital' },
  { name: 'Clínica La Misericordia', aliases: ['la misericordia', 'clinica misericordia'], subtitle: 'Calle 80 #47-34, Alto Prado', lat: 10.99938, lng: -74.81390, category: 'hospital' },
  { name: 'Hospital Universidad del Norte', aliases: ['hospital uninorte', 'hospital universidad del norte'], subtitle: 'Calle 30 Vía Aeropuerto, Soledad', lat: 10.92980, lng: -74.78078, category: 'hospital' },
  { name: 'Camino Adelita de Char', aliases: ['adelita de char', 'camino adelita'], subtitle: 'Calle 50 #21B-15, El Carmen', lat: 10.96529, lng: -74.79800, category: 'hospital' },

  // ---- Lugares Emblemáticos, Transporte y Parques ----
  { name: 'Gran Malecón del Río', aliases: ['malecon', 'gran malecon', 'malecon del rio'], subtitle: 'Avenida del Río, Río Magdalena', lat: 11.02155, lng: -74.79442, category: 'landmark' },
  { name: 'Caimán del Río (Gran Malecón)', aliases: ['caiman del rio', 'malecon gastronomia'], subtitle: 'Gran Malecón del Río, Sector Gastronómico', lat: 11.02305, lng: -74.79599, category: 'landmark' },
  { name: 'Puerta de Oro (Centro de Eventos)', aliases: ['puerta de oro', 'centro de eventos'], subtitle: 'Vía 40 #79B-06, Siape', lat: 11.02372, lng: -74.79984, category: 'landmark' },
  { name: 'Ventana al Mundo', aliases: ['ventana al mundo', 'aleta'], subtitle: 'Glorieta Vía 40 - Circunvalar, Las Flores', lat: 11.03316, lng: -74.83143, category: 'landmark' },
  { name: 'Ventana de Campeones (Aleta del Tiburón)', aliases: ['ventana de campeones', 'aleta del tiburon', 'junior'], subtitle: 'Isla La Loma / Gran Malecón', lat: 10.99832, lng: -74.77276, category: 'landmark' },
  { name: 'Estadio Metropolitano Roberto Meléndez', aliases: ['estadio metropolitano', 'el metro', 'metropolitano'], subtitle: 'Calle 45 Murillo con Circunvalar', lat: 10.92695, lng: -74.80051, category: 'landmark' },
  { name: 'Estadio Romelio Martínez', aliases: ['romelio martinez', 'estadio romelio'], subtitle: 'Calle 72 con Cra 46', lat: 10.99382, lng: -74.80706, category: 'landmark' },
  { name: 'Estadio Édgar Rentería', aliases: ['edgar renteria', 'estadio beisbol', 'tomas arrieta'], subtitle: 'Cra 54 con Calle 45, Montecristo / Barrio Abajo', lat: 10.99568, lng: -74.78411, category: 'landmark' },
  { name: 'Terminal de Transportes de Barranquilla', aliases: ['terminal', 'terminal de transportes', 'terminal soledad'], subtitle: 'Prolongación Murillo, Soledad', lat: 10.90946, lng: -74.79426, category: 'transit' },
  { name: 'Aeropuerto Internacional Ernesto Cortissoz', aliases: ['aeropuerto', 'cortissoz', 'ernesto cortissoz'], subtitle: 'Autopista al Aeropuerto, Soledad', lat: 10.88798, lng: -74.78178, category: 'transit' },
  { name: 'Paseo Bolívar', aliases: ['paseo bolivar', 'calle 34', 'centro paseo bolivar'], subtitle: 'Calle 34 entre Cras 40 y 45, Centro Histórico', lat: 10.98192, lng: -74.77780, category: 'landmark' },
  { name: 'Plaza de la Paz', aliases: ['plaza de la paz', 'catedral', 'catedral metropolitana'], subtitle: 'Calle 53 con Cra 46, El Rosario', lat: 10.98809, lng: -74.78941, category: 'landmark' },
  { name: 'Intendencia Fluvial', aliases: ['intendencia fluvial', 'intendencia', 'caño de la ahuyama'], subtitle: 'Calle 30 #46-10, Centro', lat: 10.98578, lng: -74.77583, category: 'landmark' },
  { name: 'Museo del Carnaval de Barranquilla', aliases: ['museo del carnaval', 'carnaval'], subtitle: 'Cra 54 #49B-39, Barrio Abajo', lat: 10.99284, lng: -74.78767, category: 'landmark' },
  { name: 'Parque Cultural del Caribe', aliases: ['parque cultural', 'parque cultural del caribe'], subtitle: 'Calle 36 #46-66, Centro', lat: 10.98637, lng: -74.77798, category: 'landmark' },
  { name: 'Parque Venezuela', aliases: ['parque venezuela', 'venezuela'], subtitle: 'Calle 87 con Cra 43B, Los Alpes', lat: 11.00146, lng: -74.82418, category: 'park' },
  { name: 'Parque Electrificadora', aliases: ['parque electrificadora', 'la electrificadora'], subtitle: 'Calle 85 con Cra 64, Riomar', lat: 11.01391, lng: -74.81377, category: 'park' },
  { name: 'Parque Sagrado Corazón', aliases: ['sagrado corazon', 'parque sagrado corazon'], subtitle: 'Calle 80 con Cra 42E, Ciudad Jardín', lat: 10.99358, lng: -74.81807, category: 'park' },
  { name: 'Zoológico de Barranquilla', aliases: ['zoologico', 'zoo', 'zoologico barranquilla'], subtitle: 'Calle 77 #68-40, La Concepción', lat: 11.01097, lng: -74.79800, category: 'park' },
  { name: 'Ecoparque Ciénaga de Mallorquín', aliases: ['ecoparque', 'cienaga de mallorquin', 'mallorquin'], subtitle: 'Vía Las Flores – La Playa', lat: 11.03501, lng: -74.84451, category: 'park' },
  { name: 'Jardín Botánico de Barranquilla', aliases: ['jardin botanico', 'parque jardin botanico'], subtitle: 'Calle 41 con Cra 13C, La Victoria', lat: 10.95100, lng: -74.79684, category: 'park' },

  // ---- Estaciones Principales de Transmetro ----
  { name: 'Estación Portal de Soledad (Transmetro)', aliases: ['portal de soledad', 'transmetro soledad'], subtitle: 'Troncal Murillo — Soledad', lat: 10.90745, lng: -74.80090, category: 'transit' },
  { name: 'Estación Pacho Galán (Transmetro)', aliases: ['pacho galan', 'estacion pacho galan'], subtitle: 'Troncal Murillo — Soledad', lat: 10.91554, lng: -74.79903, category: 'transit' },
  { name: 'Estación Pedro Ramayá (Transmetro)', aliases: ['pedro ramaya', 'estacion pedro ramaya'], subtitle: 'Troncal Murillo — Soledad', lat: 10.92149, lng: -74.79913, category: 'transit' },
  { name: 'Estación Joaquín Barrios Polo / Estadio Metropolitano (Transmetro)', aliases: ['estacion estadio metropolitano', 'joaquin barrios polo'], subtitle: 'Troncal Murillo con Cra 1H', lat: 10.93325, lng: -74.79934, category: 'transit' },
  { name: 'Estación Buenos Aires (Transmetro)', aliases: ['estacion buenos aires', 'buenos aires transmetro'], subtitle: 'Av. Murillo entre Cras 7 y 7G — Transmetro', lat: 10.94188, lng: -74.79953, category: 'transit' },
  { name: 'Estación La Ocho (Transmetro)', aliases: ['estacion la ocho', 'la ocho transmetro'], subtitle: 'Av. Murillo entre Cras 8 y 8C — Transmetro', lat: 10.94669, lng: -74.79968, category: 'transit' },
  { name: 'Estación La Catorce (Transmetro)', aliases: ['estacion la catorce', 'la catorce transmetro'], subtitle: 'Av. Murillo con Cra 14 — Transmetro', lat: 10.95489, lng: -74.79633, category: 'transit' },
  { name: 'Estación La Veintiuna (Transmetro)', aliases: ['estacion la veintiuna', 'la veintiuna transmetro'], subtitle: 'Av. Murillo con Cra 21 — Transmetro', lat: 10.96043, lng: -74.79356, category: 'transit' },
  { name: 'Estación Atlántico (Transmetro)', aliases: ['estacion atlantico', 'atlantico transmetro'], subtitle: 'Av. Murillo con Cra 29 — Transmetro', lat: 10.96872, lng: -74.79016, category: 'transit' },
  { name: 'Estación Chiquinquirá (Transmetro)', aliases: ['estacion chiquinquira', 'chiquinquira transmetro'], subtitle: 'Av. Murillo entre Cras 33 y 38 — Transmetro', lat: 10.97731, lng: -74.78781, category: 'transit' },
  { name: 'Estación La Arenosa (Transmetro)', aliases: ['estacion la arenosa', 'la arenosa'], subtitle: 'Av. Murillo entre Cras 41 y 43 — Transmetro', lat: 10.98220, lng: -74.78644, category: 'transit' },
  { name: 'Estación Barrio Abajo (Transmetro)', aliases: ['estacion barrio abajo', 'barrio abajo transmetro'], subtitle: 'Cra 46 con Calle 46 — Transmetro', lat: 10.98730, lng: -74.78431, category: 'transit' },
  { name: 'Estación Parque Cultural (Transmetro)', aliases: ['estacion parque cultural', 'parque cultural transmetro'], subtitle: 'Cra 46 entre Calles 36 y 39 — Transmetro', lat: 10.98610, lng: -74.77867, category: 'transit' },
  { name: 'Estación La Catedral (Transmetro)', aliases: ['estacion catedral', 'estacion la catedral', 'catedral transmetro'], subtitle: 'Cra 46 entre Calles 50 y 53 — Transmetro', lat: 10.98860, lng: -74.78895, category: 'transit' },
  { name: 'Estación Alfredo Correa de Andréis (Transmetro)', aliases: ['alfredo correa', 'estacion alfredo correa'], subtitle: 'Cra 46 entre Calles 60 y 62 — Transmetro', lat: 10.99053, lng: -74.79612, category: 'transit' },
  { name: 'Estación Esthercita Forero (Transmetro)', aliases: ['esthercita forero', 'estacion esthercita forero'], subtitle: 'Cra 46 con Calle 70 — Transmetro', lat: 10.99247, lng: -74.80247, category: 'transit' },
  { name: 'Estación Joe Arroyo (Transmetro)', aliases: ['estacion joe arroyo', 'joe arroyo transmetro'], subtitle: 'Cra 46 con Calle 74 — Troncal Olaya Herrera', lat: 10.99507, lng: -74.80764, category: 'transit' },

  // ---- Barrios y Zonas Principales ----
  { name: 'Barrio El Prado', aliases: ['prado', 'el prado'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.99780, lng: -74.79687, category: 'neighborhood' },
  { name: 'Barrio Alto Prado', aliases: ['alto prado'], subtitle: 'Localidad Riomar', lat: 11.00436, lng: -74.81218, category: 'neighborhood' },
  { name: 'Barrio Altos de Riomar', aliases: ['altos del prado', 'altos de riomar'], subtitle: 'Localidad Riomar', lat: 11.01514, lng: -74.81948, category: 'neighborhood' },
  { name: 'Barrio Riomar', aliases: ['riomar'], subtitle: 'Localidad Riomar', lat: 11.01155, lng: -74.81500, category: 'neighborhood' },
  { name: 'Barrio Villa Santos', aliases: ['villa santos'], subtitle: 'Localidad Riomar', lat: 11.01086, lng: -74.83400, category: 'neighborhood' },
  { name: 'Barrio Villa Carolina', aliases: ['villa carolina'], subtitle: 'Localidad Riomar', lat: 11.02260, lng: -74.81592, category: 'neighborhood' },
  { name: 'Barrio El Golf', aliases: ['el golf', 'golf'], subtitle: 'Localidad Riomar', lat: 11.00965, lng: -74.80848, category: 'neighborhood' },
  { name: 'Barrio Los Nogales', aliases: ['los nogales', 'nogales'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.99367, lng: -74.82763, category: 'neighborhood' },
  { name: 'Barrio Ciudad Jardín', aliases: ['ciudad jardin'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.99169, lng: -74.81938, category: 'neighborhood' },
  { name: 'Barrio Boston', aliases: ['boston'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.98967, lng: -74.79550, category: 'neighborhood' },
  { name: 'Barrio El Recreo', aliases: ['el recreo', 'recreo'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.98305, lng: -74.79517, category: 'neighborhood' },
  { name: 'Barrio Las Delicias', aliases: ['delicias', 'las delicias'], subtitle: 'Localidad Norte - Centro Histórico', lat: 10.98824, lng: -74.80768, category: 'neighborhood' },
  { name: 'Barrio Olaya', aliases: ['olaya'], subtitle: 'Localidad Suroccidente', lat: 10.98173, lng: -74.81087, category: 'neighborhood' },
  { name: 'Barrio San Felipe', aliases: ['san felipe'], subtitle: 'Localidad Suroccidente', lat: 10.97286, lng: -74.80990, category: 'neighborhood' },
  { name: 'Barrio Los Andes', aliases: ['los andes'], subtitle: 'Localidad Suroccidente', lat: 10.97242, lng: -74.80357, category: 'neighborhood' },
  { name: 'Barrio El Silencio', aliases: ['el silencio', 'silencio'], subtitle: 'Localidad Suroccidente', lat: 10.97788, lng: -74.81603, category: 'neighborhood' },
  { name: 'Barrio Las Palmas', aliases: ['las palmas'], subtitle: 'Localidad Suroriente', lat: 10.94512, lng: -74.79018, category: 'neighborhood' },
  { name: 'Barrio Simón Bolívar', aliases: ['barrio simon bolivar', 'simon bolivar'], subtitle: 'Localidad Suroriente', lat: 10.94428, lng: -74.77722, category: 'neighborhood' },
  { name: 'Barrio La Unión', aliases: ['la union'], subtitle: 'Localidad Suroriente', lat: 10.95268, lng: -74.78940, category: 'neighborhood' },
  { name: 'Barrio San José', aliases: ['san jose'], subtitle: 'Localidad Suroriente', lat: 10.95960, lng: -74.79265, category: 'neighborhood' },
  { name: 'Barrio Chiquinquirá', aliases: ['chiquinquira'], subtitle: 'Localidad Suroriente', lat: 10.97600, lng: -74.78683, category: 'neighborhood' },
  { name: 'Barrio Montes', aliases: ['montes'], subtitle: 'Localidad Suroriente', lat: 10.96484, lng: -74.78327, category: 'neighborhood' },
  { name: 'Barrio Rebolo', aliases: ['rebolo'], subtitle: 'Localidad Suroriente', lat: 10.96307, lng: -74.77469, category: 'neighborhood' },
  { name: 'Centro de Barranquilla', aliases: ['centro', 'el centro'], subtitle: 'Centro Histórico, Barranquilla', lat: 10.97964, lng: -74.77872, category: 'neighborhood' },
  { name: 'Barranquillita', aliases: ['barranquillita', 'mercado'], subtitle: 'Zona Comercial Centro', lat: 10.98139, lng: -74.77262, category: 'neighborhood' },
  { name: 'Barrio Las Nieves', aliases: ['las nieves'], subtitle: 'Localidad Suroriente', lat: 10.95257, lng: -74.77918, category: 'neighborhood' },
  { name: 'Ciudadela 20 de Julio', aliases: ['ciudadela', '20 de julio', 'ciudadela 20 de julio'], subtitle: 'Localidad Metropolitana', lat: 10.92845, lng: -74.80582, category: 'neighborhood' },
  { name: 'Barrio Las Flores', aliases: ['las flores'], subtitle: 'Localidad Riomar', lat: 11.04154, lng: -74.82663, category: 'neighborhood' },
  { name: 'Corregimiento La Playa', aliases: ['la playa', 'eduardo santos'], subtitle: 'Vía a Puerto Colombia', lat: 11.03284, lng: -74.86605, category: 'neighborhood' },
  { name: 'Alameda del Río', aliases: ['alameda del rio', 'alameda'], subtitle: 'Circunvalar con Cra 43', lat: 10.99490, lng: -74.84394, category: 'neighborhood' },
  { name: 'Caribe Verde', aliases: ['caribe verde'], subtitle: 'Localidad Suroccidente', lat: 10.95841, lng: -74.85128, category: 'neighborhood' },
  { name: 'Villas de San Pablo', aliases: ['villas de san pablo', 'san pablo'], subtitle: 'Localidad Suroccidente', lat: 10.95885, lng: -74.86310, category: 'neighborhood' },
  { name: 'Soledad 2000', aliases: ['soledad 2000'], subtitle: 'Soledad, Atlántico', lat: 10.90668, lng: -74.78552, category: 'neighborhood' },
  { name: 'Hipódromo (Soledad)', aliases: ['hipodromo'], subtitle: 'Soledad, Atlántico', lat: 10.92812, lng: -74.76991, category: 'neighborhood' },
  { name: 'Barrio El Carmen', aliases: ['el carmen'], subtitle: 'Localidad Suroccidente', lat: 10.96457, lng: -74.79778, category: 'neighborhood' },
  { name: 'Barrio Cevillar', aliases: ['cevillar'], subtitle: 'Localidad Suroccidente', lat: 10.95827, lng: -74.80006, category: 'neighborhood' },
  { name: 'Barrio La Victoria', aliases: ['la victoria'], subtitle: 'Localidad Metropolitana', lat: 10.95287, lng: -74.79768, category: 'neighborhood' },
  { name: 'Barrio El Santuario', aliases: ['santuario', 'el santuario'], subtitle: 'Localidad Metropolitana', lat: 10.94519, lng: -74.80365, category: 'neighborhood' },
  { name: 'Puerto Colombia (Centro)', aliases: ['puerto colombia', 'muelle de puerto colombia'], subtitle: 'Puerto Colombia, Atlántico', lat: 10.98913, lng: -74.95541, category: 'neighborhood' },
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
