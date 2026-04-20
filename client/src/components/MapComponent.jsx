/**
 * ============================================
 * RutaQuilla - MapComponent (Motor de Mapa v3)
 * ============================================
 *
 * Mejoras v3:
 * - Mapa con labels de calles siempre visibles (stack de capas)
 * - Navegación sin paradas fijas: proyección geométrica
 * - Diferenciación visual ida vs vuelta en rutas
 * - Capa de POIs reales de Barranquilla (OpenStreetMap)
 *
 * Capas de navegación:
 * - Walking: línea azul punteada (OSRM foot)
 * - Bus: línea sólida del color de la ruta (segmento extraído del LineString)
 * - Marcadores: origen (verde), destino (rojo), subir/bajar (dinámicos)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapContainer, TileLayer, Polyline, Marker, Popup,
  Circle, CircleMarker, useMap, useMapEvents, Pane
} from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { getWalkingRoute, getMultiStopRoute } from '../services/routingService';
import POILayer from './POILayer';

const BARRANQUILLA_CENTER = [10.9685, -74.7813];
const DEFAULT_ZOOM = 13;

// ---- Icon factories ----

function createOriginIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      position: relative;
      animation: marker-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    ">
      <div style="
        position: absolute; top: -10px; left: -10px;
        width: 40px; height: 40px;
        border: 2px solid rgba(16, 185, 129, 0.4);
        border-radius: 50%;
        animation: origin-pulse-1 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute; top: -10px; left: -10px;
        width: 40px; height: 40px;
        border: 1.5px solid rgba(16, 185, 129, 0.25);
        border-radius: 50%;
        animation: origin-pulse-2 2s ease-out 0.8s infinite;
      "></div>
      <div style="
        width: 20px; height: 20px;
        background: radial-gradient(circle at 35% 35%, #34D399, #10B981, #059669);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 16px rgba(16, 185, 129, 0.6), 0 2px 8px rgba(0,0,0,0.3);
      "></div>
      <div style="
        position: absolute; top: 26px; left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        font-family: Inter, sans-serif;
        font-size: 10px; font-weight: 700;
        color: #10B981;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        letter-spacing: 0.03em;
      ">ORIGEN</div>
    </div>`,
    iconSize: [40, 50],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

function createDestinationIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      position: relative;
      animation: marker-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards;
      opacity: 0;
    ">
      <div style="
        position: absolute; top: -6px; left: -6px;
        width: 40px; height: 40px;
        border-radius: 8px;
        background: rgba(239, 68, 68, 0.15);
        animation: dest-glow 2s ease-in-out infinite;
        transform: rotate(45deg);
      "></div>
      <div style="
        width: 28px; height: 28px;
        background: linear-gradient(135deg, #F87171, #EF4444, #DC2626);
        border: 3px solid white;
        border-radius: 6px;
        box-shadow: 0 0 16px rgba(239, 68, 68, 0.6), 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        transform: rotate(45deg);
      ">
        <div style=\"width: 8px; height: 8px; background: white; border-radius: 50%; transform: rotate(-45deg);\"></div>
      </div>
      <div style="
        position: absolute; top: 34px; left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        font-family: Inter, sans-serif;
        font-size: 10px; font-weight: 700;
        color: #EF4444;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        letter-spacing: 0.03em;
      ">DESTINO</div>
    </div>`,
    iconSize: [40, 56],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

function createBoardAlightIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: ${color};
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      border: 2px solid white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      white-space: nowrap;
      font-family: Inter, sans-serif;
    ">${label}</div>`,
    iconSize: [60, 24],
    iconAnchor: [30, 12],
    popupAnchor: [0, -14],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="position: relative;">
      <div style="
        position: absolute; top: -6px; left: -6px;
        width: 28px; height: 28px;
        border: 2px solid rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: origin-pulse-1 2.5s ease-out infinite;
      "></div>
      <div style="
        position: absolute; top: -6px; left: -6px;
        width: 28px; height: 28px;
        border: 1.5px solid rgba(59, 130, 246, 0.2);
        border-radius: 50%;
        animation: origin-pulse-2 2.5s ease-out 1s infinite;
      "></div>
      <div style="
        width: 16px; height: 16px;
        background: radial-gradient(circle at 35% 35%, #60A5FA, #3B82F6, #2563EB);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 12px rgba(59, 130, 246, 0.6), 0 2px 6px rgba(0,0,0,0.3);
        animation: gps-breathe 3s ease-in-out infinite;
      "></div>
      <div style="
        position: absolute; top: 22px; left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        font-family: Inter, sans-serif;
        font-size: 9px; font-weight: 700;
        color: #60A5FA;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      ">TÚ</div>
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 14],
  });
}

function createSponsorIcon(color = '#F59E0B') {
  return L.divIcon({
    className: '',
    html: `<div class="sponsor-marker" style="border-color: ${color};">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

/**
 * Sub-component: handles map click.
 * In pinMode: directly sets the pin.
 * Otherwise: shows a contextual popup with "Set as origin" / "Set as destination".
 */
