/**
 * ============================================
 * RutaQuilla - MapComponent v4 (MapLibre GL JS + OpenFreeMap)
 * ============================================
 *
 * Motor de mapa vectorial WebGL 60fps:
 * - Tiles vectoriales OpenFreeMap (100% gratis, sin API key)
 * - Modo oscuro (fiord) y claro (liberty) nativos
 * - Edificios 3D / inclinación interactiva
 * - Capas WebGL para rutas con flechas direccionales SDF
 * - POIs y nombres de calles nativos en WebGL (sin Overpass spam)
 * - Marcadores DOM seguros (escapados contra XSS)
 */

import { useEffect, useRef, useState, useCallback, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Crosshair,
  MapPin,
  Plus,
  Minus,
  Compass,
  Layers,
  BusFront,
  Utensils,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
  Trees,
  Landmark,
  Banknote,
  BedDouble,
  X,
  Loader2,
  PanelLeftOpen,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CURATED_MAP_POIS } from '../data/barranquillaPlaces';
import {
  POI_CATEGORIES,
  POI_CHIP_ORDER,
  POI_LAYER_IDS,
  NATIVE_STYLE_POI_LAYERS,
  buildPoiLayers,
  buildCuratedPoisGeoJSON,
  createPoiIconImages,
  getPoiCategory,
  getCategoryMeta,
} from '../map/poiLayers';
import { getWalkingRoute, getMultiStopRoute } from '../services/routingService';
import { escapeHtml, safeColor } from '../utils/sanitize';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const BARRANQUILLA_CENTER = [-74.7813, 10.9685]; // [lng, lat]
const DEFAULT_ZOOM = 12.8;

const ICON_COMPONENTS = {
  BusFront,
  Utensils,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
  Trees,
  Landmark,
  Banknote,
  BedDouble,
  MapPin,
  Layers,
};

const POI_ICON_SVGS = Object.fromEntries(
  Object.entries(POI_CATEGORIES).map(([id, meta]) => {
    const Comp = ICON_COMPONENTS[meta.icon] || MapPin;
    return [id, renderToStaticMarkup(createElement(Comp, { size: 24, color: '#FFFFFF', strokeWidth: 2.25 }))];
  })
);

const CURATED_POIS_GEOJSON = buildCuratedPoisGeoJSON(CURATED_MAP_POIS);

const STYLE_DARK = 'https://tiles.openfreemap.org/styles/fiord';
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';

function emptyFC() {
  return { type: 'FeatureCollection', features: [] };
}

function lineFC(coordsList, props = {}) {
  const valid = (coordsList || []).filter((c) => Array.isArray(c) && c.length >= 2);
  if (valid.length === 0) return emptyFC();
  return {
    type: 'FeatureCollection',
    features: valid.map((coords) => ({
      type: 'Feature',
      properties: props,
      geometry: { type: 'LineString', coordinates: coords },
    })),
  };
}

/**
 * Generates a 48-point geodesic circle GeoJSON polygon for GPS accuracy display.
 */
function createCircleGeoJSON(lng, lat, radiusMeters = 30, steps = 48) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return emptyFC();
  const safeRadius = Math.max(5, Math.min(Number(radiusMeters) || 30, 2000));
  const coords = [];
  const earthRadius = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const d = safeRadius / earthRadius;

  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps;
    const pLat = Math.asin(
      Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(brng)
    );
    const pLng =
      lngRad +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(latRad),
        Math.cos(d) - Math.sin(latRad) * Math.sin(pLat)
      );
    coords.push([(pLng * 180) / Math.PI, (pLat * 180) / Math.PI]);
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      },
    ],
  };
}

/**
 * Generates a crisp white SDF chevron arrow pointing right (+X) for line directionality.
 */
function createArrowImageData() {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 5);
  ctx.lineTo(17, 12);
  ctx.lineTo(8, 19);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

// ---- Safe DOM Marker Factories ----

function createOriginElement(showLabel = true) {
  const el = document.createElement('div');
  const pill = showLabel
    ? `<div class="rq-map-pill" style="position:absolute;bottom:calc(100% + 5px);left:50%;transform:translateX(-50%);color:#1F9D6B;">Origen</div>`
    : '';
  el.innerHTML = `<div style="position:relative;animation:marker-drop 0.25s cubic-bezier(0.2,0,0,1) forwards;">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:22px;height:22px;border:1.5px solid rgba(31,157,107,0.42);border-radius:50%;animation:origin-pulse-1 2.2s ease-out infinite;"></div>
    <div style="width:13px;height:13px;background:#1F9D6B;border:2.5px solid #FFFFFF;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.34);"></div>
    ${pill}
  </div>`;
  return el;
}

function createDestinationElement(showLabel = true) {
  const el = document.createElement('div');
  const pill = showLabel
    ? `<div class="rq-map-pill" style="position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);color:#E5484D;">Destino</div>`
    : '';
  el.innerHTML = `<div style="position:relative;animation:marker-drop 0.25s cubic-bezier(0.2,0,0,1) forwards;">
    <div style="width:14px;height:14px;background:#E5484D;border:2.5px solid #FFFFFF;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.34);display:flex;align-items:center;justify-content:center;transform:rotate(45deg);">
      <div style="width:4px;height:4px;background:#FFFFFF;border-radius:50%;transform:rotate(-45deg);"></div>
    </div>
    ${pill}
  </div>`;
  return el;
}

function createBoardAlightElement(color, label, { position = 'top', compact = false, hideLabel = false } = {}) {
  const safeBg = safeColor(color, '#FFC21A');
  const safeLabel = escapeHtml(label);
  const size = compact ? 10 : 12;
  const posCss = position === 'bottom' ? 'top:calc(100% + 5px);' : 'bottom:calc(100% + 5px);';
  const pill = hideLabel
    ? ''
    : `<div class="rq-map-pill" style="position:absolute;${posCss}left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:${safeBg};flex-shrink:0;"></span><span>${safeLabel}</span></div>`;
  const el = document.createElement('div');
  el.innerHTML = `<div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">
    <div style="width:${size}px;height:${size}px;border-radius:50%;background:${safeBg};border:2.5px solid #FFFFFF;box-shadow:0 0 0 2px rgba(20,23,28,0.16),0 2px 6px rgba(0,0,0,0.32);"></div>
    ${pill}
  </div>`;
  return el;
}

function createWalkCalloutElement(walkMeters, walkMinutes) {
  const el = document.createElement('div');
  el.style.pointerEvents = 'none';
  const m = escapeHtml(Math.round(walkMeters));
  const min = escapeHtml(Math.max(1, Math.round(walkMinutes || Math.ceil(walkMeters / 80))));
  el.innerHTML = `<div class="rq-walk-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg><span>Camina ${m} m · ${min} min</span></div>`;
  return el;
}

function getPolylineMidpoint(coordsLatLng) {
  if (!Array.isArray(coordsLatLng) || coordsLatLng.length < 2) return null;
  if (coordsLatLng.length === 2) {
    return [
      (coordsLatLng[0][1] + coordsLatLng[1][1]) / 2,
      (coordsLatLng[0][0] + coordsLatLng[1][0]) / 2,
    ];
  }
  const midIdx = Math.floor(coordsLatLng.length / 2);
  return [coordsLatLng[midIdx][1], coordsLatLng[midIdx][0]];
}

function createUserElement() {
  const el = document.createElement('div');
  el.innerHTML = `<div style="position:relative;">
    <div style="position:absolute;top:-6px;left:-6px;width:28px;height:28px;border:1.5px solid rgba(59,139,240,0.35);border-radius:50%;animation:origin-pulse-1 2.4s ease-out infinite;"></div>
    <div style="width:16px;height:16px;background:#3B8BF0;border:2.5px solid #FFFFFF;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>
    <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);white-space:nowrap;font-family:var(--font-mono);font-size:9px;font-weight:700;background:#14171C;color:#F2EFE8;padding:1px 5px;border-radius:4px;border:1px solid rgba(59,139,240,0.45);">TÚ</div>
  </div>`;
  return el;
}

function createSponsorElement(color = '#FFC21A') {
  const safeAccent = safeColor(color, '#FFC21A');
  const el = document.createElement('div');
  el.innerHTML = `<div class="sponsor-marker" style="border-color:${safeAccent};cursor:pointer;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${safeAccent}" stroke-width="2.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  </div>`;
  return el;
}

function createReportElement(report) {
  const badgeColor = safeColor(report?.color, '#FFC21A');
  const badgeEmoji = escapeHtml(report?.emoji || '!');
  const el = document.createElement('div');
  el.innerHTML = `<div style="width:30px;height:30px;border-radius:8px;background:#14171C;border:2px solid ${badgeColor};color:#F2EFE8;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:pointer;">${badgeEmoji}</div>`;
  return el;
}

