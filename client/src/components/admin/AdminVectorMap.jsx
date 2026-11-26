/**
 * ============================================
 * RutaQuilla - AdminVectorMap (MapLibre GL JS + OpenFreeMap)
 * ============================================
 *
 * Componente compartido para los mapas del panel Admin (Editor de Rutas,
 * Capturas GPS y Rutas Colaborativas), usando exactamente los mismos
 * tiles vectoriales OpenFreeMap (fiord / liberty) de la app principal.
 */

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, Compass, Crosshair } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { safeColor, escapeHtml } from '../../utils/sanitize';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const BARRANQUILLA_CENTER = [-74.7813, 10.9685]; // [lng, lat]
const DEFAULT_ZOOM = 12.8;

const STYLE_DARK = 'https://tiles.openfreemap.org/styles/fiord';
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';

const SRC_LINES = 'rq-admin-lines';
const LYR_LINES_CASING = 'rq-admin-lines-casing';
const LYR_LINES_MAIN = 'rq-admin-lines-main';
const LYR_LINES_DASHED = 'rq-admin-lines-dashed';
const LYR_LINES_ARROWS = 'rq-admin-lines-arrows';

const SRC_ENDPOINTS = 'rq-admin-endpoints';
const LYR_ENDPOINTS_CIRCLE = 'rq-admin-endpoints-circle';

function emptyFC() {
  return { type: 'FeatureCollection', features: [] };
}