function MapClickHandler({ pinMode, onMapClick, onSetOrigin, onSetDestination }) {
  const map = useMap();

  useMapEvents({
    click(e) {
      const latlng = e.latlng;

      if (pinMode) {
        onMapClick?.({ lat: latlng.lat, lng: latlng.lng });
        return;
      }

      // Show contextual popup
      const popup = L.popup({
        className: 'context-popup',
        closeButton: false,
        minWidth: 180,
        maxWidth: 220,
        offset: [0, -5],
      })
        .setLatLng(latlng)
        .setContent(`
          <button class="ctx-btn" id="ctx-origin">
            <span class="ctx-btn-icon">📍</span>
            Origen desde aquí
          </button>
          <button class="ctx-btn" id="ctx-dest">
            <span class="ctx-btn-icon">🏁</span>
            Destino aquí
          </button>
        `)
        .openOn(map);

      // Attach event listeners after popup opens
      setTimeout(() => {
        document.getElementById('ctx-origin')?.addEventListener('click', () => {
          onSetOrigin?.({ lat: latlng.lat, lng: latlng.lng });
          map.closePopup(popup);
        });
        document.getElementById('ctx-dest')?.addEventListener('click', () => {
          onSetDestination?.({ lat: latlng.lat, lng: latlng.lng });
          map.closePopup(popup);
        });
      }, 50);
    },
  });
  return null;
}

/**
 * Sub-component: creates a custom Leaflet pane for labels layer.
 */
function LabelsPane() {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane('labels')) {
      const pane = map.createPane('labels');
      pane.style.zIndex = 650;
      pane.style.pointerEvents = 'none';
    }
  }, [map]);

  return null;
}

/**
 * Sub-component: fits map bounds when navigation result changes.
 */
