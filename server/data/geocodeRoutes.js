/**
 * ============================================
 * RutaQuilla - Geocodificación de Rutas v5
 * ============================================
 *
 * Genera routes_v5.json geocodificando cada intersección
 * de los itinerarios textuales del análisis oficial.
 *
 * Estrategia:
 * 1. Cada itinerario se parsea en waypoints (intersecciones)
 * 2. Cada waypoint se geocodifica con Nominatim (OSM)
 * 3. Se usa OSRM para trazar la ruta vial real entre waypoints
 * 4. El resultado es un GeoJSON LineString que sigue las calles
 *
 * IMPORTANTE: Solo Transmetro BRT tiene paradas fijas.
 * Los buses cooperativos permiten bajar en cualquier punto de la ruta.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ---- Colores por operador ----
const COLORES = {
  'Cooasoatlán': '#F97316',
  'Coochofal': '#14B8A6',
  'Coolitoral': '#06B6D4',
  'Cootransnorte': '#7C3AED',
  'Cootrasol': '#22D3EE',
  'La Carolina': '#818CF8',
  'Lolaya': '#EF4444',
  'Lucero San Felipe': '#F472B6',
  'Monterrey': '#34D399',
  'Sobusa': '#F59E0B',
  'Sodis': '#A78BFA',
  'Transmecar': '#10B981',
  'Transmetro': '#3B82F6',
  'Transurbar': '#FB923C',
};

// ============================================
// CATÁLOGO DE RUTAS CON ITINERARIOS DETALLADOS
// ============================================
// Extraídos de ruta-quilla-analisis-rutas.md Sección 3

const RUTAS_DETALLADAS = [
  {
    operador: 'Cooasoatlán',
    nombre: 'Calle 72 Tcherassi',
    codigo: 'C20',
    origen: 'Nevada Ciudad Salitre (Soledad)',
    destino: 'Calle 72 / Vía 40 (Barranquilla)',
    barrios: ['Ciudad Salitre', 'Soledad', 'Carrizal', 'El Tamarindo', 'Calancalá', 'Modelo', 'San Francisco', 'Calle 72'],
    ida: [
      'Nevada Ciudad Salitre, Soledad',
      'Calle 66, Soledad',
      'Transversal 1, Soledad',
      'Calle 68A, Soledad',
      'Calle 67, Soledad',
      'Avenida Murillo, Soledad',
      'Carrera 18, Barranquilla',
      'Calle 56, Barranquilla',
      'Carrera 24, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 47, Barranquilla',
      'Carrera 1A, Barranquilla',
      'Carrizal, Barranquilla',
      'Calle 46, Barranquilla',
      'Carrera 7, Barranquilla',
      'Calle 51B, Barranquilla',
      'El Tamarindo, Barranquilla',
      'Calle 45D, Barranquilla',
      'Carrera 16, Barranquilla',
      'Calle 53D, Barranquilla',
      'Carrera 27, Barranquilla',
      'Calle 51, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 72, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 72 con Carrera 41, Barranquilla',
    ],
    regreso: [
      'Carrera 41 con Calle 71, Barranquilla',
      'Calle 71, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 54, Barranquilla',
      'Carrera 31, Barranquilla',
      'Calle 51B, Barranquilla',
      'Calle 50, Barranquilla',
      'Calle 51, Barranquilla',
      'Carrera 27, Barranquilla',
      'Calle 53D, Barranquilla',
      'Carrera 16, Barranquilla',
      'Calle 50, Barranquilla',
      'Carrera 7, Barranquilla',
      'Calle 46, Barranquilla',
      'Carrera 4B, Barranquilla',
      'Calle 49, Barranquilla',
      'Carrera 1A, Barranquilla',
      'Calle 47, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 58B, Soledad',
      'Carrera 24, Soledad',
      'Calle 56, Soledad',
      'Carrera 18, Soledad',
      'Avenida Murillo, Soledad',
      'Nevada Ciudad Salitre, Soledad',
    ],
    idaTexto: 'Nevada Ciudad Salitre → Calle 66 → Tv 1 → Calle 68A → Caoba → Calle 67 → Av. Murillo → Carrera 18 → Calle 56 → Carrera 24 → Av. Circunvalar → Calle 47 → Carrera 1A → Paso Carrizal → Calle 46 → Carrera 7 → Calle 51B → El Tamarindo → Calle 45D → Carrera 16 → Calle 53D → Carrera 27 → Calle 51 → Cementerio Calancalá → Carrera 38 → Calle 72 → Vía 40 → Calle 72 → Carrera 41',
    regresoTexto: 'Carrera 41 → Calle 71 → Carrera 38 → Calle 54 → Carrera 31 → Calle 51B → Calle 50 → Cementerio Calancalá → Calle 51 → Carrera 27 → Calle 53D → Carrera 16 → El Tamarindo → Calle 50 → Carrera 7 → Calle 46 → Paso Carrizal → Carrera 4B → Calle 49 → Carrera 1A → Calle 47 → Av. Circunvalar → Puente 7 de Abril → Av. Circunvalar → Calle 58B → Carrera 24 → Calle 56 → Carrera 18 → Av. Murillo → Nevada Ciudad Salitre',
  },
  {
    operador: 'Cooasoatlán',
    nombre: 'Calle 84 Tcherassi',
    codigo: 'C21',
    origen: 'Nevada (Soledad)',
    destino: 'Calle 84 / Tcherassi',
    barrios: ['Soledad', 'Los Andes', 'Buenavista', 'Calle 72', 'Calle 80', 'Calle 84'],
    ida: [
      'Nevada, Soledad',
      'Avenida Murillo, Soledad',
      'Avenida Circunvalar, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 77, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 80, Barranquilla',
      'Calle 84, Barranquilla',
    ],
    regreso: [
      'Calle 84, Barranquilla',
      'Calle 80, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 77, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 72, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Avenida Murillo, Soledad',
      'Nevada, Soledad',
    ],
    idaTexto: 'Nevada Soledad → Av. Murillo → Av. Circunvalar → Calle 72 → Corredor universitario → Carrera 54 → Calle 77 → Vía 40 → Calle 80 → Calle 84',
    regresoTexto: 'Calle 84 → Calle 80 → Vía 40 → Calle 77 → Carrera 54 → Calle 72 → Av. Circunvalar → Av. Murillo → Nevada',
  },
  {
    operador: 'Cooasoatlán',
    nombre: 'Calle 84 Cordialidad',
    codigo: 'C22',
    origen: 'Nevada (Soledad)',
    destino: 'Calle 84 vía Cordialidad',
    barrios: ['Soledad', 'Cordialidad', 'San Felipe', 'Barrio Abajo', 'Calle 72', 'Calle 84'],
    ida: [
      'Nevada, Soledad',
      'Avenida Murillo, Soledad',
      'Avenida Cordialidad, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 72, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 80, Barranquilla',
      'Calle 84, Barranquilla',
    ],
    regreso: [
      'Calle 84, Barranquilla',
      'Calle 80, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 38, Barranquilla',
      'Avenida Cordialidad, Barranquilla',
      'Avenida Murillo, Soledad',
      'Nevada, Soledad',
    ],
    idaTexto: 'Nevada → Av. Murillo → Cordialidad → Carrera 38 → Calle 72 → Vía 40 → Calle 80 → Calle 84',
    regresoTexto: 'Calle 84 → Calle 80 → Vía 40 → Calle 72 → Carrera 38 → Cordialidad → Av. Murillo → Nevada',
  },
  {
    operador: 'Coochofal',
    nombre: 'K-14 Américas',
    codigo: 'C4',
    origen: 'Granabastos (Soledad)',
    destino: 'Américas / Carrera 14',
    barrios: ['Granabastos', 'Soledad', 'Las Palmas', 'Cevillar', 'Carrera 14', 'Las Américas'],
    ida: [
      'Granabastos, Soledad',
      'Avenida Murillo, Soledad',
      'Calle 30, Barranquilla',
      'Carrera 14, Barranquilla',
      'Calle 54, Barranquilla',
      'Calle 72, Barranquilla',
      'Las Américas, Barranquilla',
    ],
    regreso: [
      'Las Américas, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 14, Barranquilla',
      'Calle 30, Barranquilla',
      'Avenida Murillo, Soledad',
      'Granabastos, Soledad',
    ],
    idaTexto: 'Granabastos → Av. Murillo → Calle 30 → Carrera 14 → Calle 54 → Carrera 14 → Calle 72 → Las Américas',
    regresoTexto: 'Las Américas → Calle 72 → Carrera 14 → Calle 30 → Av. Murillo → Granabastos',
  },
  {
    operador: 'Coochofal',
    nombre: 'K-8 Carrizal',
    codigo: 'C8',
    origen: 'Granabastos (Soledad)',
    destino: 'Carrizal / Carrera 8',
    barrios: ['Granabastos', 'La Victoria', 'Cevillar', 'Carrizal', 'Las Nieves'],
    ida: [
      'Granabastos, Soledad',
      'Avenida Murillo, Soledad',
      'Calle 30, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 50, Barranquilla',
      'Carrizal, Barranquilla',
    ],
    regreso: [
      'Carrizal, Barranquilla',
      'Calle 50, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 30, Barranquilla',
      'Avenida Murillo, Soledad',
      'Granabastos, Soledad',
    ],
    idaTexto: 'Granabastos → Av. Murillo → Calle 30 → Carrera 8 → Calle 50 → Carrizal',
    regresoTexto: 'Carrizal → Calle 50 → Carrera 8 → Calle 30 → Av. Murillo → Granabastos',
  },
  {
    operador: 'Coochofal',
    nombre: 'Circular C9',
    codigo: 'C9',
    origen: 'Centro de Barranquilla',
    destino: 'Circular (regresa al origen)',
    barrios: ['Centro', 'Barlovento', 'San Francisco', 'Modelo', 'Zona Industrial Vía 40'],
    ida: [
      'Paseo Bolívar, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 72, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 30, Barranquilla',
      'Paseo Bolívar, Barranquilla',
    ],
    regreso: [
      'Paseo Bolívar, Barranquilla',
      'Calle 30, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 44, Barranquilla',
      'Paseo Bolívar, Barranquilla',
    ],
    idaTexto: 'Paseo Bolívar → Carrera 44 → Calle 45 → Carrera 54 → Calle 72 → Vía 40 → Calle 30 → Paseo Bolívar',
    regresoTexto: 'Paseo Bolívar → Calle 30 → Vía 40 → Calle 72 → Carrera 54 → Calle 45 → Carrera 44 → Paseo Bolívar',
  },
  {
    operador: 'Coolitoral',
    nombre: 'B1 Calle 72 Centro Pueblo (Cra 38)',
    codigo: 'B1',
    origen: 'Vía 40 / Calle 72',
    destino: 'Centro / Barlovento',
    barrios: ['Modelo', 'San Francisco', 'Bellavista', 'Prado', 'Las Delicias', 'Olaya', 'El Silencio', 'San Felipe', 'Los Andes', 'San Isidro', 'Atlántico', 'Montes', 'Chiquinquirá', 'Centro', 'Barlovento'],
    ida: [
      'Vía 40 con Calle 72, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 35B, Barranquilla',
      'Calle 71, Barranquilla',
      'Carrera 33, Barranquilla',
      'El Silencio, Barranquilla',
      'Carrera 27, Barranquilla',
      'Calle 64, Barranquilla',
      'Carrera 24, Barranquilla',
      'Avenida Cordialidad, Barranquilla',
      'Calle 39, Barranquilla',
      'Carrera 30, Barranquilla',
      'Calle 38, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 30, Barranquilla',
      'Vía 40, Barranquilla',
    ],
    regreso: [
      'Vía 40, Barranquilla',
      'Calle 30, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 38, Barranquilla',
      'Carrera 30, Barranquilla',
      'Calle 39, Barranquilla',
      'Avenida Cordialidad, Barranquilla',
      'Carrera 24, Barranquilla',
      'Calle 64, Barranquilla',
      'Carrera 27, Barranquilla',
      'El Silencio, Barranquilla',
      'Calle 71, Barranquilla',
      'Carrera 35B, Barranquilla',
      'Calle 72, Barranquilla',
      'Vía 40 con Calle 72, Barranquilla',
    ],
    idaTexto: 'Vía 40 → Calle 72 → Carrera 35B → Calle 71 → Carrera 33 El Silencio → Carrera 27 → Calle 64 → Carrera 24 → Av. Cordialidad → Calle 39 → Carrera 30 → Calle 38 → Carrera 44 → Calle 30 → Vía 40',
    regresoTexto: 'Vía 40 → Calle 30 → Carrera 44 → Calle 38 → Carrera 30 → Calle 39 → Av. Cordialidad → Carrera 24 → Calle 64 → Carrera 27 → El Silencio → Calle 71 → Carrera 35B → Calle 72 → Vía 40',
  },
  {
    operador: 'Coolitoral',
    nombre: 'B2 Manuela Beltrán Calle 72',
    codigo: 'B2',
    origen: 'Manuela Beltrán (Soledad)',
    destino: 'Calle 72 / Uninorte',
    barrios: ['Manuela Beltrán', 'Soledad', 'Las Palmas', 'Cevillar', 'El Carmen', 'Loma Fresca', 'Los Andes', 'Olaya', 'Las Delicias', 'Prado', 'Bellavista', 'San Francisco'],
    ida: [
      'Manuela Beltrán, Soledad',
      'Avenida Murillo, Soledad',
      'Calle 30, Barranquilla',
      'Carrera 30, Barranquilla',
      'Arboleda, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 24, Barranquilla',
      'Calle 53D, Barranquilla',
      'Carrera 25, Barranquilla',
      'Calle 57, Barranquilla',
      'Carrera 27, Barranquilla',
      'Calle 71, Barranquilla',
      'Carrera 35B, Barranquilla',
      'Calle 72, Barranquilla',
      'Universidad del Norte, Barranquilla',
    ],
    regreso: [
      'Universidad del Norte, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 35B, Barranquilla',
      'Calle 71, Barranquilla',
      'Carrera 27, Barranquilla',
      'Calle 57, Barranquilla',
      'Carrera 25, Barranquilla',
      'Calle 53D, Barranquilla',
      'Carrera 24, Barranquilla',
      'Arboleda, Barranquilla',
      'Carrera 30, Barranquilla',
      'Calle 30, Barranquilla',
      'Avenida Murillo, Soledad',
      'Manuela Beltrán, Soledad',
    ],
    idaTexto: 'Manuela Beltrán → Av. Murillo → Calle 30 → Carrera 30 → Arboleda → Calle 45 → Carrera 24 → Calle 53D → Carrera 25 → Calle 57 → Carrera 27 → Calle 71 → Carrera 35B → Calle 72 → Uninorte',
    regresoTexto: 'Uninorte → Calle 72 → Carrera 35B → Calle 71 → Carrera 27 → Calle 57 → Carrera 25 → Calle 53D → Carrera 24 → Arboleda → Carrera 30 → Calle 30 → Av. Murillo → Manuela Beltrán',
  },
  {
    operador: 'Coolitoral',
    nombre: 'Peñita Nogales A3',
    codigo: 'A3',
    origen: 'La Peñita',
    destino: 'Nogales / Norte',
    barrios: ['La Peñita', 'Las Nieves', 'Barrio Abajo', 'San José', 'Calle 72', 'La Castellana', 'Nogales'],
    ida: [
      'La Peñita, Barranquilla',
      'Carrera 14, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 72, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Nogales, Barranquilla',
    ],
    regreso: [
      'Nogales, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 14, Barranquilla',
      'La Peñita, Barranquilla',
    ],
    idaTexto: 'La Peñita → Carrera 14 → Calle 45 → Carrera 38 → Calle 72 → Av. Circunvalar → Nogales',
    regresoTexto: 'Nogales → Av. Circunvalar → Calle 72 → Carrera 38 → Calle 45 → Carrera 14 → La Peñita',
  },
  {
    operador: 'Coolitoral',
    nombre: 'Circunvalar Buenavista B17',
    codigo: 'B17',
    origen: 'Centro Barranquilla',
    destino: 'Buenavista / Circunvalar Alta',
    barrios: ['Centro', 'Barlovento', 'Los Andes', 'San Felipe', 'Calle 72', 'La Castellana', 'Los Alpes', 'Buenavista'],
    ida: [
      'Centro, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 45, Barranquilla',
      'Avenida Murillo, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 65, Barranquilla',
      'Calle 80, Barranquilla',
      'Buenavista, Barranquilla',
    ],
    regreso: [
      'Buenavista, Barranquilla',
      'Calle 80, Barranquilla',
      'Carrera 65, Barranquilla',
      'Calle 72, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 44, Barranquilla',
      'Centro, Barranquilla',
    ],
    idaTexto: 'Centro → Carrera 44 → Calle 45 → Av. Murillo → Av. Circunvalar → Calle 72 → Carrera 65 → Calle 80 → Buenavista',
    regresoTexto: 'Buenavista → Calle 80 → Carrera 65 → Calle 72 → Av. Circunvalar → Calle 45 → Carrera 44 → Centro',
  },
  {
    operador: 'Cootransnorte',
    nombre: 'Cordialidad',
    codigo: 'C16',
    origen: 'Granabastos (Soledad)',
    destino: 'Uninorte / Calle 72',
    barrios: ['Granabastos', 'Soledad', 'La Cordialidad', 'San Felipe', 'Barrio Abajo', 'Los Andes', 'Modelo', 'San Francisco', 'Calle 72'],
    ida: [
      'Granabastos, Soledad',
      'Avenida Murillo, Soledad',
      'Avenida Cordialidad, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 54, Barranquilla',
      'Universidad del Norte, Barranquilla',
    ],
    regreso: [
      'Universidad del Norte, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 38, Barranquilla',
      'Avenida Cordialidad, Barranquilla',
      'Avenida Murillo, Soledad',
      'Granabastos, Soledad',
    ],
    idaTexto: 'Granabastos → Av. Murillo → Av. Cordialidad → Carrera 38 → Calle 72 → Carrera 54 → Uninorte',
    regresoTexto: 'Uninorte → Carrera 54 → Calle 72 → Carrera 38 → Av. Cordialidad → Av. Murillo → Granabastos',
  },
  {
    operador: 'Cootransnorte',
    nombre: 'Vía 40',
    codigo: 'C15',
    origen: 'Granabastos (Soledad)',
    destino: 'Zona Industrial Vía 40 / Norte',
    barrios: ['Granabastos', 'Soledad', 'Centro', 'Barlovento', 'Zona Industrial', 'Calle 72', 'Calle 80'],
    ida: [
      'Granabastos, Soledad',
      'Avenida Murillo, Soledad',
      'Calle 30, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 72, Barranquilla',
      'Calle 80, Barranquilla',
    ],
    regreso: [
      'Calle 80, Barranquilla',
      'Calle 72, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 30, Barranquilla',
      'Avenida Murillo, Soledad',
      'Granabastos, Soledad',
    ],
    idaTexto: 'Granabastos → Av. Murillo → Calle 30 → Vía 40 → Calle 72 → Calle 80 → Norte',
    regresoTexto: 'Norte → Calle 80 → Calle 72 → Vía 40 → Calle 30 → Av. Murillo → Granabastos',
  },
  {
    operador: 'Lolaya',
    nombre: 'Soledad 2000 Calle 72 Zoológico',
    codigo: 'D8',
    origen: 'Manuela Beltrán (Soledad)',
    destino: 'Zoológico / Concepción (Calle 77)',
    barrios: ['Soledad 2000', 'Manuela Beltrán', 'Hipódromo', 'Las Palmas', 'La Victoria', 'Cevillar', 'El Carmen', 'Loma Fresca', 'Los Andes', 'Olaya', 'Las Delicias', 'Prado', 'Bellavista', 'San Francisco', 'La Concepción'],
    ida: [
      'Manuela Beltrán, Soledad',
      'Calle 30, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 36B, Barranquilla',
      'Carrera 14, Barranquilla',
      'Calle 53D, Barranquilla',
      'Carrera 25, Barranquilla',
      'Calle 57, Barranquilla',
      'Carrera 27, Barranquilla',
      'Calle 71, Barranquilla',
      'Carrera 35B, Barranquilla',
      'Calle 72, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 76, Barranquilla',
      'Carrera 68, Barranquilla',
      'Calle 77, Barranquilla',
    ],
    regreso: [
      'Calle 77, Barranquilla',
      'Carrera 68, Barranquilla',
      'Calle 76, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 35B, Barranquilla',
      'Calle 71, Barranquilla',
      'Carrera 27, Barranquilla',
      'Calle 57, Barranquilla',
      'Carrera 25, Barranquilla',
      'Calle 53D, Barranquilla',
      'Carrera 14, Barranquilla',
      'Calle 36B, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 30, Barranquilla',
      'Manuela Beltrán, Soledad',
    ],
    idaTexto: 'Manuela Beltrán → Calle 30 → Carrera 8 → Calle 36B → Carrera 14 → Calle 53D → Carrera 25 → Calle 57 → Carrera 27 → Calle 71 → Carrera 35B → Calle 72 → Vía 40 → Calle 76 → Carrera 68 → Calle 77',
    regresoTexto: 'Calle 77 → Carrera 68 → Calle 76 → Vía 40 → Calle 72 → Carrera 35B → Calle 71 → Carrera 27 → Calle 57 → Carrera 25 → Calle 53D → Carrera 14 → Calle 36B → Carrera 8 → Calle 30 → Manuela Beltrán',
  },
  {
    operador: 'Sobusa',
    nombre: 'Granabastos C72 Uninorte',
    codigo: 'C17',
    origen: 'Granabastos (Soledad)',
    destino: 'Uninorte / Buenavista',
    barrios: ['Granabastos', 'Soledad', 'Ciudad del Puerto', 'Arboleda', 'Centro', 'Zona Norte', 'Calle 72', 'Uninorte', 'Buenavista'],
    ida: [
      'Granabastos, Soledad',
      'Avenida Murillo, Soledad',
      'Calle 30, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 54, Barranquilla',
      'Universidad del Norte, Barranquilla',
      'Buenavista, Barranquilla',
    ],
    regreso: [
      'Buenavista, Barranquilla',
      'Universidad del Norte, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 72, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 30, Barranquilla',
      'Avenida Murillo, Soledad',
      'Granabastos, Soledad',
    ],
    idaTexto: 'Granabastos → Av. Murillo → Calle 30 → Av. Circunvalar → Calle 72 → Carrera 54 → Uninorte → Buenavista',
    regresoTexto: 'Buenavista → Uninorte → Carrera 54 → Calle 72 → Av. Circunvalar → Calle 30 → Av. Murillo → Granabastos',
  },
  {
    operador: 'Sobusa',
    nombre: 'K-54 Uninorte',
    codigo: 'C10',
    origen: 'Soledad',
    destino: 'Uninorte (Calle 98)',
    barrios: ['Soledad', 'Las Palmas', 'Carrera 54', 'Zona Norte', 'El Recreo', 'Uninorte'],
    ida: [
      'Soledad, Soledad',
      'Avenida Murillo, Soledad',
      'Carrera 54, Barranquilla',
      'Calle 54, Barranquilla',
      'Calle 72, Barranquilla',
      'Calle 80, Barranquilla',
      'Universidad del Norte, Barranquilla',
    ],
    regreso: [
      'Universidad del Norte, Barranquilla',
      'Calle 80, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 54, Barranquilla',
      'Avenida Murillo, Soledad',
      'Soledad, Soledad',
    ],
    idaTexto: 'Soledad → Av. Murillo → Carrera 54 → Calle 54 → Calle 72 → Calle 80 → Uninorte',
    regresoTexto: 'Uninorte → Calle 80 → Calle 72 → Carrera 54 → Av. Murillo → Soledad',
  },
  {
    operador: 'Sobusa',
    nombre: 'Vivero Paraíso (Manuela Beltrán)',
    codigo: 'C12',
    origen: 'Nevada Granabastos',
    destino: 'Norte / Calle 90',
    barrios: ['Granabastos', 'Manuela Beltrán', 'Ciudad del Puerto', 'Arboleda', 'Soledad', 'Centro', 'Barlovento', 'La Merced', 'Rebolo', 'San Roque', 'El Golf', 'Recreo', 'Paraíso', 'Los Cocos'],
    ida: [
      'Nevada Granabastos, Soledad',
      'Avenida Murillo, Soledad',
      'Manuela Beltrán, Soledad',
      'Calle 37, Soledad',
      'Carrera 11, Soledad',
      'Calle 43, Soledad',
      'Carrera 14, Soledad',
      'Ciudad del Puerto, Soledad',
      'Carrera 24, Soledad',
      'Calle 45, Soledad',
      'Arboleda, Soledad',
      'Carrera 30, Soledad',
      'Calle 30, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Boulevard Simón Bolívar, Barranquilla',
      'Calle 17, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 30, Barranquilla',
      'Carrera 45, Barranquilla',
      'Calle 53, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 58, Barranquilla',
      'Carrera 66, Barranquilla',
      'Calle 68, Barranquilla',
      'Carrera 62, Barranquilla',
      'Calle 77, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 80, Barranquilla',
      'Calle 85, Barranquilla',
      'Carrera 64, Barranquilla',
      'Calle 90, Barranquilla',
    ],
    regreso: [
      'Calle 90, Barranquilla',
      'Carrera 49C, Barranquilla',
      'Calle 75, Barranquilla',
      'Carrera 52, Barranquilla',
      'Calle 70, Barranquilla',
      'Carrera 47, Barranquilla',
      'Carrera 50, Barranquilla',
      'Calle 54, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 40, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 17, Barranquilla',
      'Boulevard Simón Bolívar, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 30, Barranquilla',
      'Arboleda, Soledad',
      'Carrera 30, Soledad',
      'Calle 45, Soledad',
      'Carrera 24, Soledad',
      'Ciudad del Puerto, Soledad',
      'Carrera 14, Soledad',
      'Carrera 11, Soledad',
      'Nevada Granabastos, Soledad',
    ],
    idaTexto: 'Nevada Granabastos → Av. Murillo → Manuela Beltrán → Calle 37 → Cra 11 → Calle 43 → Cra 14 → Ciudad del Puerto → Cra 24 → Calle 45 → Arboleda → Cra 30 → Calle 30 → Av. Circunvalar → Blvd. Simón Bolívar → Calle 17 → Cra 38 → Calle 30 → Cra 45 → Calle 53 → Cra 54 → Calle 58 → Cra 66 → Calle 68 → Cra 62 → Calle 77 → Vía 40 → Calle 80 → Calle 85 → Cra 64 → Calle 90',
    regresoTexto: 'Calle 90 → Cra 49C → Calle 75 → Cra 52 → Calle 70 → Cra 47 → Cra 50 → Calle 54 → Cra 44 → Calle 40 → Cra 38 → Calle 17 → Blvd. Simón Bolívar → Av. Circunvalar → Calle 30 → Arboleda → Cra 30 → Calle 45 → Cra 24 → Ciudad del Puerto → Cra 14 → Cra 11 → Nevada Granabastos',
  },
  {
    operador: 'Transmetro',
    nombre: 'R1 Joe Arroyo → S1 Portal de Soledad',
    codigo: 'R1/S1',
    origen: 'Estación Joe Arroyo (Calle 17)',
    destino: 'Portal de Soledad',
    barrios: ['Barlovento', 'Centro', 'Rebolo', 'San Roque', 'Barrio Abajo', 'La Concepción', 'Modelo', 'El Golf', 'Zona Norte', 'Soledad'],
    tieneParadas: true,
    ida: [
      'Estación Joe Arroyo, Barranquilla',
      'Calle 17, Barranquilla',
      'Paseo Bolívar, Barranquilla',
      'Calle 30, Barranquilla',
      'Carrera 46, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 58, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 46 Troncal, Barranquilla',
      'Portal de Soledad, Soledad',
    ],
    regreso: [
      'Portal de Soledad, Soledad',
      'Carrera 46 Troncal, Barranquilla',
      'Calle 72, Barranquilla',
      'Calle 58, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 46, Barranquilla',
      'Calle 30, Barranquilla',
      'Paseo Bolívar, Barranquilla',
      'Calle 17, Barranquilla',
      'Estación Joe Arroyo, Barranquilla',
    ],
    idaTexto: 'Joe Arroyo → Calle 17 → Paseo Bolívar → Calle 30 → Carrera 46 → Calle 45 → Carrera 54 → Calle 58 → Calle 72 → Carrera 46 (troncal) → Portal de Soledad',
    regresoTexto: 'Portal de Soledad → Carrera 46 (troncal) → Calle 72 → Calle 58 → Carrera 54 → Calle 45 → Carrera 46 → Calle 30 → Paseo Bolívar → Calle 17 → Joe Arroyo',
  },
  {
    operador: 'Transmetro',
    nombre: 'R2 Joe Arroyo ↔ B2 Barranquillita',
    codigo: 'R2/B2',
    origen: 'Barranquillita',
    destino: 'Joe Arroyo (Calle 17)',
    barrios: ['Barranquillita', 'Barlovento', 'Centro', 'Barrio Abajo', 'San Felipe', 'Los Andes', 'Modelo', 'San Francisco', 'Calle 72', 'Calle 80'],
    tieneParadas: true,
    ida: [
      'Barranquillita, Barranquilla',
      'Vía 40, Barranquilla',
      'Paseo Bolívar, Barranquilla',
      'Calle 30, Barranquilla',
      'Carrera 46, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 72, Barranquilla',
      'Calle 80, Barranquilla',
    ],
    regreso: [
      'Calle 80, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 46, Barranquilla',
      'Calle 30, Barranquilla',
      'Paseo Bolívar, Barranquilla',
      'Vía 40, Barranquilla',
      'Barranquillita, Barranquilla',
    ],
    idaTexto: 'Barranquillita → Vía 40 → Paseo Bolívar → Calle 30 → Carrera 46 → Calle 45 → Carrera 54 → Calle 72 → Calle 80',
    regresoTexto: 'Calle 80 → Calle 72 → Carrera 54 → Calle 45 → Carrera 46 → Calle 30 → Paseo Bolívar → Vía 40 → Barranquillita',
  },
  {
    operador: 'Transmetro',
    nombre: 'Alimentadora 1-2 Carrera Ocho',
    codigo: 'A1-2',
    origen: 'Estación Norte / Calle 80',
    destino: 'Carrera 8 / Sur',
    barrios: ['Recreo', 'Las Estrellas', 'Paraíso', 'El Campito', 'La Unión', 'San Roque'],
    tieneParadas: true,
    ida: [
      'Estación Calle 80, Barranquilla',
      'Calle 79, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 72, Barranquilla',
    ],
    regreso: [
      'Calle 72, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 79, Barranquilla',
      'Estación Calle 80, Barranquilla',
    ],
    idaTexto: 'Estación Calle 80 → Calle 79 → Carrera 8 → Calle 72',
    regresoTexto: 'Calle 72 → Carrera 8 → Calle 79 → Calle 80',
  },
  {
    operador: 'Transmetro',
    nombre: 'Alimentadora 3-4 Villa Sol',
    codigo: 'A3-4',
    origen: 'Portal de Soledad',
    destino: 'Villa Sol',
    barrios: ['Soledad', 'Villa Sol', 'Manuela Beltrán', 'La Palma'],
    tieneParadas: true,
    ida: [
      'Portal de Soledad, Soledad',
      'Autopista al Aeropuerto, Soledad',
      'Villa Sol, Soledad',
    ],
    regreso: [
      'Villa Sol, Soledad',
      'Autopista al Aeropuerto, Soledad',
      'Portal de Soledad, Soledad',
    ],
    idaTexto: 'Portal de Soledad → Autopista al Aeropuerto → Villa Sol',
    regresoTexto: 'Villa Sol → Autopista al Aeropuerto → Portal de Soledad',
  },
  {
    operador: 'Transurbar',
    nombre: 'María Modelo Manuela Beltrán',
    codigo: 'A14',
    origen: 'Nevada Villa Estadio (Soledad)',
    destino: 'Vía 40 / Calle 77',
    barrios: ['Villa Estadio', 'Soledad', 'Manuela Beltrán', 'María Auxiliadora', 'El Prado', 'Barlovento', 'Centro', 'La Merced', 'Zona Industrial'],
    ida: [
      'Nevada Villa Estadio, Soledad',
      'Avenida Murillo, Soledad',
      'Autopista al Aeropuerto, Soledad',
      'Calle 30, Barranquilla',
      'Carrera 4, Barranquilla',
      'Calle 38B, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 41, Barranquilla',
      'Carrera 21, Barranquilla',
      'Calle 38, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 30, Barranquilla',
      'Vía 40, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 64, Barranquilla',
      'Carrera 58, Barranquilla',
      'Calle 77, Barranquilla',
    ],
    regreso: [
      'Calle 77, Barranquilla',
      'Carrera 58, Barranquilla',
      'Calle 64, Barranquilla',
      'Carrera 54, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 30, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 38, Barranquilla',
      'Carrera 21, Barranquilla',
      'Calle 41, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 38B, Barranquilla',
      'Carrera 4, Barranquilla',
      'Calle 30, Barranquilla',
      'Autopista al Aeropuerto, Soledad',
      'Avenida Murillo, Soledad',
      'Nevada Villa Estadio, Soledad',
    ],
    idaTexto: 'Nevada Villa Estadio → Av. Murillo → Autopista → Calle 30 → Cra 4 → Calle 38B → Cra 8 → Calle 41 → Cra 21 → Calle 38 → Cra 44 → Calle 30 → Vía 40 → Cra 54 → Calle 64 → Cra 58 → Calle 77',
    regresoTexto: 'Calle 77 → Cra 58 → Calle 64 → Cra 54 → Vía 40 → Calle 30 → Cra 44 → Calle 38 → Cra 21 → Calle 41 → Cra 8 → Calle 38B → Cra 4 → Calle 30 → Autopista → Av. Murillo → Nevada Villa Estadio',
  },
  {
    operador: 'Lucero San Felipe',
    nombre: 'Galapa Calle 72',
    codigo: 'E7',
    origen: 'Galapa (Municipio)',
    destino: 'Calle 72 / Vía 40',
    barrios: ['Galapa', 'Autopista', 'Villa Campestre', 'Las Granjas', 'Cordialidad', 'Barrio Abajo', 'Calle 72'],
    ida: [
      'Galapa, Galapa',
      'Autopista al Aeropuerto, Galapa',
      'Avenida Murillo, Barranquilla',
      'Avenida Cordialidad, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 72, Barranquilla',
      'Vía 40, Barranquilla',
    ],
    regreso: [
      'Vía 40, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 38, Barranquilla',
      'Avenida Cordialidad, Barranquilla',
      'Avenida Murillo, Barranquilla',
      'Autopista al Aeropuerto, Galapa',
      'Galapa, Galapa',
    ],
    idaTexto: 'Galapa → Autopista al Aeropuerto → Av. Murillo → Cordialidad → Carrera 38 → Calle 72 → Vía 40',
    regresoTexto: 'Vía 40 → Calle 72 → Carrera 38 → Cordialidad → Av. Murillo → Autopista al Aeropuerto → Galapa',
  },
  {
    operador: 'Lucero San Felipe',
    nombre: 'Circunvalar Buenavista (Malvinas)',
    codigo: 'B17M',
    origen: 'Malvinas',
    destino: 'Buenavista / Circunvalar',
    barrios: ['Malvinas', 'Las Nieves', 'Centro', 'Barrio Abajo', 'Calle 72', 'La Castellana', 'Buenavista'],
    ida: [
      'Malvinas, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 72, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Buenavista, Barranquilla',
    ],
    regreso: [
      'Buenavista, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 45, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Malvinas, Barranquilla',
    ],
    idaTexto: 'Malvinas → Av. Circunvalar baja → Calle 45 → Carrera 44 → Calle 72 → Av. Circunvalar → Buenavista',
    regresoTexto: 'Buenavista → Av. Circunvalar → Calle 72 → Carrera 44 → Calle 45 → Av. Circunvalar baja → Malvinas',
  },
  {
    operador: 'Sodis',
    nombre: 'Circunvalar Calle 84',
    codigo: 'B18',
    origen: 'Centro / Calle 17',
    destino: 'Calle 84 / Circunvalar Alta',
    barrios: ['Centro', 'Barlovento', 'Los Andes', 'San Felipe', 'Calle 72', 'La Castellana', 'Los Alpes', 'Calle 80', 'Calle 84'],
    ida: [
      'Calle 17, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 45, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 72, Barranquilla',
      'Carrera 65, Barranquilla',
      'Calle 80, Barranquilla',
      'Calle 84, Barranquilla',
    ],
    regreso: [
      'Calle 84, Barranquilla',
      'Calle 80, Barranquilla',
      'Carrera 65, Barranquilla',
      'Calle 72, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 17, Barranquilla',
    ],
    idaTexto: 'Calle 17 → Carrera 44 → Calle 45 → Av. Circunvalar → Calle 72 → Carrera 65 → Calle 80 → Calle 84',
    regresoTexto: 'Calle 84 → Calle 80 → Carrera 65 → Calle 72 → Av. Circunvalar → Calle 45 → Carrera 44 → Calle 17',
  },
  {
    operador: 'Sodis',
    nombre: 'La Paz C-53',
    codigo: 'C53',
    origen: 'La Paz (Soledad/Sur)',
    destino: 'Calle 53 / Norte de Barranquilla',
    barrios: ['La Paz', 'Soledad', 'Las Palmas', 'Cevillar', 'La Victoria', 'Loma Fresca', 'Los Andes', 'Olaya'],
    ida: [
      'La Paz, Soledad',
      'Avenida Murillo, Soledad',
      'Calle 30, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 53, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 58, Barranquilla',
    ],
    regreso: [
      'Calle 58, Barranquilla',
      'Carrera 54, Barranquilla',
      'Calle 53, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 30, Barranquilla',
      'Avenida Murillo, Soledad',
      'La Paz, Soledad',
    ],
    idaTexto: 'La Paz → Av. Murillo → Calle 30 → Carrera 38 → Calle 53 → Carrera 54 → Calle 58',
    regresoTexto: 'Calle 58 → Carrera 54 → Calle 53 → Carrera 38 → Calle 30 → Av. Murillo → La Paz',
  },
  {
    operador: 'Transmecar',
    nombre: 'Caracolí',
    codigo: 'D10',
    origen: 'Barranquilla Sur/Centro',
    destino: 'Caracolí',
    barrios: ['Centro', 'Las Nieves', 'Barrio Abajo', 'La Victoria', 'Cevillar', 'Caracolí'],
    ida: [
      'Centro, Barranquilla',
      'Calle 30, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 36B, Barranquilla',
      'Carrera 14, Barranquilla',
      'Calle 45, Barranquilla',
      'Caracolí, Barranquilla',
    ],
    regreso: [
      'Caracolí, Barranquilla',
      'Calle 45, Barranquilla',
      'Carrera 14, Barranquilla',
      'Calle 36B, Barranquilla',
      'Carrera 8, Barranquilla',
      'Calle 30, Barranquilla',
      'Centro, Barranquilla',
    ],
    idaTexto: 'Centro → Calle 30 → Carrera 8 → Calle 36B → Carrera 14 → Calle 45 → Caracolí',
    regresoTexto: 'Caracolí → Calle 45 → Carrera 14 → Calle 36B → Carrera 8 → Calle 30 → Centro',
  },
  {
    operador: 'Cootrasol',
    nombre: 'Arboleda Normandía',
    codigo: 'D6',
    origen: 'La Arboleda (Soledad)',
    destino: 'Normandía / Norte',
    barrios: ['Arboleda', 'Soledad', 'Ciudad del Puerto', 'Centro', 'Calle 72', 'La Castellana', 'Normandía'],
    ida: [
      'Arboleda, Soledad',
      'Carrera 30, Soledad',
      'Calle 30, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 72, Barranquilla',
      'Normandía, Barranquilla',
    ],
    regreso: [
      'Normandía, Barranquilla',
      'Calle 72, Barranquilla',
      'Avenida Circunvalar, Barranquilla',
      'Calle 30, Barranquilla',
      'Carrera 30, Soledad',
      'Arboleda, Soledad',
    ],
    idaTexto: 'Arboleda → Carrera 30 → Calle 30 → Av. Circunvalar → Calle 72 → Normandía',
    regresoTexto: 'Normandía → Calle 72 → Av. Circunvalar → Calle 30 → Carrera 30 → Arboleda',
  },
  {
    operador: 'Cootrasol',
    nombre: 'Hipódromo',
    codigo: 'D7',
    origen: 'Hipódromo (Soledad)',
    destino: 'Norte Barranquilla',
    barrios: ['Hipódromo', 'Soledad', 'Las Palmas', 'Cevillar', 'Loma Fresca', 'Centro', 'Zona Industrial', 'Calle 72'],
    ida: [
      'Hipódromo, Soledad',
      'Carrera 14, Soledad',
      'Calle 54, Soledad',
      'Avenida Murillo, Soledad',
      'Calle 30, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 72, Barranquilla',
    ],
    regreso: [
      'Calle 72, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 30, Barranquilla',
      'Avenida Murillo, Soledad',
      'Calle 54, Soledad',
      'Carrera 14, Soledad',
      'Hipódromo, Soledad',
    ],
    idaTexto: 'Hipódromo → Carrera 14 → Calle 54 → Av. Murillo → Calle 30 → Vía 40 → Calle 72 → Norte',
    regresoTexto: 'Norte → Calle 72 → Vía 40 → Calle 30 → Av. Murillo → Calle 54 → Carrera 14 → Hipódromo',
  },
  {
    operador: 'La Carolina',
    nombre: 'Miramar Alameda del Río',
    codigo: 'D5',
    origen: 'Ciudadela Miramar (Soledad)',
    destino: 'Alameda del Río (Norte)',
    barrios: ['Ciudadela Miramar', 'Soledad', 'Centro', 'Barlovento', 'Zona Industrial', 'La Concepción', 'El Recreo', 'Alameda del Río'],
    ida: [
      'Ciudadela Miramar, Soledad',
      'Avenida Murillo, Soledad',
      'Calle 30, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 76, Barranquilla',
      'Carrera 58, Barranquilla',
      'Calle 80, Barranquilla',
      'Alameda del Río, Barranquilla',
    ],
    regreso: [
      'Alameda del Río, Barranquilla',
      'Calle 80, Barranquilla',
      'Carrera 58, Barranquilla',
      'Calle 76, Barranquilla',
      'Vía 40, Barranquilla',
      'Calle 30, Barranquilla',
      'Avenida Murillo, Soledad',
      'Ciudadela Miramar, Soledad',
    ],
    idaTexto: 'Ciudadela Miramar → Av. Murillo → Calle 30 → Vía 40 → Calle 76 → Carrera 58 → Calle 80 → Alameda del Río',
    regresoTexto: 'Alameda del Río → Calle 80 → Carrera 58 → Calle 76 → Vía 40 → Calle 30 → Av. Murillo → Ciudadela Miramar',
  },
  {
    operador: 'Monterrey',
    nombre: 'Bosque Aduanilla Cordialidad',
    codigo: 'E1',
    origen: 'El Bosque',
    destino: 'Aduanilla / Cordialidad / Norte',
    barrios: ['El Bosque', 'Centro', 'Barlovento', 'Aduanilla', 'Cordialidad', 'San Felipe', 'Barrio Abajo', 'Calle 72'],
    ida: [
      'El Bosque, Barranquilla',
      'Calle 30, Barranquilla',
      'Carrera 44, Barranquilla',
      'Aduanilla, Barranquilla',
      'Avenida Cordialidad, Barranquilla',
      'Carrera 38, Barranquilla',
      'Calle 72, Barranquilla',
    ],
    regreso: [
      'Calle 72, Barranquilla',
      'Carrera 38, Barranquilla',
      'Avenida Cordialidad, Barranquilla',
      'Aduanilla, Barranquilla',
      'Carrera 44, Barranquilla',
      'Calle 30, Barranquilla',
      'El Bosque, Barranquilla',
    ],
    idaTexto: 'El Bosque → Calle 30 → Carrera 44 → Aduanilla → Cordialidad → Carrera 38 → Calle 72 → Norte',
    regresoTexto: 'Norte → Calle 72 → Carrera 38 → Cordialidad → Aduanilla → Carrera 44 → Calle 30 → El Bosque',
  },
];

// ---- GEOCODIFICACIÓN ----

async function geocodeLocation(locationStr) {
  const url = `https://nominatim.openstreetmap.org/search`;
  try {
    const res = await axios.get(url, {
      params: {
        q: locationStr,
        format: 'json',
        limit: 1,
        countrycodes: 'co',
        viewbox: '-75.05,11.15,-74.65,10.85',
        bounded: 1,
      },
      headers: { 'User-Agent': 'RutaQuilla/1.0' },
      timeout: 10000,
    });
    if (res.data && res.data.length > 0) {
      return [parseFloat(res.data[0].lon), parseFloat(res.data[0].lat)];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getOSRMRoute(coords) {
  if (coords.length < 2) return coords;
  const waypointsStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
  const url = `http://router.project-osrm.org/route/v1/driving/${waypointsStr}?overview=full&geometries=geojson`;
  try {
    const res = await axios.get(url, { timeout: 15000 });
    if (res.data && res.data.routes && res.data.routes.length > 0) {
      return res.data.routes[0].geometry.coordinates;
    }
    return coords;
  } catch (e) {
    return coords;
  }
}

async function processRoute(ruta) {
  console.log(`  Geocodificando IDA (${ruta.ida.length} waypoints)...`);
  const idaCoords = [];
  for (const wp of ruta.ida) {
    await delay(1100); // Nominatim: max 1 req/sec
    const coord = await geocodeLocation(wp);
    if (coord) {
      idaCoords.push(coord);
      process.stdout.write('.');
    } else {
      process.stdout.write('x');
    }
  }
  console.log(` ${idaCoords.length}/${ruta.ida.length} geocodificados`);

  console.log(`  Geocodificando REGRESO (${ruta.regreso.length} waypoints)...`);
  const regresoCoords = [];
  for (const wp of ruta.regreso) {
    await delay(1100);
    const coord = await geocodeLocation(wp);
    if (coord) {
      regresoCoords.push(coord);
      process.stdout.write('.');
    } else {
      process.stdout.write('x');
    }
  }
  console.log(` ${regresoCoords.length}/${ruta.regreso.length} geocodificados`);

  // Trazar ruta vial con OSRM
  let idaGeometry = idaCoords;
  let regresoGeometry = regresoCoords;

  if (idaCoords.length >= 2) {
    console.log(`  Trazando ruta vial IDA con OSRM...`);
    await delay(500);
    idaGeometry = await getOSRMRoute(idaCoords);
    console.log(`  → ${idaGeometry.length} puntos en polilínea`);
  }

  if (regresoCoords.length >= 2) {
    console.log(`  Trazando ruta vial REGRESO con OSRM...`);
    await delay(500);
    regresoGeometry = await getOSRMRoute(regresoCoords);
    console.log(`  → ${regresoGeometry.length} puntos en polilínea`);
  }

  // Fallback mínimo
  if (idaGeometry.length < 2) idaGeometry = [[-74.802, 10.999], [-74.792, 10.989]];
  if (regresoGeometry.length < 2) regresoGeometry = [[-74.792, 10.989], [-74.802, 10.999]];

  const trazadoIncompleto = (idaCoords.length < 2 || regresoCoords.length < 2);

  return {
    nombre: ruta.nombre,
    codigo: ruta.codigo,
    operador: ruta.operador,
    origen: ruta.origen,
    destino: ruta.destino,
    barriosCubiertos: ruta.barrios,
    recorridoTextual: {
      ida: ruta.idaTexto,
      regreso: ruta.regresoTexto,
    },
    color: COLORES[ruta.operador] || '#6B7280',
    tieneParadas: ruta.tieneParadas || false,
    geometriaOSM: false,
    type: 'official',
    ida: {
      puntoPartida: {
        nombre: ruta.origen,
        coordenadas: { type: 'Point', coordinates: idaGeometry[0] },
      },
      puntoFinal: {
        nombre: ruta.destino,
        coordenadas: { type: 'Point', coordinates: idaGeometry[idaGeometry.length - 1] },
      },
      trazado: { type: 'LineString', coordinates: idaGeometry },
    },
    regreso: {
      puntoPartida: {
        nombre: ruta.destino,
        coordenadas: { type: 'Point', coordinates: regresoGeometry[0] },
      },
      puntoFinal: {
        nombre: ruta.origen,
        coordenadas: { type: 'Point', coordinates: regresoGeometry[regresoGeometry.length - 1] },
      },
      trazado: { type: 'LineString', coordinates: regresoGeometry },
    },
    activa: true,
    trazadoIncompleto,
    audit: {
      revisadoManualmente: false,
      observaciones: trazadoIncompleto ? 'Geocodificación parcial — requiere revisión' : 'Geocodificado desde análisis oficial v5',
    },
    fuente: 'geocoded',
  };
}

// ---- MAIN ----
async function main() {
  console.log('==============================================');
  console.log(' RutaQuilla v5 — Geocodificación de Rutas');
  console.log('==============================================');
  console.log(`Total rutas a procesar: ${RUTAS_DETALLADAS.length}\n`);

  const results = [];
  let ok = 0;
  let parcial = 0;

  for (let i = 0; i < RUTAS_DETALLADAS.length; i++) {
    const ruta = RUTAS_DETALLADAS[i];
    console.log(`\n[${i+1}/${RUTAS_DETALLADAS.length}] ${ruta.operador} — ${ruta.nombre} (${ruta.codigo})`);
    const processed = await processRoute(ruta);
    results.push(processed);
    if (processed.trazadoIncompleto) {
      parcial++;
    } else {
      ok++;
    }
  }

  // Escribir resultado
  const outPath = path.join(__dirname, 'routes_v5.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log('\n==============================================');
  console.log(' REPORTE FINAL');
  console.log('==============================================');
  console.log(`Rutas procesadas: ${results.length}`);
  console.log(`Completas: ${ok}`);
  console.log(`Parciales: ${parcial}`);
  console.log(`Archivo: ${outPath}`);
  console.log('==============================================\n');
}

main();
