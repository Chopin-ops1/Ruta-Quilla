/**
 * ============================================
 * RutaQuilla - POI Layer v3 (Mini-Labels)
 * ============================================
 * - DivIcon con SVG minimalista por categoría
 * - Nombre visible desde zoom 15 (no solo en hover)
 * - Solo aparece en zoom >= 15
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap, useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';
import {
  fetchPOIs,
  getCategoryColor,
  getCategoryLabel,
  POI_CATEGORIES,
} from '../services/poiService';

const MIN_ZOOM = 16;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — reduce Overpass rate-limit hits

// SVG icons per category (minimalista, stroke-based)
const CATEGORY_SVG = {
  restaurant:       `<path d="M12 2v7M8 6c0 2 2 4 4 4s4-2 4-4M6 21V12a6 6 0 0 1 12 0v9" stroke-width="2" stroke-linecap="round"/>`,
  cafe:             `<path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8zM6 2v3M10 2v3M14 2v3" stroke-width="2" stroke-linecap="round"/>`,
  fast_food:        `<path d="M3 11l19-9-9 19-2-8-8-2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  hospital:         `<path d="M8 12h8M12 8v8M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke-width="2" stroke-linecap="round"/>`,
  clinic:           `<path d="M8 12h8M12 8v8M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke-width="2" stroke-linecap="round"/>`,
  pharmacy:         `<path d="M12 2v20M2 12h20M7 7l10 10M17 7L7 17" stroke-width="2.5" stroke-linecap="round"/>`,
  university:       `<path d="M22 10v6M2 10l10-5 10 5-10 5-10-5zM6 12v5c3 3 9 3 12 0v-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  school:           `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  supermarket:      `<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  convenience:      `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-width="2"/>`,
  bank:             `<path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M16 10v11M20 10v11" stroke-width="2" stroke-linecap="round"/>`,
  atm:              `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20" stroke-width="2" stroke-linecap="round"/>`,
  fuel:             `<path d="M3 22V7l6-4v19M3 11h6M17 22V13a3 3 0 0 0-3-3h-2M15 2l3 3-3 3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  place_of_worship: `<path d="M12 2L3 7v13h18V7L12 2zM9 22V12h6v10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  police:           `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  parking:          `<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h5a3 3 0 0 1 0 6H9" stroke-width="2" stroke-linecap="round"/>`,
  hotel:            `<path d="M3 22V12M21 22V12M3 12a9 9 0 0 1 18 0M12 12V7M8 22v-4a4 4 0 0 1 8 0v4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  mall:             `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-width="2"/>`,
};

function buildPOIIcon(category, name, zoom) {
  const color = getCategoryColor(category);
  const svgPath = CATEGORY_SVG[category] || `<circle cx="12" cy="12" r="4" stroke-width="2"/>`;
  const showLabel = zoom >= 16;
  const label = name.length > 18 ? name.slice(0, 16) + '…' : name;

  const html = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      pointer-events: none;
    ">
      <div style="
        width: 26px; height: 26px;
        border-radius: 8px;
        background: rgba(10,14,26,0.92);
        border: 1.5px solid ${color}80;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 10px ${color}40, 0 0 0 1px rgba(255,255,255,0.04) inset;
        backdrop-filter: blur(4px);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${svgPath}
        </svg>
      </div>
      ${showLabel ? `
        <div style="
          white-space: nowrap;
          font-family: Inter, sans-serif;
          font-size: 9.5px;
          font-weight: 600;
          color: #F1F5F9;
          background: rgba(10,14,26,0.85);
          padding: 1.5px 5px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.08);
          letter-spacing: 0.01em;
          max-width: 90px;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        ">${label}</div>
      ` : ''}
    </div>
  `;

  return L.divIcon({
    className: '',
    html,
    iconSize: showLabel ? [26, 48] : [26, 26],
    iconAnchor: showLabel ? [13, 26] : [13, 13],
    popupAnchor: [0, -30],
  });
}

export default function POILayer() {
  const map = useMap();
  const [pois, setPois] = useState([]);
  const [visible, setVisible] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const fetchTimeoutRef = useRef(null);
  const lastBoundsRef = useRef(null);

  const loadPOIs = useCallback(async () => {
    const zoom = map.getZoom();
    setCurrentZoom(zoom);
    if (zoom < MIN_ZOOM) { setVisible(false); return; }

    setVisible(true);
    const bounds = map.getBounds();
    const key = `${bounds.getSouth().toFixed(3)},${bounds.getWest().toFixed(3)},${zoom}`;
    if (lastBoundsRef.current === key) return;
    lastBoundsRef.current = key;

    try {
      const data = await fetchPOIs({
        south: bounds.getSouth(), west: bounds.getWest(),
        north: bounds.getNorth(), east: bounds.getEast(),
      });
      setPois(data);
    } catch (err) {
      console.warn('POI load error:', err);
    }
  }, [map]);

  useMapEvents({
    moveend() {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(loadPOIs, 500);
    },
    zoomend() {
      const z = map.getZoom();
      setCurrentZoom(z);
      if (z < MIN_ZOOM) { setVisible(false); return; }
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(loadPOIs, 500);
    },
  });

  useEffect(() => {
    loadPOIs();
    return () => { if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current); };
  }, [loadPOIs]);

  if (!visible || pois.length === 0) return null;

  return (
    <>
      {pois.map(poi => (
        <Marker
          key={`poi-${poi.id}`}
          position={[poi.lat, poi.lng]}
          icon={buildPOIIcon(poi.category, poi.name, currentZoom)}
        />
      ))}
    </>
  );
}