function MapPositioner({ navigationResult, selectedRoute, walkToBoard, walkFromAlight, busSegment }) {
  const map = useMap();

  useEffect(() => {
    if (navigationResult?.origin && navigationResult?.destination) {
      const points = [
        [navigationResult.origin.lat, navigationResult.origin.lng],
        [navigationResult.destination.lat, navigationResult.destination.lng],
      ];
      if (walkToBoard?.length) points.push(...walkToBoard);
      if (walkFromAlight?.length) points.push(...walkFromAlight);
      if (busSegment?.length) points.push(...busSegment.map(c => [c[1], c[0]]));

      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
    } else if (selectedRoute?.ida?.trazado?.coordinates) {
      const coords = selectedRoute.ida.trazado.coordinates;
      const latLngs = coords.map(c => [c[1], c[0]]);
      // Also include vuelta coordinates if available
      if (selectedRoute.regreso?.trazado?.coordinates) {
        const vCoords = selectedRoute.regreso.trazado.coordinates;
        latLngs.push(...vCoords.map(c => [c[1], c[0]]));
      }
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [navigationResult, selectedRoute, walkToBoard, walkFromAlight, busSegment, map]);

  return null;
}

import 'leaflet-polylinedecorator';

/**
 * Sub-component: Draws a Polyline with directional arrows
 */
function DecoratedPolyline({ positions, color, opacity, children }) {
  const map = useMap();
  const polylineRef = useRef(null);
  const decoratorRef = useRef(null);

  // Guard: color must be a valid string, opacity must be a number
  const safeColor = (typeof color === 'string' && color.length > 0) ? color : '#06B6D4';
  const safeOpacity = (typeof opacity === 'number' && !isNaN(opacity)) ? opacity : 0.85;

  useEffect(() => {
    if (!polylineRef.current || !positions || positions.length < 2) return;

    // Clean up previous decorator
    if (decoratorRef.current) {
      try { map.removeLayer(decoratorRef.current); } catch (_) {}
      decoratorRef.current = null;
    }

    try {
      decoratorRef.current = L.polylineDecorator(polylineRef.current, {
        patterns: [
          {
            offset: '25px',
            repeat: '200px',
            symbol: L.Symbol.arrowHead({
              pixelSize: 14,
              headAngle: 55,
              polygon: false,
              pathOptions: {
                stroke: true,
                weight: 2.5,
                color: safeColor,
                opacity: safeOpacity,
                fillOpacity: 0,
              },
            }),
          },
        ],
      }).addTo(map);
    } catch (err) {
      console.warn('[DecoratedPolyline] Failed to create decorator:', err.message);
    }

    return () => {
      if (decoratorRef.current) {
        try { map.removeLayer(decoratorRef.current); } catch (_) {}
        decoratorRef.current = null;
      }
    };
  }, [map, positions, safeColor, safeOpacity]);

  return (
    <Polyline
      ref={polylineRef}
      positions={positions}
      pathOptions={{ color: safeColor, weight: 4, opacity: safeOpacity, lineCap: 'round', lineJoin: 'round' }}
    >
      {children}
    </Polyline>
  );
}

export default function MapComponent({
  navigationResult,
  selectedRoute,
  selectedOptionIdx = 0,
  sponsoredLocations = [],
  gpsTrack = [],
  userPosition,
  isCapturing,
  pinMode,
  onMapClick,
}) {
  const { isPremium } = useAuth();

  // Walking route geometries (fetched from OSRM)
  const [walkToBoard, setWalkToBoard] = useState([]);
  const [walkFromAlight, setWalkFromAlight] = useState([]);

  const currentOption = navigationResult?.options?.[selectedOptionIdx];

  // Stable key for the current navigation
  const navKey = currentOption
    ? `${navigationResult.origin.lat},${navigationResult.origin.lng}-${navigationResult.destination.lat},${navigationResult.destination.lng}-${selectedOptionIdx}`
    : null;

  // Fetch OSRM walking routes when navigation result changes
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

        // Walking: origin → board point on the route
        const walkIn = await getWalkingRoute(
          orig.lat, orig.lng,
          opt.boardPoint.coordinates[1], opt.boardPoint.coordinates[0]
        );

        // Walking: alight point → destination
        const walkOut = await getWalkingRoute(
          opt.alightPoint.coordinates[1], opt.alightPoint.coordinates[0],
          dest.lat, dest.lng
        );

        if (!cancelled) {
          setWalkToBoard(walkIn.coordinates);
          setWalkFromAlight(walkOut.coordinates);
        }
      } catch (err) {
        console.error('❌ OSRM fetch error:', err);
      }
    }

    fetchRoutes();
    return () => { cancelled = true; };
  }, [navKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map-matching for bus segment to snap to roads instead of cutting corners
  const [smoothedBusSegment, setSmoothedBusSegment] = useState([]);
  
  useEffect(() => {
    if (!currentOption?.busSegment || currentOption.busSegment.length < 2) {
      setSmoothedBusSegment([]);
      return;
    }
    
    let cancelled = false;
    async function matchBusRoute() {
      // busSegment comes as [lng, lat], convert to [lat, lng] for routing service
      const rawLatLng = currentOption.busSegment.map(c => [c[1], c[0]]);
      
      // If we have very few points, it's sparse waypoints that will cut corners through buildings.
      // We ask OSRM to snap it to roads. If it has too many points (> 80), it's already dense enough.
      if (rawLatLng.length < 80) {
        try {
          const matched = await getMultiStopRoute(rawLatLng);
          if (!cancelled && matched.coordinates?.length) {
            setSmoothedBusSegment(matched.coordinates);
            return;
          }
        } catch (err) {
          console.warn('Map matching for bus segment failed, using raw coordinates');
        }
      }
      
      // Fallback: use raw
      if (!cancelled) setSmoothedBusSegment(rawLatLng);
    }
    matchBusRoute();
    return () => { cancelled = true; };
  }, [currentOption?.busSegment]);

  // Selected route preview — show raw immediately, then upgrade to OSRM-smoothed
  const [smoothedSelectedRouteIda, setSmoothedSelectedRouteIda] = useState([]);
  const [smoothedSelectedRouteVuelta, setSmoothedSelectedRouteVuelta] = useState([]);

  useEffect(() => {
    if (navigationResult || !selectedRoute) {
      setSmoothedSelectedRouteIda([]);
      setSmoothedSelectedRouteVuelta([]);
      return;
    }

    // ---- Show raw coordinates IMMEDIATELY so user sees lines right away ----
    const rawIda = selectedRoute.ida?.trazado?.coordinates?.map(c => [c[1], c[0]]) || [];
    const rawVuelta = selectedRoute.regreso?.trazado?.coordinates?.map(c => [c[1], c[0]]) || [];
    setSmoothedSelectedRouteIda(rawIda);
    setSmoothedSelectedRouteVuelta(rawVuelta);

    // ---- Then async upgrade to OSRM-snapped roads ----
    let cancelled = false;
    async function matchSelectedRoute() {
      try {
        let idaFinished = rawIda;
        if (rawIda.length >= 2 && rawIda.length < 80) {
          const matched = await getMultiStopRoute(rawIda);
          if (matched.coordinates?.length > 1) idaFinished = matched.coordinates;
        }

        let vueltaFinished = rawVuelta;
        if (rawVuelta.length >= 2 && rawVuelta.length < 80) {
          const matched = await getMultiStopRoute(rawVuelta);
          if (matched.coordinates?.length > 1) vueltaFinished = matched.coordinates;
        }

        if (!cancelled) {
          setSmoothedSelectedRouteIda(idaFinished);
          setSmoothedSelectedRouteVuelta(vueltaFinished);
        }
      } catch (err) {
        console.warn('OSRM route matching failed, keeping raw', err.message);
      }
    }
    matchSelectedRoute();
    return () => { cancelled = true; };
  }, [selectedRoute, navigationResult]);

  // Nav option bus segment: show raw immediately, upgrade async
  const busSegmentLatLng = currentOption?.busSegment?.map(c => [c[1], c[0]]) || [];
  const activeDisplayBusSegment = smoothedBusSegment.length > 1 ? smoothedBusSegment : busSegmentLatLng;

  return (
    <div className="w-full h-full" style={{ cursor: pinMode ? 'crosshair' : undefined }}>
      <MapContainer
        center={BARRANQUILLA_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={true}
        attributionControl={true}
      >
        {/* Base map: dark tiles WITHOUT labels */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          maxZoom={19}
          subdomains="abcd"
        />

        {/* Create labels pane on top of everything */}
        <LabelsPane />

        {/* Labels layer: ALWAYS on top of polylines */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          maxZoom={19}
          subdomains="abcd"
          pane="labels"
        />

        <MapClickHandler pinMode={pinMode} onMapClick={onMapClick} />
        <MapPositioner
          navigationResult={navigationResult}
          selectedRoute={!navigationResult ? selectedRoute : null}
          walkToBoard={walkToBoard}
          walkFromAlight={walkFromAlight}
          busSegment={currentOption?.busSegment}
        />

        {/* ======= POI LAYER ======= */}
        <POILayer />

        {/* ======= NAVIGATION MODE ======= */}
        {navigationResult && currentOption && (
          <>
            {/* Walking: origin → board point */}
            {walkToBoard.length > 1 && (
              <Polyline
                positions={walkToBoard}
                pathOptions={{
                  color: '#60A5FA',
                  weight: 4,
                  opacity: 0.9,
                  dashArray: '6, 10',
                  lineCap: 'round',
                }}
              >
                <Popup>
                  <div>
                    <strong>🚶 Caminar hasta la ruta</strong>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                      {currentOption.boardPoint.walkDistance}m (~{currentOption.boardPoint.walkMinutes} min)
                    </div>
                  </div>
                </Popup>
              </Polyline>
            )}

            {/* Bus segment (the exact path the bus follows) */}
            {activeDisplayBusSegment.length > 1 && (
              <Polyline
                positions={activeDisplayBusSegment}
                pathOptions={{
                  color: currentOption.route.color,
                  weight: 5,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                  smoothFactor: 0.5,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: currentOption.route.color,
                      }} />
                      <strong style={{ fontSize: 14 }}>{currentOption.route.name}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                      <div>🚌 {currentOption.route.company}</div>
                      <div>📍 Dirección: {currentOption.direction === 'ida' ? 'Ida' : 'Vuelta'}</div>
                      <div>💰 ${currentOption.route.fare?.toLocaleString()} COP</div>
                    </div>
                  </div>
                </Popup>
              </Polyline>
            )}

            {/* Walking: alight point → destination */}
            {walkFromAlight.length > 1 && (
              <Polyline
                positions={walkFromAlight}
                pathOptions={{
                  color: '#60A5FA',
                  weight: 4,
                  opacity: 0.9,
                  dashArray: '6, 10',
                  lineCap: 'round',
                }}
              >
                <Popup>
                  <div>
                    <strong>🚶 Caminar al destino</strong>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                      {currentOption.alightPoint.walkDistance < 50
                        ? 'El bus pasa frente a tu destino 🎯'
                        : `${currentOption.alightPoint.walkDistance}m (~${currentOption.alightPoint.walkMinutes} min)`
                      }
                    </div>
                  </div>
                </Popup>
              </Polyline>
            )}

            {/* Origin marker (green) */}
            <Marker
              position={[navigationResult.origin.lat, navigationResult.origin.lng]}
              icon={createOriginIcon()}
            >
              <Popup><strong>📍 Tu origen</strong></Popup>
            </Marker>

            {/* Destination marker (red) */}
            <Marker
              position={[navigationResult.destination.lat, navigationResult.destination.lng]}
              icon={createDestinationIcon()}
            >
              <Popup><strong>🏁 Tu destino</strong></Popup>
            </Marker>

            {/* Board point marker (dynamic — "Sube aquí") */}
            <Marker
              position={[currentOption.boardPoint.coordinates[1], currentOption.boardPoint.coordinates[0]]}
              icon={createBoardAlightIcon(currentOption.route.color, '🚌 Sube aquí')}
            >
              <Popup>
                <div>
                  <strong>🚌 Toma el bus aquí</strong>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    {currentOption.route.name} ({currentOption.direction === 'ida' ? 'Ida' : 'Vuelta'})
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Alight point marker (dynamic — "Baja aquí") */}
            <Marker
              position={[currentOption.alightPoint.coordinates[1], currentOption.alightPoint.coordinates[0]]}
              icon={createBoardAlightIcon('#EF4444', '🛑 Baja aquí')}
            >
              <Popup>
                <div>
                  <strong>🛑 Bájate aquí</strong>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    {currentOption.alightPoint.walkDistance < 50
                      ? 'Estás frente a tu destino'
                      : `Camina ${currentOption.alightPoint.walkDistance}m al destino`
                    }
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* ======= SINGLE ROUTE PREVIEW (IDA + VUELTA) ======= */}
        {!navigationResult && selectedRoute && (
          <>
            {/* IDA: Green #2ECC71 with arrows */}
            {smoothedSelectedRouteIda.length > 1 && (
              <DecoratedPolyline
                positions={smoothedSelectedRouteIda}
                color="#2ECC71"
                opacity={0.8}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: "#2ECC71",
                      }} />
                      <strong style={{ fontSize: 14 }}>{selectedRoute.nombre}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                      <div>🚌 {selectedRoute.operador} — <span style={{ color: "#2ECC71", fontWeight: 600 }}>IDA</span></div>
                      {selectedRoute.codigo && <div>🔢 Código: {selectedRoute.codigo}</div>}
                      {selectedRoute.origen && <div>📍 Origen: {selectedRoute.origen}</div>}
                      <div>💰 ${selectedRoute.fare?.toLocaleString() || '2,600'} COP</div>
                    </div>
                  </div>
                </Popup>
              </DecoratedPolyline>
            )}

            {/* VUELTA: Red #E74C3C with arrows */}
            {smoothedSelectedRouteVuelta.length > 1 && (
              <DecoratedPolyline
                positions={smoothedSelectedRouteVuelta}
                color="#E74C3C"
                opacity={0.8}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: "#E74C3C",
                      }} />
                      <strong style={{ fontSize: 14 }}>{selectedRoute.nombre}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                      <div>🚌 {selectedRoute.operador} — <span style={{ color: "#E74C3C", fontWeight: 600 }}>VUELTA</span></div>
                      {selectedRoute.destino && <div>📍 Destino: {selectedRoute.destino}</div>}
                      <div>💰 ${selectedRoute.fare?.toLocaleString() || '2,600'} COP</div>
                    </div>
                  </div>
                </Popup>
              </DecoratedPolyline>
            )}

            {/* Route direction indicators: start and end markers */}
            {selectedRoute.ida?.trazado?.coordinates?.length > 0 && (
              <>
                <Marker
                  position={[
                    selectedRoute.ida.trazado.coordinates[0][1],
                    selectedRoute.ida.trazado.coordinates[0][0],
                  ]}
                  icon={createBoardAlightIcon(selectedRoute.color || '#06B6D4', '🏁 Nevada (Inicio)')}
                />
                <Marker
                  position={[
                    selectedRoute.ida.trazado.coordinates[selectedRoute.ida.trazado.coordinates.length - 1][1],
                    selectedRoute.ida.trazado.coordinates[selectedRoute.ida.trazado.coordinates.length - 1][0],
                  ]}
                  icon={createBoardAlightIcon(selectedRoute.color || '#06B6D4', '🔄 Fin / Retorno')}
                />
              </>
            )}
          </>
        )}

        {/* ======= SPONSORED MARKERS ======= */}
        {!isPremium && sponsoredLocations.map(sponsor => (
          <Marker
            key={sponsor.id}
            position={[sponsor.coordinates[1], sponsor.coordinates[0]]}
            icon={createSponsorIcon(sponsor.color)}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{
                    background: sponsor.color, color: '#000',
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  }}>{sponsor.promo}</span>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>PATROCINADO</span>
                </div>
                <strong style={{ fontSize: 14 }}>{sponsor.name}</strong>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{sponsor.description}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ======= GPS TRACKING ======= */}
        {gpsTrack.length > 1 && (
          <Polyline
            positions={gpsTrack.map(p => [p.lat, p.lng])}
            pathOptions={{
              color: '#EF4444', weight: 4, opacity: 0.9,
              dashArray: isCapturing ? '4, 8' : null,
            }}
          />
        )}

        {userPosition && (
          <Marker
            position={[userPosition.lat, userPosition.lng]}
            icon={createUserIcon()}
          >
            <Popup>
              <div>
                <strong>Tu posición</strong>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  Precisión: {userPosition.accuracy?.toFixed(0)}m
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Pin mode overlay label */}
      {pinMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] animate-slide-up"
          style={{
            background: pinMode === 'origin'
              ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
            color: '#fff',
            padding: '8px 20px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
          📌 Toca el mapa para marcar {pinMode === 'origin' ? 'el origen' : 'el destino'}
        </div>
      )}
    </div>
  );
}