export default function MapComponent({
  navigationResult,
  selectedRoute,
  loadingRouteId = null,
  focusedStop = null,
  activeOfficialVariant = null,
  onClearSelectedRoute,
  onOpenSidebarRoutes,
  selectedOptionIdx = 0,
  sponsoredLocations = [],
  gpsTrack = [],
  userPosition,
  isCapturing,
  pinMode,
  previewOrigin,
  previewDestination,
  onMapClick,
  onSetOrigin,
  onSetDestination,
  activeReports = [],
  onReportClick,
  isLiveNav = false,
  showTransmetroStops = false,
  onToggleTransmetroStops,
  transmetroStops = [],
  loadingTransmetroStops = false,
  focusedTransmetroStop = null,
  onSelectRouteByCode,
  showRoadSafety = false,
  onToggleRoadSafety,
  roadSafetyPoints = [],
  loadingRoadSafety = false,
}) {
  const { isPremium } = useAuth();
  const { isDark } = useTheme();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersPopoverRef = useRef(null);
  const poiMenuRef = useRef(null);
  const currentStyleRef = useRef(isDark ? STYLE_DARK : STYLE_LIGHT);
  const styleLoadedRef = useRef(false);

  const [is3D, setIs3D] = useState(false);
  const [showPOIs, setShowPOIs] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [poiMenuOpen, setPoiMenuOpen] = useState(false);
  const [poiCategory, setPoiCategory] = useState('all');
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [mapBearing, setMapBearing] = useState(0);
  const [routeDirectionFilter, setRouteDirectionFilter] = useState('all');

  // Refs for fresh closures inside event handlers
  const poiIconsRef = useRef({});
  const poiIconsThemeRef = useRef(null);
  const pinModeRef = useRef(pinMode);
  const onMapClickRef = useRef(onMapClick);
  const onSetOriginRef = useRef(onSetOrigin);
  const onSetDestinationRef = useRef(onSetDestination);
  const onReportClickRef = useRef(onReportClick);
  const onSelectRouteByCodeRef = useRef(onSelectRouteByCode);
  const selectedRouteRef = useRef(selectedRoute);
  const currentOptionRef = useRef(null);
  const openPointCardPopupRef = useRef(null);
  const openTransmetroStopPopupRef = useRef(null);

  pinModeRef.current = pinMode;
  onMapClickRef.current = onMapClick;
  onSetOriginRef.current = onSetOrigin;
  onSetDestinationRef.current = onSetDestination;
  onReportClickRef.current = onReportClick;
  onSelectRouteByCodeRef.current = onSelectRouteByCode;
  selectedRouteRef.current = selectedRoute;

  // Marker refs for cleanup
  const navMarkersRef = useRef([]);
  const reportMarkersRef = useRef([]);
  const sponsorMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const contextPopupRef = useRef(null);
  const infoPopupRef = useRef(null);

  // One-time camera guards
  const hasFlewToUserRef = useRef(false);
  const lastPreviewOriginRef = useRef(null);
  const lastPreviewDestRef = useRef(null);
  const lastFittedRouteIdRef = useRef(null);

  // Walking & bus segment states (stored as [lat, lng] from routingService, converted to [lng, lat] for GeoJSON)
  const [walkToBoard, setWalkToBoard] = useState([]);
  const [walkFromAlight, setWalkFromAlight] = useState([]);
  const [smoothedBusSegment, setSmoothedBusSegment] = useState([]);

  const currentOption = navigationResult?.options?.[selectedOptionIdx];
  currentOptionRef.current = currentOption;

  const navKey = currentOption
    ? `${navigationResult.origin.lat},${navigationResult.origin.lng}-${navigationResult.destination.lat},${navigationResult.destination.lng}-${selectedOptionIdx}`
    : null;

  // ---- Fetch OSRM walking paths for current navigation ----
  useEffect(() => {
    if (!navKey || !currentOption || !navigationResult) {
      setWalkToBoard([]);
      setWalkFromAlight([]);
      return;
    }

    let cancelled = false;
    async function fetchRoutes() {
      try {
        const opt = currentOption;
        const orig = navigationResult.origin;
        const dest = navigationResult.destination;

        const [walkIn, walkOut] = await Promise.all([
          getWalkingRoute(orig.lat, orig.lng, opt.boardPoint.coordinates[1], opt.boardPoint.coordinates[0]),
          getWalkingRoute(opt.alightPoint.coordinates[1], opt.alightPoint.coordinates[0], dest.lat, dest.lng),
        ]);

        if (!cancelled) {
          setWalkToBoard(walkIn.coordinates || []);
          setWalkFromAlight(walkOut.coordinates || []);
        }
      } catch (err) {
        console.error('❌ OSRM walk fetch error:', err);
      }
    }

    fetchRoutes();
    return () => { cancelled = true; };
  }, [navKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Preservar trazado oficial sin re-ruteo OSRM en avenidas ----
  useEffect(() => {
    if (!currentOption?.busSegment || currentOption.busSegment.length < 2) {
      setSmoothedBusSegment([]);
      return;
    }

    let cancelled = false;
    async function matchBusRoute() {
      const rawLatLng = currentOption.busSegment.map((c) => [c[1], c[0]]);
      const isCommunitySparse = currentOption?.route?.type === 'community' && rawLatLng.length < 6;
      if (isCommunitySparse) {
        try {
          const matched = await getMultiStopRoute(rawLatLng);
          if (!cancelled && matched.coordinates?.length) {
            setSmoothedBusSegment(matched.coordinates);
            return;
          }
        } catch (_) {
          // fallback to raw
        }
      }
      if (!cancelled) setSmoothedBusSegment(rawLatLng);
    }
    matchBusRoute();
    return () => { cancelled = true; };
  }, [currentOption?.busSegment, currentOption?.route?.type]);

  // ---- Reset direction filter & fit guard when selected route changes ----
  useEffect(() => {
    setRouteDirectionFilter('all');
    if (!selectedRoute?._id) {
      lastFittedRouteIdRef.current = null;
    }
  }, [selectedRoute?._id]);

  // ---- Compute latest GeoJSON data for WebGL layers ----
  const layerDataRef = useRef({
    accuracy: emptyFC(),
    selectedVuelta: emptyFC(),
    selectedIda: emptyFC(),
    selectedStops: emptyFC(),
    transmetroStops: emptyFC(),
    roadSafety: emptyFC(),
    navWalkBoard: emptyFC(),
    navWalkAlight: emptyFC(),
    navBus: emptyFC(),
    navBus2: emptyFC(),
    busColor: '#06B6D4',
    bus2Color: '#8B5CF6',
    gpsTrack: emptyFC(),
    isCapturing: false,
  });

  const busSegmentLatLng = currentOption?.busSegment?.map((c) => [c[1], c[0]]) || [];
  const activeDisplayBusLatLng = smoothedBusSegment.length > 1 ? smoothedBusSegment : busSegmentLatLng;

  const accuracyGeoJSON = userPosition
    ? createCircleGeoJSON(userPosition.lng, userPosition.lat, userPosition.accuracy || 30)
    : emptyFC();

  const rawSelectedIdaCoords =
    !navigationResult && selectedRoute?.ida?.trazado?.coordinates?.length > 1
      ? selectedRoute.ida.trazado.coordinates
      : null;

  const rawSelectedVueltaCoords =
    !navigationResult && selectedRoute?.regreso?.trazado?.coordinates?.length > 1
      ? selectedRoute.regreso.trazado.coordinates
      : null;

  const selectedVueltaGeoJSON =
    rawSelectedVueltaCoords && routeDirectionFilter !== 'ida'
      ? lineFC([rawSelectedVueltaCoords])
      : emptyFC();

  const selectedIdaGeoJSON =
    rawSelectedIdaCoords && routeDirectionFilter !== 'regreso'
      ? lineFC([rawSelectedIdaCoords])
      : emptyFC();

  const walkBoardLines = [];
  const walkAlightLines = [];
  if (navigationResult && currentOption) {
    if (walkToBoard.length > 1) walkBoardLines.push(walkToBoard.map((c) => [c[1], c[0]]));
    if (
      currentOption.isTransfer &&
      currentOption.transfer?.transferPoint?.length >= 2 &&
      currentOption.transfer?.secondBoardPoint?.length >= 2
    ) {
      const p1 = currentOption.transfer.transferPoint;
      const p2 = currentOption.transfer.secondBoardPoint;
      if (p1[0] !== p2[0] || p1[1] !== p2[1]) {
        walkBoardLines.push([p1, p2]);
      }
    }
    if (walkFromAlight.length > 1) walkAlightLines.push(walkFromAlight.map((c) => [c[1], c[0]]));
  }
  const navWalkBoardGeoJSON = lineFC(walkBoardLines);
  const navWalkAlightGeoJSON = lineFC(walkAlightLines);

  const navBusGeoJSON =
    navigationResult && currentOption && activeDisplayBusLatLng.length > 1
      ? lineFC([activeDisplayBusLatLng.map((c) => [c[1], c[0]])])
      : emptyFC();

  const navBus2GeoJSON =
    navigationResult &&
    currentOption?.isTransfer &&
    currentOption?.transfer?.secondBusSegment?.length > 1
      ? lineFC([currentOption.transfer.secondBusSegment])
      : emptyFC();

  const busColor = safeColor(currentOption?.route?.color, '#06B6D4');
  const bus2Color = safeColor(currentOption?.transfer?.secondRoute?.color, '#8B5CF6');

  const gpsTrackGeoJSON =
    gpsTrack.length > 1 ? lineFC([gpsTrack.map((p) => [p.lng, p.lat])]) : emptyFC();

  const effectiveSelectedStopsInfo = (() => {
    if (!selectedRoute) return { isOfficialStops: false, stops: [] };
    const variants = Array.isArray(selectedRoute.variantesOficiales)
      ? selectedRoute.variantesOficiales
      : [];
    if (variants.length > 1) {
      const found = variants.find((v) => v.nombre === activeOfficialVariant) || variants[0];
      return { isOfficialStops: true, stops: found?.paradas || [] };
    }
    if (Array.isArray(selectedRoute.paradasOficiales) && selectedRoute.paradasOficiales.length > 0) {
      return { isOfficialStops: true, stops: selectedRoute.paradasOficiales };
    }
    return {
      isOfficialStops: false,
      stops: Array.isArray(selectedRoute.paradas) ? selectedRoute.paradas : [],
    };
  })();

  const selectedRouteStopsGeoJSON =
    !navigationResult && effectiveSelectedStopsInfo.stops.length > 0
      ? {
          type: 'FeatureCollection',
          features: effectiveSelectedStopsInfo.stops
            .filter((p) => {
              if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
              if (effectiveSelectedStopsInfo.isOfficialStops || routeDirectionFilter === 'all') return true;
              const dir = p.sentido === 'regreso' ? 'regreso' : 'ida';
              return dir === routeDirectionFilter;
            })
            .map((p, idx) => ({
              type: 'Feature',
              properties: {
                orden: p.orden || idx + 1,
                sentido: effectiveSelectedStopsInfo.isOfficialStops
                  ? 'oficial'
                  : p.sentido === 'regreso'
                  ? 'regreso'
                  : 'ida',
                isOfficial: effectiveSelectedStopsInfo.isOfficialStops,
                rutaOficial: p.rutaOficial || '',
                nombre: p.nombre || `Parada ${p.orden || idx + 1}`,
                lat: p.lat,
                lng: p.lng,
              },
              geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            })),
        }
      : emptyFC();

  const transmetroStopsGeoJSON =
    showTransmetroStops && Array.isArray(transmetroStops) && transmetroStops.length > 0
      ? {
          type: 'FeatureCollection',
          features: transmetroStops
            .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
            .map((s) => ({
              type: 'Feature',
              properties: {
                id: s.id,
                nombre: s.nombre || 'Paradero Transmetro',
                rutasJson: JSON.stringify(s.rutas || []),
                lat: s.lat,
                lng: s.lng,
              },
              geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
            })),
        }
      : emptyFC();

  const roadSafetyGeoJSON =
    showRoadSafety && Array.isArray(roadSafetyPoints) && roadSafetyPoints.length > 0
      ? {
          type: 'FeatureCollection',
          features: roadSafetyPoints
            .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng))
            .map((pt) => ({
              type: 'Feature',
              properties: {
                id: pt.id,
                kind: pt.kind,
                name: pt.name || 'Punto vial',
                subtitle: pt.subtitle || '',
                status: pt.status || '',
                lat: pt.lat,
                lng: pt.lng,
              },
              geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
            })),
        }
      : emptyFC();

  layerDataRef.current = {
    accuracy: accuracyGeoJSON,
    selectedVuelta: selectedVueltaGeoJSON,
    selectedIda: selectedIdaGeoJSON,
    selectedStops: selectedRouteStopsGeoJSON,
    transmetroStops: transmetroStopsGeoJSON,
    roadSafety: roadSafetyGeoJSON,
    navWalkBoard: navWalkBoardGeoJSON,
    navWalkAlight: navWalkAlightGeoJSON,
    navBus: navBusGeoJSON,
    navBus2: navBus2GeoJSON,
    busColor,
    bus2Color,
    gpsTrack: gpsTrackGeoJSON,
    pois: CURATED_POIS_GEOJSON,
    showPOIs,
    poiCategory,
    isDark,
    isCapturing: Boolean(isCapturing),
  };

  /**
   * Ensures all vector sources & layers exist on the active style and syncs their data.
   * Uses styleLoadedRef instead of map.isStyleLoaded() so GeoJSON source updates
   * never silently drop while vector tiles are streaming during fitBounds/pan.
   */
  const syncVectorLayers = useCallback((map) => {
    if (!map || !styleLoadedRef.current || !map.getStyle()) return;
    const d = layerDataRef.current;

    if (!map.hasImage('route-arrow')) {
      try {
        map.addImage('route-arrow', createArrowImageData(), { sdf: true });
      } catch (_) {}
    }

    // Register POI icon sprites for the current style when loaded
    const loadedIcons = poiIconsRef.current || {};
    for (const [id, imgData] of Object.entries(loadedIcons)) {
      if (!map.hasImage(id)) {
        try {
          map.addImage(id, imgData, { pixelRatio: 2 });
        } catch (_) {}
      }
    }

    // Hide OpenFreeMap liberty's default POI layers so RutaQuilla owns POI density & theme parity
    for (const nativeId of NATIVE_STYLE_POI_LAYERS) {
      if (map.getLayer(nativeId)) {
        map.setLayoutProperty(nativeId, 'visibility', 'none');
      }
    }

    const upsertSource = (id, data) => {
      const existing = map.getSource(id);
      if (existing) {
        existing.setData(data);
      } else {
        map.addSource(id, { type: 'geojson', data });
      }
    };

    upsertSource('user-accuracy', d.accuracy);
    upsertSource('pois', d.pois || emptyFC());
    upsertSource('road-safety', d.roadSafety || emptyFC());
    upsertSource('transmetro-stops', d.transmetroStops || emptyFC());
    upsertSource('selected-route-vuelta', d.selectedVuelta);
    upsertSource('selected-route-ida', d.selectedIda);
    upsertSource('selected-route-stops', d.selectedStops || emptyFC());
    upsertSource('nav-walk-board', d.navWalkBoard);
    upsertSource('nav-walk-alight', d.navWalkAlight);
    upsertSource('nav-bus', d.navBus);
    upsertSource('nav-bus-2', d.navBus2);
    upsertSource('gps-track', d.gpsTrack);

    // Accuracy circle
    if (!map.getLayer('user-accuracy-fill')) {
      map.addLayer({
        id: 'user-accuracy-fill',
        type: 'fill',
        source: 'user-accuracy',
        paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.1 },
      });
    }
    if (!map.getLayer('user-accuracy-outline')) {
      map.addLayer({
        id: 'user-accuracy-outline',
        type: 'line',
        source: 'user-accuracy',
        paint: { 'line-color': '#3B82F6', 'line-width': 1.2, 'line-opacity': 0.35 },
      });
    }

    // Google Maps-style progressive POIs (OpenMapTiles vector bands + curated Barranquilla catalog)
    if (Object.keys(loadedIcons).length > 0) {
      const poiSpecs = buildPoiLayers({ isDark: d.isDark, activeCategory: d.poiCategory });
      const beforeRouteLayer = map.getLayer('selected-route-vuelta-casing')
        ? 'selected-route-vuelta-casing'
        : undefined;

      for (const spec of poiSpecs) {
        if (!map.getSource(spec.source)) continue;
        if (!map.getLayer(spec.id)) {
          map.addLayer(spec, beforeRouteLayer);
        } else {
          map.setFilter(spec.id, spec.filter);
          map.setPaintProperty(spec.id, 'text-color', spec.paint['text-color']);
          map.setPaintProperty(spec.id, 'text-halo-color', spec.paint['text-halo-color']);
        }
        map.setLayoutProperty(spec.id, 'visibility', d.showPOIs ? 'visible' : 'none');
      }
    }

    const layerStrokeColor = d.isDark ? '#0D1014' : '#FFFFFF';
    const layerTextColor = d.isDark ? '#E8EDF5' : '#14171C';
    const layerHaloColor = d.isDark ? 'rgba(13, 16, 20, 0.92)' : 'rgba(255, 255, 255, 0.94)';
    const beforeRouteOverlay = map.getLayer('selected-route-vuelta-casing')
      ? 'selected-route-vuelta-casing'
      : undefined;

    // Capa opcional: Seguridad Vial (semáforos + fotodetección)
    if (!map.getLayer('road-safety-circle')) {
      map.addLayer(
        {
          id: 'road-safety-circle',
          type: 'circle',
          source: 'road-safety',
          paint: {
            'circle-color': ['match', ['get', 'kind'], 'fotodeteccion', '#E5484D', '#FFC21A'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3.2, 14, 5, 16, 6.5],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': layerStrokeColor,
            'circle-opacity': 0.9,
          },
        },
        beforeRouteOverlay
      );
    } else {
      map.setPaintProperty('road-safety-circle', 'circle-stroke-color', layerStrokeColor);
    }

    // Capa opcional: Paraderos oficiales Transmetro
    if (!map.getLayer('transmetro-stops-circle')) {
      map.addLayer(
        {
          id: 'transmetro-stops-circle',
          type: 'circle',
          source: 'transmetro-stops',
          paint: {
            'circle-color': '#0EA5E9',
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3.4, 14, 5.2, 16, 7],
            'circle-stroke-width': 1.6,
            'circle-stroke-color': layerStrokeColor,
            'circle-opacity': 0.92,
          },
        },
        beforeRouteOverlay
      );
    } else {
      map.setPaintProperty('transmetro-stops-circle', 'circle-stroke-color', layerStrokeColor);
    }

    if (!map.getLayer('transmetro-stops-label')) {
      map.addLayer(
        {
          id: 'transmetro-stops-label',
          type: 'symbol',
          source: 'transmetro-stops',
          minzoom: 15.2,
          layout: {
            'text-field': ['get', 'nombre'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10.5,
            'text-offset': [0, 1.15],
            'text-anchor': 'top',
            'text-max-width': 10,
            'text-optional': true,
          },
          paint: {
            'text-color': layerTextColor,
            'text-halo-color': layerHaloColor,
            'text-halo-width': 1.3,
          },
        },
        beforeRouteOverlay
      );
    } else {
      map.setPaintProperty('transmetro-stops-label', 'text-color', layerTextColor);
      map.setPaintProperty('transmetro-stops-label', 'text-halo-color', layerHaloColor);
    }

    // Selected route: VUELTA (#E5484D)
    if (!map.getLayer('selected-route-vuelta-casing')) {
      map.addLayer({
        id: 'selected-route-vuelta-casing',
        type: 'line',
        source: 'selected-route-vuelta',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': 'rgba(20,23,28,0.55)', 'line-width': 7.5 },
      });
    }
    if (!map.getLayer('selected-route-vuelta-line')) {
      map.addLayer({
        id: 'selected-route-vuelta-line',
        type: 'line',
        source: 'selected-route-vuelta',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#E5484D', 'line-width': 4.5, 'line-opacity': 0.9 },
      });
    }
    if (!map.getLayer('selected-route-vuelta-arrows')) {
      map.addLayer({
        id: 'selected-route-vuelta-arrows',
        type: 'symbol',
        source: 'selected-route-vuelta',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 95,
          'icon-image': 'route-arrow',
          'icon-size': 0.72,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': '#FFFFFF', 'icon-opacity': 0.9 },
      });
    }

    // Selected route: IDA (#1F9D6B)
    if (!map.getLayer('selected-route-ida-casing')) {
      map.addLayer({
        id: 'selected-route-ida-casing',
        type: 'line',
        source: 'selected-route-ida',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': 'rgba(20,23,28,0.55)', 'line-width': 8 },
      });
    }
    if (!map.getLayer('selected-route-ida-line')) {
      map.addLayer({
        id: 'selected-route-ida-line',
        type: 'line',
        source: 'selected-route-ida',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1F9D6B', 'line-width': 5, 'line-opacity': 0.94 },
      });
    }
    if (!map.getLayer('selected-route-ida-arrows')) {
      map.addLayer({
        id: 'selected-route-ida-arrows',
        type: 'symbol',
        source: 'selected-route-ida',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 95,
          'icon-image': 'route-arrow',
          'icon-size': 0.72,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': '#FFFFFF', 'icon-opacity': 0.92 },
      });
    }

    // Selected route named stops (Transmetro / SIBUS transfer stops)
    const stopStrokeColor = d.isDark ? '#0D1014' : '#FFFFFF';
    if (!map.getLayer('selected-route-stops-layer')) {
      map.addLayer({
        id: 'selected-route-stops-layer',
        type: 'circle',
        source: 'selected-route-stops',
        paint: {
          'circle-color': ['match', ['get', 'sentido'], 'oficial', '#0EA5E9', 'regreso', '#E5484D', '#1F9D6B'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4.5, 15, 7],
          'circle-stroke-width': 2,
          'circle-stroke-color': stopStrokeColor,
          'circle-opacity': 0.95,
        },
      });
    } else {
      map.setPaintProperty('selected-route-stops-layer', 'circle-stroke-color', stopStrokeColor);
    }

    // Senderos peatonales modernos (perlas redondeadas con halo sutil)
    if (!map.getLayer('nav-walk-board-halo')) {
      map.addLayer({
        id: 'nav-walk-board-halo',
        type: 'line',
        source: 'nav-walk-board',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#3B8BF0', 'line-width': 6.5, 'line-opacity': 0.16 },
      });
    }
    if (!map.getLayer('nav-walk-board-dots')) {
      map.addLayer({
        id: 'nav-walk-board-dots',
        type: 'line',
        source: 'nav-walk-board',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#3B8BF0',
          'line-width': 3.6,
          'line-opacity': 0.95,
          'line-dasharray': [0.14, 1.75],
        },
      });
    }
    if (!map.getLayer('nav-walk-alight-halo')) {
      map.addLayer({
        id: 'nav-walk-alight-halo',
        type: 'line',
        source: 'nav-walk-alight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#E5484D', 'line-width': 6.5, 'line-opacity': 0.18 },
      });
    }
    if (!map.getLayer('nav-walk-alight-dots')) {
      map.addLayer({
        id: 'nav-walk-alight-dots',
        type: 'line',
        source: 'nav-walk-alight',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#E5484D',
          'line-width': 3.6,
          'line-opacity': 0.96,
          'line-dasharray': [0.14, 1.75],
        },
      });
    }

    // Navigation bus path (glow + core + directional arrows)
    if (!map.getLayer('nav-bus-glow')) {
      map.addLayer({
        id: 'nav-bus-glow',
        type: 'line',
        source: 'nav-bus',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': d.busColor, 'line-width': 11, 'line-opacity': 0.25 },
      });
    } else {
      map.setPaintProperty('nav-bus-glow', 'line-color', d.busColor);
    }

    if (!map.getLayer('nav-bus-line')) {
      map.addLayer({
        id: 'nav-bus-line',
        type: 'line',
        source: 'nav-bus',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': d.busColor, 'line-width': 5.5, 'line-opacity': 0.95 },
      });
    } else {
      map.setPaintProperty('nav-bus-line', 'line-color', d.busColor);
    }

    if (!map.getLayer('nav-bus-arrows')) {
      map.addLayer({
        id: 'nav-bus-arrows',
        type: 'symbol',
        source: 'nav-bus',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 90,
          'icon-image': 'route-arrow',
          'icon-size': 0.72,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': '#FFFFFF', 'icon-opacity': 0.92 },
      });
    }

    // Navigation second bus path (1-transfer leg 2)
    if (!map.getLayer('nav-bus-2-glow')) {
      map.addLayer({
        id: 'nav-bus-2-glow',
        type: 'line',
        source: 'nav-bus-2',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': d.bus2Color, 'line-width': 11, 'line-opacity': 0.25 },
      });
    } else {
      map.setPaintProperty('nav-bus-2-glow', 'line-color', d.bus2Color);
    }

    if (!map.getLayer('nav-bus-2-line')) {
      map.addLayer({
        id: 'nav-bus-2-line',
        type: 'line',
        source: 'nav-bus-2',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': d.bus2Color, 'line-width': 5.5, 'line-opacity': 0.95 },
      });
    } else {
      map.setPaintProperty('nav-bus-2-line', 'line-color', d.bus2Color);
    }

    if (!map.getLayer('nav-bus-2-arrows')) {
      map.addLayer({
        id: 'nav-bus-2-arrows',
        type: 'symbol',
        source: 'nav-bus-2',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 90,
          'icon-image': 'route-arrow',
          'icon-size': 0.72,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': '#FFFFFF', 'icon-opacity': 0.92 },
      });
    }

    // GPS tracking path
    if (!map.getLayer('gps-track-line')) {
      map.addLayer({
        id: 'gps-track-line',
        type: 'line',
        source: 'gps-track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#EF4444',
          'line-width': 4,
          'line-opacity': 0.9,
          ...(d.isCapturing ? { 'line-dasharray': [1.2, 1.8] } : {}),
        },
      });
    } else {
      map.setPaintProperty('gps-track-line', 'line-dasharray', d.isCapturing ? [1.2, 1.8] : undefined);
    }
  }, []);

  // ---- Helper: context menu popup (right-click & mobile long-press) ----
  const showContextPopup = useCallback((map, lngLat) => {
    if (contextPopupRef.current) {
      contextPopupRef.current.remove();
      contextPopupRef.current = null;
    }

    const wrapper = document.createElement('div');
    const originBtn = document.createElement('button');
    originBtn.className = 'ctx-btn';
    originBtn.type = 'button';
    originBtn.innerHTML =
      '<span class="ctx-btn-icon"><span style="width:9px;height:9px;border-radius:50%;background:#1F9D6B;display:inline-block"></span></span><span>Origen desde aquí</span>';

    const destBtn = document.createElement('button');
    destBtn.className = 'ctx-btn';
    destBtn.type = 'button';
    destBtn.innerHTML =
      '<span class="ctx-btn-icon"><span style="width:9px;height:9px;border-radius:2px;background:#E5484D;display:inline-block"></span></span><span>Destino aquí</span>';

    wrapper.appendChild(originBtn);
    wrapper.appendChild(destBtn);

    const popup = new maplibregl.Popup({
      className: 'context-popup',
      closeButton: false,
      offset: 8,
      maxWidth: '220px',
    })
      .setLngLat(lngLat)
      .setDOMContent(wrapper)
      .addTo(map);

    originBtn.addEventListener('click', () => {
      onSetOriginRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
      popup.remove();
    });
    destBtn.addEventListener('click', () => {
      onSetDestinationRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
      popup.remove();
    });

    contextPopupRef.current = popup;
  }, []);

  // ---- Initialize MapLibre GL map once ----
  useEffect(() => {
    if (!containerRef.current) return;

    const initialStyle = isDark ? STYLE_DARK : STYLE_LIGHT;
    currentStyleRef.current = initialStyle;
    styleLoadedRef.current = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: BARRANQUILLA_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 0,
      maxPitch: 60,
      attributionControl: true,
    });

    map.on('style.load', () => {
      styleLoadedRef.current = true;
      syncVectorLayers(map);
    });

    map.on('zoomend', () => setMapZoom(map.getZoom()));
    map.on('rotate', () => setMapBearing(map.getBearing()));

    // Left click for pinMode
    map.on('click', (e) => {
      if (pinModeRef.current) {
        onMapClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    // Desktop right-click context popup
    map.on('contextmenu', (e) => {
      if (pinModeRef.current) return;
      e.preventDefault();
      showContextPopup(map, e.lngLat);
    });

    // Click popups on route polylines
    const showLinePopup = (lngLat, html) => {
      if (infoPopupRef.current) infoPopupRef.current.remove();
      infoPopupRef.current = new maplibregl.Popup({ maxWidth: '260px' })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(map);
    };

    map.on('click', 'nav-bus-line', (e) => {
      const opt = currentOptionRef.current;
      if (!opt || pinModeRef.current) return;
      const color = safeColor(opt.route?.color, '#FFC21A');
      const name = escapeHtml(opt.route?.name || opt.route?.nombre || 'Ruta');
      const company = escapeHtml(opt.route?.company || opt.route?.operador || '');
      const dir = opt.direction === 'ida' ? 'Ida' : 'Vuelta';
      const fare = escapeHtml((opt.route?.fare || 3700).toLocaleString());
      showLinePopup(
        e.lngLat,
        `<div style="min-width:190px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:10px;height:10px;border-radius:3px;background:${color};flex-shrink:0"></div>
            <strong style="font-family:var(--font-display);font-size:14px">${name}</strong>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.55">
            <div>${company} · <strong>${dir}</strong></div>
            <div style="font-family:var(--font-mono);color:var(--brand);font-weight:700;margin-top:2px">$${fare} COP</div>
          </div>
        </div>`
      );
    });

    const handleSelectedLineClick = (dirLabel, badgeColor) => (e) => {
      const r = selectedRouteRef.current;
      if (!r || pinModeRef.current) return;
      const name = escapeHtml(r.nombre || 'Ruta');
      const op = escapeHtml(r.operador || '');
      const code = r.codigo
        ? `<span style="background:#14171C;color:#FFC21A;padding:1px 6px;border-radius:4px;font-family:var(--font-mono);font-size:10px;font-weight:700">${escapeHtml(r.codigo)}</span>`
        : '';
      const locLine = dirLabel === 'IDA'
        ? (r.origen ? `<div>Origen: ${escapeHtml(r.origen)}</div>` : '')
        : (r.destino ? `<div>Destino: ${escapeHtml(r.destino)}</div>` : '');
      const fare = escapeHtml((r.fare || 3700).toLocaleString());
      showLinePopup(
        e.lngLat,
        `<div style="min-width:200px">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
            ${code}
            <strong style="font-family:var(--font-display);font-size:14px">${name}</strong>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.55">
            <div>${op} — <span style="color:${badgeColor};font-weight:700">${dirLabel}</span></div>
            ${locLine}
            <div style="font-family:var(--font-mono);color:var(--brand);font-weight:700;margin-top:2px">$${fare} COP</div>
          </div>
        </div>`
      );
    };

    map.on('click', 'nav-bus-2-line', (e) => {
      const opt = currentOptionRef.current;
      const sr = opt?.transfer?.secondRoute;
      if (!sr || pinModeRef.current) return;
      const color = safeColor(sr.color, '#3B8BF0');
      const name = escapeHtml(sr.name || 'Ruta 2');
      const company = escapeHtml(sr.company || '');
      const dir = opt.transfer.secondDirection === 'ida' ? 'Ida' : 'Vuelta';
      const fare = escapeHtml((sr.fare || 3700).toLocaleString());
      showLinePopup(
        e.lngLat,
        `<div style="min-width:190px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:10px;height:10px;border-radius:3px;background:${color};flex-shrink:0"></div>
            <strong style="font-family:var(--font-display);font-size:14px">${name}</strong>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.55">
            <div>${company} (Transbordo) · <strong>${dir}</strong></div>
            <div style="font-family:var(--font-mono);color:var(--brand);font-weight:700;margin-top:2px">$${fare} COP</div>
          </div>
        </div>`
      );
    });

    map.on('click', 'selected-route-ida-line', handleSelectedLineClick('IDA', '#1F9D6B'));
    map.on('click', 'selected-route-vuelta-line', handleSelectedLineClick('VUELTA', '#E5484D'));

    const openPointCardPopup = ({ lng, lat, badgeText, badgeColor, titleText, subtitleText, metaText }) => {
      const root = document.createElement('div');
      root.className = 'poi-card';

      const badge = document.createElement('div');
      badge.className = 'poi-card-badge';
      badge.style.setProperty('--poi-color', badgeColor);
      const dot = document.createElement('span');
      dot.className = 'poi-card-dot';
      dot.style.background = badgeColor;
      badge.appendChild(dot);
      badge.appendChild(document.createTextNode(badgeText));
      root.appendChild(badge);

      const title = document.createElement('div');
      title.className = 'poi-card-title';
      title.textContent = titleText;
      root.appendChild(title);

      if (subtitleText) {
        const sub = document.createElement('div');
        sub.className = 'poi-card-sub';
        sub.textContent = subtitleText;
        root.appendChild(sub);
      }

      if (metaText) {
        const metaLine = document.createElement('div');
        metaLine.className = 'poi-card-meta';
        metaLine.textContent = metaText;
        root.appendChild(metaLine);
      }

      const actions = document.createElement('div');
      actions.className = 'poi-card-actions';

      const originBtn = document.createElement('button');
      originBtn.type = 'button';
      originBtn.className = 'poi-btn-origin';
      originBtn.textContent = 'Salir desde aquí';

      const destBtn = document.createElement('button');
      destBtn.type = 'button';
      destBtn.className = 'poi-btn-dest';
      destBtn.textContent = 'Ir aquí';

      actions.appendChild(originBtn);
      actions.appendChild(destBtn);
      root.appendChild(actions);

      if (infoPopupRef.current) infoPopupRef.current.remove();
      const popup = new maplibregl.Popup({ maxWidth: '270px', offset: 12 })
        .setLngLat([lng, lat])
        .setDOMContent(root)
        .addTo(map);
      infoPopupRef.current = popup;

      originBtn.addEventListener('click', () => {
        onSetOriginRef.current?.({ lat, lng, name: titleText });
        popup.remove();
      });
      destBtn.addEventListener('click', () => {
        onSetDestinationRef.current?.({ lat, lng, name: titleText });
        popup.remove();
      });
    };

    openPointCardPopupRef.current = openPointCardPopup;

    const openTransmetroStopPopup = ({ lng, lat, nombre, rutas = [] }) => {
      const root = document.createElement('div');
      root.className = 'poi-card';

      const badge = document.createElement('div');
      badge.className = 'poi-card-badge';
      badge.style.setProperty('--poi-color', '#0EA5E9');
      const dot = document.createElement('span');
      dot.className = 'poi-card-dot';
      dot.style.background = '#0EA5E9';
      badge.appendChild(dot);
      badge.appendChild(document.createTextNode('Paradero Transmetro'));
      root.appendChild(badge);

      const title = document.createElement('div');
      title.className = 'poi-card-title';
      title.textContent = nombre || 'Paradero Transmetro';
      root.appendChild(title);

      if (Array.isArray(rutas) && rutas.length > 0) {
        const sub = document.createElement('div');
        sub.className = 'poi-card-sub';
        sub.style.textTransform = 'none';
        sub.textContent =
          rutas.length === 1 ? '1 ruta pasa por este paradero:' : `${rutas.length} rutas pasan por este paradero:`;
        root.appendChild(sub);

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'stop-route-chips';

        if (infoPopupRef.current) infoPopupRef.current.remove();
        const popup = new maplibregl.Popup({ maxWidth: '280px', offset: 12 })
          .setLngLat([lng, lat])
          .setDOMContent(root)
          .addTo(map);
        infoPopupRef.current = popup;

        rutas.forEach((r) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'stop-route-chip';
          btn.textContent = r.codigo || r.rutaOficial || 'Ruta';
          btn.title = r.rutaOficial ? `Ver ${r.rutaOficial}` : `Ver ${r.codigo}`;
          btn.addEventListener('click', () => {
            onSelectRouteByCodeRef.current?.(r.codigo);
            popup.remove();
          });
          chipsWrap.appendChild(btn);
        });
        root.appendChild(chipsWrap);

        const metaLine = document.createElement('div');
        metaLine.className = 'poi-card-meta';
        metaLine.textContent = 'Datos Abiertos · datos.gov.co (ref. 2020)';
        root.appendChild(metaLine);

        const actions = document.createElement('div');
        actions.className = 'poi-card-actions';

        const originBtn = document.createElement('button');
        originBtn.type = 'button';
        originBtn.className = 'poi-btn-origin';
        originBtn.textContent = 'Salir desde aquí';

        const destBtn = document.createElement('button');
        destBtn.type = 'button';
        destBtn.className = 'poi-btn-dest';
        destBtn.textContent = 'Ir aquí';

        actions.appendChild(originBtn);
        actions.appendChild(destBtn);
        root.appendChild(actions);

        originBtn.addEventListener('click', () => {
          onSetOriginRef.current?.({ lat, lng, name: nombre });
          popup.remove();
        });
        destBtn.addEventListener('click', () => {
          onSetDestinationRef.current?.({ lat, lng, name: nombre });
          popup.remove();
        });
        return;
      }

      openPointCardPopup({
        lng,
        lat,
        badgeText: 'Paradero Transmetro',
        badgeColor: '#0EA5E9',
        titleText: nombre || 'Paradero Transmetro',
        subtitleText: 'Transmetro Barranquilla',
        metaText: 'Datos Abiertos · datos.gov.co (ref. 2020)',
      });
    };

    openTransmetroStopPopupRef.current = openTransmetroStopPopup;

    map.on('click', 'selected-route-stops-layer', (e) => {
      if (pinModeRef.current || e.originalEvent?._poiHandled) return;
      const feat = e.features?.[0];
      if (!feat) return;
      if (e.originalEvent) e.originalEvent._poiHandled = true;
      const props = feat.properties || {};
      const coords = feat.geometry?.coordinates || [e.lngLat.lng, e.lngLat.lat];
      const lng = Number(props.lng ?? coords[0]);
      const lat = Number(props.lat ?? coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const isOfficial = props.isOfficial === true || props.isOfficial === 'true';
      const isRegreso = props.sentido === 'regreso';
      const routeName = selectedRouteRef.current?.nombre || 'Ruta';
      openPointCardPopup({
        lng,
        lat,
        badgeText: isOfficial
          ? `Paradero oficial #${props.orden || '?'}`
          : `Parada #${props.orden || '?'} · ${isRegreso ? 'Regreso' : 'Ida'}`,
        badgeColor: isOfficial ? '#0EA5E9' : isRegreso ? '#EF4444' : '#10B981',
        titleText: props.nombre || 'Paradero',
        subtitleText: props.rutaOficial || routeName,
        metaText: isOfficial
          ? 'Transmetro · datos.gov.co (2020)'
          : selectedRouteRef.current?.operador || 'RutaQuilla',
      });
    });

    map.on('click', 'transmetro-stops-circle', (e) => {
      if (pinModeRef.current || e.originalEvent?._poiHandled) return;
      const feat = e.features?.[0];
      if (!feat) return;
      if (e.originalEvent) e.originalEvent._poiHandled = true;
      const props = feat.properties || {};
      const coords = feat.geometry?.coordinates || [e.lngLat.lng, e.lngLat.lat];
      const lng = Number(props.lng ?? coords[0]);
      const lat = Number(props.lat ?? coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      let rutas = [];
      try {
        rutas = typeof props.rutasJson === 'string' ? JSON.parse(props.rutasJson) : (props.rutasJson || []);
      } catch (_) {
        rutas = [];
      }
      openTransmetroStopPopup({ lng, lat, nombre: props.nombre, rutas });
    });

    map.on('click', 'road-safety-circle', (e) => {
      if (pinModeRef.current || e.originalEvent?._poiHandled) return;
      const feat = e.features?.[0];
      if (!feat) return;
      if (e.originalEvent) e.originalEvent._poiHandled = true;
      const props = feat.properties || {};
      const coords = feat.geometry?.coordinates || [e.lngLat.lng, e.lngLat.lat];
      const lng = Number(props.lng ?? coords[0]);
      const lat = Number(props.lat ?? coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const isFoto = props.kind === 'fotodeteccion';
      openPointCardPopup({
        lng,
        lat,
        badgeText: isFoto ? 'Cámara de fotodetección' : 'Intersección semaforizada',
        badgeColor: isFoto ? '#E5484D' : '#FFC21A',
        titleText: props.name || 'Control vial',
        subtitleText: [props.subtitle, props.status].filter(Boolean).join(' · '),
        metaText: 'Datos Abiertos · datos.gov.co',
      });
    });

    const handlePoiClick = (e) => {
      if (pinModeRef.current || e.originalEvent?._poiHandled) return;
      const feat = e.features?.[0];
      if (!feat) return;
      if (e.originalEvent) e.originalEvent._poiHandled = true;

      const props = feat.properties || {};
      const coords =
        feat.geometry?.type === 'Point' && Array.isArray(feat.geometry.coordinates)
          ? feat.geometry.coordinates
          : [e.lngLat.lng, e.lngLat.lat];
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const categoryId = props.category || getPoiCategory(props.class, props.subclass);
      const meta = getCategoryMeta(categoryId);
      const isCurated = props.source === 'RutaQuilla';
      const osmDetail = String(props.subclass || props.class || '')
        .replace(/_/g, ' ')
        .trim();

      openPointCardPopup({
        lng,
        lat,
        badgeText: meta.label,
        badgeColor: meta.color,
        titleText: props.name || 'Punto de interés',
        subtitleText: props.subtitle || osmDetail,
        metaText: isCurated ? 'RutaQuilla · Barranquilla' : 'OpenStreetMap · Actualización semanal',
      });
    };

    POI_LAYER_IDS.forEach((layerId) => {
      map.on('click', layerId, handlePoiClick);
    });

    ['nav-bus-line', 'nav-bus-2-line', 'selected-route-ida-line', 'selected-route-vuelta-line', 'selected-route-stops-layer', 'transmetro-stops-circle', 'road-safety-circle', ...POI_LAYER_IDS].forEach((layerId) => {
      map.on('mouseenter', layerId, () => {
        if (!pinModeRef.current) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = pinModeRef.current ? 'crosshair' : '';
      });
    });

    // Mobile long-press context menu
    const container = map.getContainer();
    let longPressTimer = null;
    let startTouch = null;
    let rippleEl = null;

    const clearRipple = () => {
      if (rippleEl && rippleEl.parentNode) {
        rippleEl.parentNode.removeChild(rippleEl);
      }
      rippleEl = null;
    };

    const onTouchStart = (e) => {
      if (pinModeRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      startTouch = { x, y };

      longPressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        clearRipple();
        rippleEl = document.createElement('div');
        rippleEl.style.cssText = `position:absolute;z-index:9999;width:50px;height:50px;left:${x - 25}px;top:${y - 25}px;border-radius:50%;border:2px solid rgba(245,158,11,0.6);background:rgba(245,158,11,0.1);animation:origin-pulse-1 0.6s ease-out forwards;pointer-events:none;`;
        container.appendChild(rippleEl);

        const lngLat = map.unproject([x, y]);
        showContextPopup(map, lngLat);
        longPressTimer = null;
      }, 500);
    };

    const onTouchMove = (e) => {
      if (!longPressTimer || !startTouch || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const dx = touch.clientX - rect.left - startTouch.x;
      const dy = touch.clientY - rect.top - startTouch.y;
      if (Math.hypot(dx, dy) > 8) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        clearRipple();
      }
    };

    const onTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      setTimeout(clearRipple, 600);
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    // Keep WebGL canvas sized cleanly when sidebar opens/closes
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    mapRef.current = map;

    return () => {
      openPointCardPopupRef.current = null;
      openTransmetroStopPopupRef.current = null;
      resizeObserver.disconnect();
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      if (longPressTimer) clearTimeout(longPressTimer);
      clearRipple();
      navMarkersRef.current.forEach((m) => m.remove());
      reportMarkersRef.current.forEach((m) => m.remove());
      sponsorMarkersRef.current.forEach((m) => m.remove());
      if (userMarkerRef.current) userMarkerRef.current.remove();
      if (contextPopupRef.current) contextPopupRef.current.remove();
      if (infoPopupRef.current) infoPopupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [syncVectorLayers, showContextPopup]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Generate category icon sprites whenever theme changes ----
  useEffect(() => {
    let cancelled = false;
    if (poiIconsThemeRef.current === isDark && Object.keys(poiIconsRef.current).length > 0) {
      return;
    }
    createPoiIconImages(POI_ICON_SVGS, isDark).then((images) => {
      if (cancelled || !images) return;
      poiIconsRef.current = images;
      poiIconsThemeRef.current = isDark;
      const map = mapRef.current;
      if (map && styleLoadedRef.current) {
        for (const [id, imgData] of Object.entries(images)) {
          try {
            if (map.hasImage(id)) map.removeImage(id);
            map.addImage(id, imgData, { pixelRatio: 2 });
          } catch (_) {}
        }
        syncVectorLayers(map);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isDark, syncVectorLayers]);

  // ---- Update cursor when pinMode toggles ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pinMode ? 'crosshair' : '';
  }, [pinMode]);

  // ---- Switch native vector theme instantaneously ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyle = isDark ? STYLE_DARK : STYLE_LIGHT;
    if (currentStyleRef.current !== nextStyle) {
      currentStyleRef.current = nextStyle;
      styleLoadedRef.current = false;
      map.setStyle(nextStyle);
    }
  }, [isDark]);

  // ---- Sync WebGL vector sources & paint whenever route/nav/GPS data changes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    syncVectorLayers(map);
  }, [
    syncVectorLayers,
    userPosition,
    navigationResult,
    selectedRoute,
    routeDirectionFilter,
    selectedOptionIdx,
    walkToBoard,
    walkFromAlight,
    smoothedBusSegment,
    gpsTrack,
    isCapturing,
    isDark,
    showPOIs,
    poiCategory,
    activeOfficialVariant,
    showTransmetroStops,
    transmetroStops,
    showRoadSafety,
    roadSafetyPoints,
  ]);

  // ---- Close stale line/stop popups when switching selected route ----
  useEffect(() => {
    if (infoPopupRef.current) {
      infoPopupRef.current.remove();
      infoPopupRef.current = null;
    }
  }, [selectedRoute?._id]);

  // ---- Sync Navigation, Preview & Selected-Route Markers ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    navMarkersRef.current.forEach((m) => m.remove());
    navMarkersRef.current = [];

    const addMarker = (lngLat, el, popupHtml = null) => {
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat);
      if (popupHtml) {
        marker.setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml));
      }
      marker.addTo(map);
      navMarkersRef.current.push(marker);
    };

    if (!navigationResult) {
      if (previewOrigin) {
        const originLabel = previewOrigin.displayName || previewOrigin.name;
        addMarker(
          [previewOrigin.lng, previewOrigin.lat],
          createOriginElement(),
          originLabel ? `<strong>Origen</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${escapeHtml(originLabel)}</div>` : '<strong>Origen seleccionado</strong>'
        );
      }
      if (previewDestination) {
        const destLabel = previewDestination.displayName || previewDestination.name;
        addMarker(
          [previewDestination.lng, previewDestination.lat],
          createDestinationElement(),
          destLabel ? `<strong>Destino</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${escapeHtml(destLabel)}</div>` : '<strong>Destino seleccionado</strong>'
        );
      }
      if (selectedRoute) {
        const idaCoords = selectedRoute.ida?.trazado?.coordinates;
        const regCoords = selectedRoute.regreso?.trazado?.coordinates;
        const hasReg = Array.isArray(regCoords) && regCoords.length > 1;
        const title = escapeHtml(selectedRoute.nombre || selectedRoute.codigo || 'Ruta');

        if (routeDirectionFilter !== 'regreso' && Array.isArray(idaCoords) && idaCoords.length > 1) {
          addMarker(
            idaCoords[0],
            createBoardAlightElement('#1F9D6B', 'Inicio', { position: 'top', compact: true }),
            `<div><strong>${title}</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Inicio recorrido (Ida)${selectedRoute.origen ? ` · ${escapeHtml(selectedRoute.origen)}` : ''}</div></div>`
          );
          addMarker(
            idaCoords[idaCoords.length - 1],
            createBoardAlightElement(hasReg ? '#FFC21A' : '#E5484D', hasReg ? 'Retorno' : 'Fin', { position: 'bottom', compact: true }),
            `<div><strong>${title}</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:3px">${hasReg ? 'Punto de retorno a regreso' : 'Destino final (recorrido lineal)'}${selectedRoute.destino ? ` · ${escapeHtml(selectedRoute.destino)}` : ''}</div></div>`
          );
        } else if (routeDirectionFilter === 'regreso' && hasReg) {
          addMarker(
            regCoords[0],
            createBoardAlightElement('#E5484D', 'Inicio vuelta', { position: 'top', compact: true }),
            `<div><strong>${title}</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Inicio sentido regreso</div></div>`
          );
          addMarker(
            regCoords[regCoords.length - 1],
            createBoardAlightElement('#1F9D6B', 'Cierre', { position: 'bottom', compact: true }),
            `<div><strong>${title}</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Cierre de recorrido</div></div>`
          );
        }
      }
    } else if (currentOption) {
      const rColor = safeColor(currentOption.route?.color, '#FFC21A');
      const rName = escapeHtml(currentOption.route?.name || currentOption.route?.nombre || 'Ruta');
      const dirText = currentOption.direction === 'ida' ? 'Ida' : 'Vuelta';
      const walkAlightDist = currentOption.alightPoint?.walkDistance ?? 0;
      const walkAlightMin = currentOption.alightPoint?.walkMinutes ?? Math.ceil(walkAlightDist / 80);
      const alightText =
        walkAlightDist < 45
          ? 'El bus te deja frente a tu destino'
          : `Camina ${escapeHtml(walkAlightDist)} m (~${escapeHtml(walkAlightMin)} min) hasta tu destino`;
      const closeToBoard = (currentOption.boardPoint?.walkDistance ?? 999) < 35;
      const closeToAlight = walkAlightDist < 35;

      addMarker(
        [navigationResult.origin.lng, navigationResult.origin.lat],
        createOriginElement(!closeToBoard),
        '<strong>Tu origen</strong>'
      );
      addMarker(
        [navigationResult.destination.lng, navigationResult.destination.lat],
        createDestinationElement(!closeToAlight),
        '<strong>Tu destino</strong>'
      );
      addMarker(
        currentOption.boardPoint.coordinates,
        createBoardAlightElement(rColor, 'Subir', { position: 'top' }),
        `<div><strong>Aborda aquí</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${rName} (${dirText})</div></div>`
      );
      if (currentOption.isTransfer && currentOption.transfer?.transferPoint?.length >= 2) {
        const srName = escapeHtml(currentOption.transfer.secondRoute?.name || 'Siguiente bus');
        const trWalk = escapeHtml(currentOption.transfer.walkDistance ?? 0);
        addMarker(
          currentOption.transfer.transferPoint,
          createBoardAlightElement('#3B8BF0', 'Transbordo', { position: 'top' }),
          `<div><strong>Cambia a ${srName}</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Camina ${trWalk} m al siguiente tramo</div></div>`
        );
      }
      addMarker(
        currentOption.alightPoint.coordinates,
        createBoardAlightElement('#E5484D', closeToAlight ? 'Bajar · Destino' : 'Bajar', { position: 'bottom' }),
        `<div><strong>Baja en este punto</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${alightText}</div></div>`
      );

      if (walkAlightDist >= 45) {
        const walkPathLatLng =
          walkFromAlight.length >= 2
            ? walkFromAlight
            : [
                [currentOption.alightPoint.coordinates[1], currentOption.alightPoint.coordinates[0]],
                [navigationResult.destination.lat, navigationResult.destination.lng],
              ];
        const midLngLat = getPolylineMidpoint(walkPathLatLng);
        if (midLngLat) {
          addMarker(midLngLat, createWalkCalloutElement(walkAlightDist, walkAlightMin));
        }
      }
    }
  }, [navigationResult, currentOption, previewOrigin, previewDestination, selectedRoute, routeDirectionFilter, walkFromAlight]);

  // ---- Sync Incident Report Markers ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    reportMarkersRef.current.forEach((m) => m.remove());
    reportMarkersRef.current = [];

    for (const report of activeReports) {
      const coord = report?.location?.coordinates;
      if (!coord || coord.length < 2) continue;
      const el = createReportElement(report);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onReportClickRef.current?.(report);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([coord[0], coord[1]])
        .addTo(map);
      reportMarkersRef.current.push(marker);
    }
  }, [activeReports]);

  // ---- Sync Sponsored Markers ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    sponsorMarkersRef.current.forEach((m) => m.remove());
    sponsorMarkersRef.current = [];

    if (isPremium) return;

    for (const sponsor of sponsoredLocations) {
      if (!sponsor?.coordinates || sponsor.coordinates.length < 2) continue;
      const sColor = safeColor(sponsor.color, '#F59E0B');
      const sPromo = escapeHtml(sponsor.promo || '');
      const sName = escapeHtml(sponsor.name || '');
      const sDesc = escapeHtml(sponsor.description || '');

      const el = createSponsorElement(sColor);
      const popup = new maplibregl.Popup({ offset: 22, maxWidth: '240px' }).setHTML(
        `<div style="min-width:190px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="background:${sColor};color:#000;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">${sPromo}</span>
            <span style="font-size:10px;color:var(--text-muted)">PATROCINADO</span>
          </div>
          <strong style="font-size:14px">${sName}</strong>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${sDesc}</div>
        </div>`
      );
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([sponsor.coordinates[0], sponsor.coordinates[1]])
        .setPopup(popup)
        .addTo(map);
      sponsorMarkersRef.current.push(marker);
    }
  }, [isPremium, sponsoredLocations]);

  // ---- Sync User GPS Marker ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userPosition) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    const acc = escapeHtml(userPosition.accuracy ? userPosition.accuracy.toFixed(0) : '30');
    const popupHtml = `<div><strong>Tu posición</strong><div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Precisión: ±${acc}m</div></div>`;

    if (!userMarkerRef.current) {
      const marker = new maplibregl.Marker({ element: createUserElement(), anchor: 'center' })
        .setLngLat([userPosition.lng, userPosition.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(popupHtml))
        .addTo(map);
      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setLngLat([userPosition.lng, userPosition.lat]);
      const p = userMarkerRef.current.getPopup();
      if (p) p.setHTML(popupHtml);
    }

    if (!hasFlewToUserRef.current) {
      hasFlewToUserRef.current = true;
      map.flyTo({
        center: [userPosition.lng, userPosition.lat],
        zoom: 15,
        duration: 1400,
      });
    }
  }, [userPosition]);

  // ---- Camera Fit: Preview Origin / Destination ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || navigationResult) return;

    const originChanged =
      previewOrigin &&
      (!lastPreviewOriginRef.current ||
        lastPreviewOriginRef.current.lat !== previewOrigin.lat ||
        lastPreviewOriginRef.current.lng !== previewOrigin.lng);
    const destChanged =
      previewDestination &&
      (!lastPreviewDestRef.current ||
        lastPreviewDestRef.current.lat !== previewDestination.lat ||
        lastPreviewDestRef.current.lng !== previewDestination.lng);

    if (originChanged) lastPreviewOriginRef.current = previewOrigin;
    if (destChanged) lastPreviewDestRef.current = previewDestination;

    if (previewOrigin && previewDestination && (originChanged || destChanged)) {
      const bounds = new maplibregl.LngLatBounds(
        [previewOrigin.lng, previewOrigin.lat],
        [previewOrigin.lng, previewOrigin.lat]
      );
      bounds.extend([previewDestination.lng, previewDestination.lat]);
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 160, left: 60, right: 60 },
        maxZoom: 15.5,
        duration: 900,
      });
    } else if (originChanged && previewOrigin) {
      map.flyTo({
        center: [previewOrigin.lng, previewOrigin.lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: 900,
      });
    } else if (destChanged && previewDestination) {
      map.flyTo({
        center: [previewDestination.lng, previewDestination.lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: 900,
      });
    }
  }, [previewOrigin, previewDestination, navigationResult]);

  // ---- Camera Fit: Navigation Result ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navigationResult?.origin || !navigationResult?.destination) return;

    const bounds = new maplibregl.LngLatBounds(
      [navigationResult.origin.lng, navigationResult.origin.lat],
      [navigationResult.origin.lng, navigationResult.origin.lat]
    );
    bounds.extend([navigationResult.destination.lng, navigationResult.destination.lat]);
    walkToBoard.forEach((c) => bounds.extend([c[1], c[0]]));
    walkFromAlight.forEach((c) => bounds.extend([c[1], c[0]]));
    (currentOption?.busSegment || []).forEach((c) => bounds.extend([c[0], c[1]]));
    (currentOption?.transfer?.secondBusSegment || []).forEach((c) => bounds.extend([c[0], c[1]]));

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 200, left: 60, right: 60 },
      maxZoom: 16,
      duration: 900,
    });
  }, [navigationResult, currentOption, walkToBoard, walkFromAlight]);

  // ---- Camera Fit: Selected Route (once per route when geometry arrives) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || navigationResult || !selectedRoute?._id) return;

    const idaCoords = selectedRoute.ida?.trazado?.coordinates;
    if (!Array.isArray(idaCoords) || idaCoords.length < 2) return;
    if (lastFittedRouteIdRef.current === selectedRoute._id) return;
    lastFittedRouteIdRef.current = selectedRoute._id;

    const bounds = new maplibregl.LngLatBounds(idaCoords[0], idaCoords[0]);
    idaCoords.forEach((c) => bounds.extend(c));
    (selectedRoute.regreso?.trazado?.coordinates || []).forEach((c) => bounds.extend(c));

    map.fitBounds(bounds, {
      padding: { top: 76, bottom: 118, left: 56, right: 68 },
      maxZoom: 15,
      duration: 850,
    });
  }, [navigationResult, selectedRoute]);

  // ---- Focus specific stop clicked from Sidebar ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedStop || !Number.isFinite(focusedStop.lat) || !Number.isFinite(focusedStop.lng)) return;

    map.flyTo({
      center: [focusedStop.lng, focusedStop.lat],
      zoom: Math.max(map.getZoom(), 15.8),
      duration: 750,
    });

    const isOfficial = focusedStop.sentido === 'oficial' || Boolean(focusedStop.rutaOficial);
    const isRegreso = focusedStop.sentido === 'regreso';
    openPointCardPopupRef.current?.({
      lng: focusedStop.lng,
      lat: focusedStop.lat,
      badgeText: isOfficial
        ? `Paradero oficial #${focusedStop.orden || '?'}`
        : `Parada #${focusedStop.orden || '?'} · ${isRegreso ? 'Regreso' : 'Ida'}`,
      badgeColor: isOfficial ? '#0EA5E9' : isRegreso ? '#EF4444' : '#10B981',
      titleText: focusedStop.nombre || 'Paradero',
      subtitleText: focusedStop.rutaOficial || selectedRouteRef.current?.nombre || 'Ruta',
      metaText: isOfficial
        ? 'Transmetro · datos.gov.co (2020)'
        : selectedRouteRef.current?.operador || 'RutaQuilla',
    });
  }, [focusedStop]);

  // ---- Focus physical Transmetro stop clicked from Sidebar Paraderos TM ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedTransmetroStop || !Number.isFinite(focusedTransmetroStop.lat) || !Number.isFinite(focusedTransmetroStop.lng)) {
      return;
    }

    map.flyTo({
      center: [focusedTransmetroStop.lng, focusedTransmetroStop.lat],
      zoom: Math.max(map.getZoom(), 16),
      duration: 750,
    });

    openTransmetroStopPopupRef.current?.({
      lng: focusedTransmetroStop.lng,
      lat: focusedTransmetroStop.lat,
      nombre: focusedTransmetroStop.nombre,
      rutas: focusedTransmetroStop.rutas || [],
    });
  }, [focusedTransmetroStop]);

  // ---- Close layers & POI popovers on outside click or Escape ----
  useEffect(() => {
    if (!layersOpen && !poiMenuOpen) return;
    const handleOutside = (e) => {
      if (layersOpen && layersPopoverRef.current && !layersPopoverRef.current.contains(e.target)) {
        setLayersOpen(false);
      }
      if (poiMenuOpen && poiMenuRef.current && !poiMenuRef.current.contains(e.target)) {
        setPoiMenuOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setLayersOpen(false);
        setPoiMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [layersOpen, poiMenuOpen]);

  // ---- Floating Map Controls ----
  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 280 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 280 });
  };

  const handleResetNorth = () => {
    const map = mapRef.current;
    if (!map) return;
    setIs3D(false);
    map.easeTo({ bearing: 0, pitch: 0, duration: 450 });
  };

  const handleToggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    const next3D = !is3D;
    setIs3D(next3D);
    map.easeTo({ pitch: next3D ? 48 : 0, duration: 500 });
  };

  const handleRecenterGPS = () => {
    const map = mapRef.current;
    if (!map || !userPosition) return;
    map.flyTo({
      center: [userPosition.lng, userPosition.lat],
      zoom: 15.5,
      duration: 900,
    });
  };

  const handleSelectCategory = (catId) => {
    setPoiCategory(catId);
    setPoiMenuOpen(false);
    const map = mapRef.current;
    if (catId !== 'all' && map && map.getZoom() < 14) {
      map.easeTo({ zoom: 14.5, duration: 550 });
    }
  };

  const activePoiMeta = poiCategory !== 'all' ? POI_CATEGORIES[poiCategory] : null;
  const ActivePoiIcon = activePoiMeta ? (ICON_COMPONENTS[activePoiMeta.icon] || MapPin) : Layers;

  return (
    <div className="w-full h-full relative" style={{ cursor: pinMode ? 'crosshair' : undefined }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Category filter dropdown (minimalista) */}
      {showPOIs && !pinMode && !isLiveNav && (
        <div ref={poiMenuRef} className="poi-dropdown-wrap">
          <div className="poi-trigger-row">
            <button
              type="button"
              id="poi-menu-toggle-btn"
              onClick={() => setPoiMenuOpen((prev) => !prev)}
              className={`poi-trigger-btn${poiCategory !== 'all' ? ' filtered' : ''}`}
              style={{ '--chip-color': activePoiMeta?.color || 'var(--brand)' }}
              aria-expanded={poiMenuOpen}
              aria-haspopup="menu"
            >
              <ActivePoiIcon size={13} color={activePoiMeta?.color || 'var(--brand)'} />
              <span>{activePoiMeta ? activePoiMeta.chip : 'Puntos de interés'}</span>
              <ChevronDown
                size={13}
                style={{
                  transform: poiMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.16s ease',
                  opacity: 0.8,
                }}
              />
            </button>

            {poiCategory !== 'all' && (
              <button
                type="button"
                onClick={() => handleSelectCategory('all')}
                className="poi-clear-btn"
                title="Mostrar todas las categorías"
                aria-label="Quitar filtro de lugares"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {poiMenuOpen && (
            <div
              className="poi-dropdown-menu animate-fade-in"
              role="menu"
              aria-label="Filtrar lugares de interés"
            >
              <div className="poi-dropdown-header">
                <span className="rq-section-label">Lugares de interés</span>
              </div>

              <button
                type="button"
                role="menuitemradio"
                aria-checked={poiCategory === 'all'}
                className={`poi-dropdown-item${poiCategory === 'all' ? ' active' : ''}`}
                style={{ '--chip-color': 'var(--brand)' }}
                onClick={() => handleSelectCategory('all')}
              >
                <Layers size={13} color="var(--brand)" />
                <span className="flex-1">Todos los lugares</span>
                {poiCategory === 'all' && <Check size={12} color="var(--brand)" />}
              </button>

              {POI_CHIP_ORDER.map((catId) => {
                const meta = POI_CATEGORIES[catId];
                const IconComp = ICON_COMPONENTS[meta.icon] || MapPin;
                const active = poiCategory === catId;
                return (
                  <button
                    key={catId}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={`poi-dropdown-item${active ? ' active' : ''}`}
                    style={{ '--chip-color': meta.color }}
                    onClick={() => handleSelectCategory(active ? 'all' : catId)}
                  >
                    <IconComp size={13} color={meta.color} />
                    <span className="flex-1">{meta.chip}</span>
                    {active && <Check size={12} color={meta.color} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Subtle zoom hint when zoomed out */}
      {showPOIs && mapZoom < 13.8 && !pinMode && !isLiveNav && !navigationResult && !selectedRoute && (
        <div className="map-hint-pill animate-fade-in">
          <MapPin size={12} color="var(--brand)" />
          <span>Acércate para ver más lugares en esta zona</span>
        </div>
      )}

      {/* Custom map control dock (top-right) */}
      <div ref={layersPopoverRef}>
        <div className={`map-dock${isLiveNav ? ' live-nav-offset' : ''}`} role="group" aria-label="Controles del mapa">
          <button
            type="button"
            className="map-dock-btn"
            onClick={handleZoomIn}
            title="Acercar"
            aria-label="Acercar mapa"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="map-dock-btn"
            onClick={handleZoomOut}
            title="Alejar"
            aria-label="Alejar mapa"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            className="map-dock-btn"
            onClick={handleResetNorth}
            title="Orientar al norte"
            aria-label="Orientar mapa al norte"
          >
            <Compass
              size={16}
              style={{
                transform: `rotate(${-Math.round(mapBearing)}deg)`,
                transition: 'transform 0.15s ease-out',
                color: Math.abs(mapBearing) > 2 || is3D ? 'var(--brand)' : undefined,
              }}
            />
          </button>

          <div className="map-dock-divider" />

          <button
            type="button"
            className={`map-dock-btn${is3D ? ' active-amber' : ''}`}
            onClick={handleToggle3D}
            title={is3D ? 'Vista 2D' : 'Vista 3D'}
            aria-label={is3D ? 'Cambiar a vista 2D' : 'Cambiar a vista 3D'}
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}
          >
            {is3D ? '2D' : '3D'}
          </button>
          <button
            type="button"
            className={`map-dock-btn${userPosition ? ' text-cyan' : ''}`}
            onClick={handleRecenterGPS}
            disabled={!userPosition}
            title={userPosition ? 'Centrar en mi ubicación' : 'Ubicación GPS no disponible'}
            aria-label="Centrar en mi ubicación"
          >
            <Crosshair size={16} />
          </button>
          <button
            type="button"
            id="map-layers-toggle-btn"
            className={`map-dock-btn${layersOpen || showTransmetroStops || showRoadSafety ? ' active-cyan' : ''}`}
            onClick={() => setLayersOpen((prev) => !prev)}
            title="Capas del mapa"
            aria-label="Configurar capas del mapa"
            style={{ position: 'relative' }}
          >
            <Layers size={16} />
            {(showTransmetroStops || showRoadSafety) && <span className="map-dock-indicator" />}
          </button>
        </div>

        {layersOpen && (
          <div
            className={`map-layers-popover animate-fade-in${isLiveNav ? ' live-nav-offset' : ''}`}
            role="dialog"
            aria-label="Capas del mapa"
          >
            <div className="map-layers-header">
              <span className="rq-section-label">Capas del mapa</span>
              <button
                type="button"
                onClick={() => setLayersOpen(false)}
                className="rq-icon-btn"
                style={{ width: 22, height: 22 }}
                aria-label="Cerrar menú de capas"
              >
                <X size={12} />
              </button>
            </div>

            <button
              type="button"
              id="layer-toggle-pois"
              onClick={() => setShowPOIs((prev) => !prev)}
              className="map-layer-row"
            >
              <div className="min-w-0 flex-1 text-left">
                <div className="map-layer-title">Puntos de interés</div>
                <div className="map-layer-sub">Lugares clave, comercios y salud</div>
              </div>
              <span className={`map-layer-switch${showPOIs ? ' active' : ''}`} />
            </button>

            <button
              type="button"
              id="layer-toggle-transmetro"
              onClick={() => onToggleTransmetroStops?.()}
              className="map-layer-row"
            >
              <div className="min-w-0 flex-1 text-left">
                <div className="map-layer-title flex items-center gap-1.5">
                  <span>Paraderos Transmetro</span>
                  {loadingTransmetroStops && <Loader2 size={11} className="animate-spin" color="var(--caribe)" />}
                </div>
                <div className="map-layer-sub">
                  {transmetroStops.length > 0
                    ? `${transmetroStops.length} paraderos · datos.gov.co (2020)`
                    : 'Catálogo oficial · datos.gov.co (2020)'}
                </div>
              </div>
              <span className={`map-layer-switch caribe${showTransmetroStops ? ' active' : ''}`} />
            </button>

            <button
              type="button"
              id="layer-toggle-safety"
              onClick={() => onToggleRoadSafety?.()}
              className="map-layer-row"
            >
              <div className="min-w-0 flex-1 text-left">
                <div className="map-layer-title flex items-center gap-1.5">
                  <span>Seguridad vial</span>
                  {loadingRoadSafety && <Loader2 size={11} className="animate-spin" color="var(--brand)" />}
                </div>
                <div className="map-layer-sub">
                  {roadSafetyPoints.length > 0
                    ? `${roadSafetyPoints.length} semáforos y cámaras · datos.gov.co`
                    : 'Semáforos y fotodetección · datos.gov.co'}
                </div>
              </div>
              <span className={`map-layer-switch brand${showRoadSafety ? ' active' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Floating selected-route legend & quick control bar */}
      {selectedRoute && !navigationResult && !pinMode && (
        <div
          className="selected-route-pill animate-slide-up"
          role="region"
          aria-label="Ruta seleccionada"
          style={{ '--route-color': safeColor(selectedRoute.color, '#FFC21A') }}
        >
          <div className="selected-route-pill-accent" style={{ background: safeColor(selectedRoute.color, '#FFC21A') }} />
          <div className="selected-route-pill-body">
            <div className="selected-route-pill-top">
              <div className="selected-route-pill-title-group">
                {selectedRoute.codigo && (
                  <span className="transit-code flex-shrink-0">{selectedRoute.codigo}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="selected-route-pill-name">
                    {selectedRoute.nombre && selectedRoute.nombre !== selectedRoute.codigo
                      ? selectedRoute.nombre
                      : selectedRoute.operador}
                  </div>
                  <div className="selected-route-pill-sub">
                    {selectedRoute.descripcion &&
                    selectedRoute.descripcion !== selectedRoute.nombre
                      ? `${selectedRoute.descripcion} · `
                      : ''}
                    {selectedRoute.operador}
                    {Number(selectedRoute.distanciaKm) > 0 && ` · ${Number(selectedRoute.distanciaKm).toFixed(1)} km`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {onOpenSidebarRoutes && (
                  <button
                    type="button"
                    onClick={onOpenSidebarRoutes}
                    className="selected-route-action md:hidden"
                    title="Ver horarios y detalles"
                  >
                    <PanelLeftOpen size={13} />
                    <span>Ficha</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onClearSelectedRoute?.()}
                  className="selected-route-close"
                  title="Cerrar ruta"
                  aria-label="Cerrar ruta seleccionada"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="selected-route-pill-footer">
              {loadingRouteId === selectedRoute._id ? (
                <span className="selected-route-loading">
                  <Loader2 size={12} className="animate-spin" />
                  Cargando trazado exacto...
                </span>
              ) : rawSelectedVueltaCoords ? (
                <div className="selected-route-dir-group" role="group" aria-label="Filtrar sentido de ruta">
                  <button
                    type="button"
                    className={`dir-chip${routeDirectionFilter === 'all' ? ' active' : ''}`}
                    onClick={() => setRouteDirectionFilter('all')}
                  >
                    Ida + Regreso
                  </button>
                  <button
                    type="button"
                    className={`dir-chip${routeDirectionFilter === 'ida' ? ' active-ida' : ''}`}
                    onClick={() => setRouteDirectionFilter('ida')}
                  >
                    <span className="dir-dot" style={{ background: 'var(--mangle)' }} />
                    Ida
                  </button>
                  <button
                    type="button"
                    className={`dir-chip${routeDirectionFilter === 'regreso' ? ' active-regreso' : ''}`}
                    onClick={() => setRouteDirectionFilter('regreso')}
                  >
                    <span className="dir-dot" style={{ background: 'var(--carnaval)' }} />
                    Regreso
                  </button>
                </div>
              ) : (
                <span className="selected-route-linear-badge">
                  <span className="dir-dot" style={{ background: 'var(--mangle)' }} />
                  Recorrido lineal único
                </span>
              )}

              {effectiveSelectedStopsInfo.stops.length > 0 && loadingRouteId !== selectedRoute._id && (
                <span className="selected-route-stops-badge tabular-nums">
                  <MapPin size={11} />
                  {effectiveSelectedStopsInfo.stops.length}{' '}
                  {effectiveSelectedStopsInfo.isOfficialStops ? 'paraderos' : 'paradas'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pin mode overlay label */}
      {pinMode && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] animate-slide-up"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--plate-bg)',
            color: '#F2EFE8',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid rgba(242,239,232,0.18)',
            borderLeft: `4px solid ${pinMode === 'origin' ? '#1F9D6B' : '#E5484D'}`,
            fontSize: 12.5,
            fontWeight: 600,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <MapPin size={14} color={pinMode === 'origin' ? '#1F9D6B' : '#E5484D'} />
          <span>Toca el mapa para marcar {pinMode === 'origin' ? 'el origen' : 'el destino'}</span>
        </div>
      )}
    </div>
  );
}