function buildLinesFC(polylines = []) {
  const features = [];
  for (let i = 0; i < polylines.length; i++) {
    const line = polylines[i];
    const coords = (line?.coordinates || []).filter(
      (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))
    );
    if (coords.length < 2) continue;
    features.push({
      type: 'Feature',
      properties: {
        id: String(line.id || `line-${i}`),
        color: safeColor(line.color, '#FFC21A'),
        width: Number(line.width) || 4,
        opacity: Number.isFinite(Number(line.opacity)) ? Number(line.opacity) : 0.92,
        dashed: Boolean(line.dashed),
        showArrows: line.showArrows !== false,
        label: line.label ? String(line.label) : '',
      },
      geometry: {
        type: 'LineString',
        coordinates: coords.map((c) => [Number(c[0]), Number(c[1])]),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildEndpointsFC(endpoints = []) {
  const features = [];
  for (let i = 0; i < endpoints.length; i++) {
    const pt = endpoints[i];
    const lng = Number(pt?.lng);
    const lat = Number(pt?.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    features.push({
      type: 'Feature',
      properties: {
        color: safeColor(pt.color, '#1F9D6B'),
        label: pt.label ? String(pt.label) : '',
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function ensureAdminLayers(map, isDark) {
  if (!map.getSource(SRC_LINES)) {
    map.addSource(SRC_LINES, { type: 'geojson', data: emptyFC() });
  }
  if (!map.getSource(SRC_ENDPOINTS)) {
    map.addSource(SRC_ENDPOINTS, { type: 'geojson', data: emptyFC() });
  }

  const casingColor = isDark ? '#0B0F14' : '#FFFFFF';

  if (!map.getLayer(LYR_LINES_CASING)) {
    map.addLayer({
      id: LYR_LINES_CASING,
      type: 'line',
      source: SRC_LINES,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': casingColor,
        'line-width': ['+', ['get', 'width'], 3],
        'line-opacity': ['*', ['get', 'opacity'], 0.72],
      },
    });
  } else {
    map.setPaintProperty(LYR_LINES_CASING, 'line-color', casingColor);
  }

  if (!map.getLayer(LYR_LINES_MAIN)) {
    map.addLayer({
      id: LYR_LINES_MAIN,
      type: 'line',
      source: SRC_LINES,
      filter: ['!=', ['get', 'dashed'], true],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      },
    });
  }

  if (!map.getLayer(LYR_LINES_DASHED)) {
    map.addLayer({
      id: LYR_LINES_DASHED,
      type: 'line',
      source: SRC_LINES,
      filter: ['==', ['get', 'dashed'], true],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
        'line-dasharray': [2.2, 1.6],
      },
    });
  }

  if (!map.getLayer(LYR_LINES_ARROWS)) {
    map.addLayer({
      id: LYR_LINES_ARROWS,
      type: 'symbol',
      source: SRC_LINES,
      filter: ['==', ['get', 'showArrows'], true],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 95,
        'text-field': '▶',
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-keep-upright': false,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': casingColor,
        'text-halo-width': 1.5,
      },
    });
  }

  if (!map.getLayer(LYR_ENDPOINTS_CIRCLE)) {
    map.addLayer({
      id: LYR_ENDPOINTS_CIRCLE,
      type: 'circle',
      source: SRC_ENDPOINTS,
      paint: {
        'circle-radius': 7,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#FFFFFF',
      },
    });
  }
}

export default function AdminVectorMap({
  polylines = [],
  endpoints = [],
  editablePoints = [],
  editableColor = '#1F9D6B',
  onPointDrag,
  onPointRemove,
  interactiveClick = false,
  onMapClick,
  fitCoordinates = [],
  fitTrigger = 0,
  resizeKey = '',
}) {
  const { isDark } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const styleReadyRef = useRef(false);
  const appliedStyleRef = useRef(isDark ? STYLE_DARK : STYLE_LIGHT);
  const markersRef = useRef([]);
  const popupRef = useRef(null);

  const [is3D, setIs3D] = useState(false);

  // Refs para callbacks recientes sin re-instanciar el mapa
  const onMapClickRef = useRef(onMapClick);
  const interactiveClickRef = useRef(interactiveClick);
  const polylinesRef = useRef(polylines);
  const endpointsRef = useRef(endpoints);
  const isDarkRef = useRef(isDark);

  onMapClickRef.current = onMapClick;
  interactiveClickRef.current = interactiveClick;
  polylinesRef.current = polylines;
  endpointsRef.current = endpoints;
  isDarkRef.current = isDark;

  const syncVectorData = () => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    try {
      ensureAdminLayers(map, isDarkRef.current);
      const lineSrc = map.getSource(SRC_LINES);
      if (lineSrc) lineSrc.setData(buildLinesFC(polylinesRef.current));
      const ptSrc = map.getSource(SRC_ENDPOINTS);
      if (ptSrc) ptSrc.setData(buildEndpointsFC(endpointsRef.current));
    } catch (err) {
      console.warn('AdminVectorMap sync warning:', err);
    }
  };

  // Inicializar mapa MapLibre GL
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialStyle = isDark ? STYLE_DARK : STYLE_LIGHT;
    appliedStyleRef.current = initialStyle;

    const map = new maplibregl.Map({
      container,
      style: initialStyle,
      center: BARRANQUILLA_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = map;

    const onStyleLoad = () => {
      styleReadyRef.current = true;
      syncVectorData();
    };

    map.on('style.load', onStyleLoad);

    map.on('click', (e) => {
      if (interactiveClickRef.current && onMapClickRef.current) {
        onMapClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        return;
      }

      // Popups informativos sobre líneas o puntos finales cuando no se está dibujando
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LYR_ENDPOINTS_CIRCLE, LYR_LINES_MAIN, LYR_LINES_DASHED].filter((id) =>
          Boolean(map.getLayer(id))
        ),
      });
      if (features.length > 0) {
        const label = features[0].properties?.label;
        if (label) {
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-size:12px;font-weight:600;color:#14171C;padding:2px 4px">${escapeHtml(label)}</div>`
            )
            .addTo(map);
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        map.resize();
      } catch (_) {}
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      styleReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambio dinámico de tema claro/oscuro igual al mapa principal
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyle = isDark ? STYLE_DARK : STYLE_LIGHT;
    if (appliedStyleRef.current !== nextStyle) {
      appliedStyleRef.current = nextStyle;
      styleReadyRef.current = false;
      map.setStyle(nextStyle);
    }
  }, [isDark]);

  // Cursor de dibujo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = interactiveClick ? 'crosshair' : '';
  }, [interactiveClick]);

  // Redimensionar al cambiar vista móvil / modos
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => {
      try {
        map.resize();
      } catch (_) {}
    }, 80);
    return () => clearTimeout(t);
  }, [resizeKey]);

  // Actualizar polilíneas y puntos extremos WebGL
  useEffect(() => {
    syncVectorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polylines, endpoints]);

  // Marcadores numerados arrastrables para edición de trazados
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!Array.isArray(editablePoints) || editablePoints.length === 0) return;

    const badgeColor = safeColor(editableColor, '#1F9D6B');
    editablePoints.forEach((pt, idx) => {
      const lat = Number(pt?.lat);
      const lng = Number(pt?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const el = document.createElement('div');
      el.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${badgeColor};
        border: 2px solid #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
        color: #14171C;
        box-shadow: 0 2px 8px rgba(0,0,0,0.42);
        font-family: var(--font-mono);
        cursor: grab;
        user-select: none;
      `;
      el.textContent = String(idx + 1);
      el.title = `Punto ${idx + 1} · Arrastra para mover${onPointRemove ? ' · Clic derecho para quitar' : ''}`;

      el.addEventListener('contextmenu', (ev) => {
        if (!onPointRemove) return;
        ev.preventDefault();
        ev.stopPropagation();
        onPointRemove(idx);
      });

      const marker = new maplibregl.Marker({ element: el, draggable: Boolean(onPointDrag) })
        .setLngLat([lng, lat])
        .addTo(map);

      if (onPointDrag) {
        marker.on('dragend', () => {
          const ll = marker.getLngLat();
          onPointDrag(idx, { lat: ll.lat, lng: ll.lng });
        });
      }

      markersRef.current.push(marker);
    });
  }, [editablePoints, editableColor, onPointDrag, onPointRemove]);

  // Ajustar encuadre cuando fitTrigger cambie
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitTrigger) return;
    const valid = (fitCoordinates || []).filter(
      (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))
    );
    if (valid.length === 0) return;

    const t = setTimeout(() => {
      try {
        map.resize();
        if (valid.length === 1) {
          map.flyTo({ center: [Number(valid[0][0]), Number(valid[0][1])], zoom: 15, duration: 500 });
          return;
        }
        const bounds = new maplibregl.LngLatBounds(
          [Number(valid[0][0]), Number(valid[0][1])],
          [Number(valid[0][0]), Number(valid[0][1])]
        );
        valid.forEach((c) => bounds.extend([Number(c[0]), Number(c[1])]));
        map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 550 });
      } catch (_) {}
    }, 100);
    return () => clearTimeout(t);
  }, [fitTrigger, fitCoordinates]);

  const handleToggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    map.easeTo({ pitch: next ? 45 : 0, duration: 350 });
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Controles flotantes estilo RutaQuilla */}
      <div
        className="flex flex-col gap-1.5"
        style={{ position: 'absolute', bottom: 14, right: 12, zIndex: 20 }}
      >
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn({ duration: 220 })}
          className="rq-icon-btn"
          style={{ width: 34, height: 34 }}
          title="Acercar"
          aria-label="Acercar"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut({ duration: 220 })}
          className="rq-icon-btn"
          style={{ width: 34, height: 34 }}
          title="Alejar"
          aria-label="Alejar"
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          onClick={handleToggle3D}
          className="rq-icon-btn font-mono text-[10px] font-bold"
          style={{
            width: 34,
            height: 34,
            background: is3D ? 'var(--brand)' : undefined,
            color: is3D ? '#14171C' : undefined,
          }}
          title="Alternar vista 3D"
          aria-label="Alternar vista 3D"
        >
          {is3D ? '2D' : '3D'}
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.flyTo({ center: BARRANQUILLA_CENTER, zoom: DEFAULT_ZOOM, pitch: 0, bearing: 0, duration: 450 })}
          className="rq-icon-btn"
          style={{ width: 34, height: 34 }}
          title="Centrar en Barranquilla"
          aria-label="Centrar en Barranquilla"
        >
          <Crosshair size={14} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.easeTo({ bearing: 0, duration: 300 })}
          className="rq-icon-btn"
          style={{ width: 34, height: 34 }}
          title="Orientar al norte"
          aria-label="Orientar al norte"
        >
          <Compass size={14} />
        </button>
      </div>
    </div>
  );
}
