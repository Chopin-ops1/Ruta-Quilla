/**
 * ============================================
 * RutaQuilla - Panel de Administración
 * ============================================
 *
 * Página exclusiva para admins que permite:
 * - Trazar rutas manualmente en el mapa (click para agregar puntos)
 * - Snap to Roads automático (Google Roads API)
 * - CRUD completo de rutas oficiales
 * - Vista previa en tiempo real del trazado
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents, Popup, CircleMarker
} from 'react-leaflet';
import L from 'leaflet';
import {
  Plus, Trash2, Save, Undo2, ArrowLeft, Route, Bus, Palette,
  MousePointer, MapPin, Zap, CheckCircle2, AlertTriangle,
  ChevronDown, Edit3, X, RotateCcw, Navigation
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { routesAPI, adminRoutesAPI } from '../services/api';
import { snapToRoads, reverseGeocode } from '../services/routingService';

const BARRANQUILLA_CENTER = [10.9685, -74.7813];
const DEFAULT_ZOOM = 13;

const OPERATOR_COLORS = {
  'Coolitoral': '#06B6D4',
  'Sobusa': '#F59E0B',
  'Transmecar': '#10B981',
  'Cootransnorte': '#8B5CF6',
  'Embusa': '#EC4899',
  'Flota Angulo': '#F97316',
  'Sodis': '#A855F7',
  'Lolaya': '#EF4444',
  'Lucero San Felipe': '#F472B6',
  'Coochofal': '#14B8A6',
  'Cootrasol': '#22D3EE',
  'La Carolina': '#818CF8',
};

function createPointIcon(index, color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 22px; height: 22px; border-radius: 50%;
      background: ${color}; border: 2px solid white;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: #000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      font-family: Inter, sans-serif;
    ">${index + 1}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * Map click handler for adding route points
 */
function AdminMapClick({ onAddPoint, isDrawing }) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

/**
 * Fit bounds only when explicitly requested (e.g. loading an existing route).
 * Does NOT auto-fit when adding individual points — that was causing the zoom reset bug.
 */
function AdminMapFit({ points, shouldFit }) {
  const map = useMap();
  useEffect(() => {
    if (shouldFit && points.length >= 2) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }, [shouldFit]); // Only react to shouldFit changes, not point changes
  return null;
}

export default function AdminPanel({ onBack }) {
  const { user } = useAuth();

  // Route list
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  // Editor state
  const [editMode, setEditMode] = useState('idle'); // 'idle' | 'ida' | 'regreso'
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [idaPoints, setIdaPoints] = useState([]);
  const [regresoPoints, setRegresoPoints] = useState([]);
  const [snappedIda, setSnappedIda] = useState([]);
  const [snappedRegreso, setSnappedRegreso] = useState([]);
  const [isSnapping, setIsSnapping] = useState(false);

  // Route metadata
  const [nombre, setNombre] = useState('');
  const [operador, setOperador] = useState('Coolitoral');
  const [color, setColor] = useState('#06B6D4');
  const [fare, setFare] = useState(2600);
  const [codigo, setCodigo] = useState('');

  // UI
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [shouldFitMap, setShouldFitMap] = useState(false);

  // Load routes
  const loadRoutes = useCallback(async () => {
    try {
      setLoadingRoutes(true);
      const res = await routesAPI.getAll();
      setRoutes(res.data || []);
    } catch (err) {
      console.error('Error loading routes:', err);
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  // Set color when operator changes
  useEffect(() => {
    if (OPERATOR_COLORS[operador]) {
      setColor(OPERATOR_COLORS[operador]);
    }
  }, [operador]);

  const activePoints = editMode === 'regreso' ? regresoPoints : idaPoints;
  const setActivePoints = editMode === 'regreso' ? setRegresoPoints : setIdaPoints;

  const handleAddPoint = useCallback((point) => {
    if (editMode === 'idle') return;
    setActivePoints(prev => [...prev, point]);
    // Clear snapped when raw points change
    if (editMode === 'ida') setSnappedIda([]);
    else setSnappedRegreso([]);
  }, [editMode, setActivePoints]);

  const handleUndo = useCallback(() => {
    setActivePoints(prev => prev.slice(0, -1));
    if (editMode === 'ida') setSnappedIda([]);
    else setSnappedRegreso([]);
  }, [editMode, setActivePoints]);

  const handleSnapToRoads = useCallback(async () => {
    const points = editMode === 'ida' ? idaPoints : regresoPoints;
    if (points.length < 2) return;

    setIsSnapping(true);
    try {
      const snapped = await snapToRoads(points, true);
      if (editMode === 'ida') setSnappedIda(snapped);
      else setSnappedRegreso(snapped);
      showMessage('✅ Puntos ajustados a las calles', 'success');
    } catch (err) {
      showMessage('❌ Error al ajustar puntos', 'error');
    } finally {
      setIsSnapping(false);
    }
  }, [editMode, idaPoints, regresoPoints]);

  const handleSave = useCallback(async () => {
    if (!nombre || !operador) {
      showMessage('⚠️ Nombre y operador son requeridos', 'error');
      return;
    }

    // Use snapped points if available, otherwise raw points
    const idaCoords = (snappedIda.length > 1 ? snappedIda : idaPoints)
      .map(p => [p.lng, p.lat]); // GeoJSON: [lng, lat]
    const regresoCoords = (snappedRegreso.length > 1 ? snappedRegreso : regresoPoints)
      .map(p => [p.lng, p.lat]);

    if (idaCoords.length < 2) {
      showMessage('⚠️ Se necesitan al menos 2 puntos en la ruta de ida', 'error');
      return;
    }

    setSaving(true);
    try {
      const routeData = {
        nombre,
        operador,
        color,
        fare,
        codigo: codigo || undefined,
        ida: { trazado: { coordinates: idaCoords } },
        regreso: regresoCoords.length >= 2
          ? { trazado: { coordinates: regresoCoords } }
          : undefined,
      };

      if (editingRouteId) {
        await adminRoutesAPI.update(editingRouteId, routeData);
        showMessage('✅ Ruta actualizada exitosamente', 'success');
      } else {
        await adminRoutesAPI.create(routeData);
        showMessage('✅ Ruta creada exitosamente', 'success');
      }

      // Reset editor
      resetEditor();
      loadRoutes();
    } catch (err) {
      showMessage(`❌ Error: ${err.message || 'No se pudo guardar'}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [nombre, operador, color, fare, codigo, idaPoints, regresoPoints, snappedIda, snappedRegreso, editingRouteId, loadRoutes]);

  const handleDelete = useCallback(async (id) => {
    try {
      await adminRoutesAPI.delete(id);
      showMessage('🗑️ Ruta eliminada', 'success');
      setShowDeleteConfirm(null);
      loadRoutes();
    } catch (err) {
      showMessage('❌ Error al eliminar', 'error');
    }
  }, [loadRoutes]);

  const handleEdit = useCallback((route) => {
    setEditingRouteId(route._id);
    setNombre(route.nombre || '');
    setOperador(route.operador || 'Coolitoral');
    setColor(route.color || '#06B6D4');
    setFare(route.fare || 2600);
    setCodigo(route.codigo || '');

    // Load existing coordinates into points
    const idaCoords = route.ida?.trazado?.coordinates || [];
    setIdaPoints(idaCoords.map(c => ({ lat: c[1], lng: c[0] })));
    setSnappedIda([]);

    const regCoords = route.regreso?.trazado?.coordinates || [];
    setRegresoPoints(regCoords.map(c => ({ lat: c[1], lng: c[0] })));
    setSnappedRegreso([]);

    setEditMode('ida');
    // Trigger map fit to show the loaded route
    setShouldFitMap(true);
    setTimeout(() => setShouldFitMap(false), 500);
  }, []);

  const resetEditor = useCallback(() => {
    setEditMode('idle');
    setEditingRouteId(null);
    setIdaPoints([]);
    setRegresoPoints([]);
    setSnappedIda([]);
    setSnappedRegreso([]);
    setNombre('');
    setOperador('Coolitoral');
    setColor('#06B6D4');
    setFare(2600);
    setCodigo('');
  }, []);

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Determine what to draw on map
  const idaDisplay = snappedIda.length > 1
    ? snappedIda.map(p => [p.lat, p.lng])
    : idaPoints.map(p => [p.lat, p.lng]);

  const regresoDisplay = snappedRegreso.length > 1
    ? snappedRegreso.map(p => [p.lat, p.lng])
    : regresoPoints.map(p => [p.lat, p.lng]);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', background: 'var(--bg-dark)' }}>
      {/* ======= LEFT PANEL ======= */}
      <div style={{
        width: 380, flexShrink: 0, height: '100%', overflowY: 'auto',
        background: 'rgba(11, 17, 32, 0.95)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <button
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: '#94A3B8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
              Admin <span style={{ color: '#F59E0B' }}>Panel</span>
            </h1>
            <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>{user?.email}</p>
          </div>
        </div>

        {/* Route Editor Form */}
        <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            {editingRouteId ? '✏️ Editando Ruta' : '🆕 Nueva Ruta'}
          </p>

          {/* Nombre */}
          <input
            type="text" placeholder="Nombre de la ruta" value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)', color: '#F1F5F9', fontSize: 13, outline: 'none', marginBottom: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          />

          {/* Operador + Color */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select
              value={operador} onChange={e => setOperador(e.target.value)}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12,
                background: 'rgba(255,255,255,0.04)', color: '#F1F5F9',
                border: '1px solid rgba(255,255,255,0.08)', outline: 'none',
              }}
            >
              {Object.keys(OPERATOR_COLORS).map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
              <option value="Otra">Otra empresa</option>
            </select>
            <input
              type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ width: 42, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent' }}
            />
          </div>

          {/* Fare + Código */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="number" placeholder="Tarifa" value={fare}
              onChange={e => setFare(parseInt(e.target.value) || 0)}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12,
                background: 'rgba(255,255,255,0.04)', color: '#F1F5F9',
                border: '1px solid rgba(255,255,255,0.08)', outline: 'none',
              }}
            />
            <input
              type="text" placeholder="Código (ej: C10)" value={codigo}
              onChange={e => setCodigo(e.target.value)}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 12,
                background: 'rgba(255,255,255,0.04)', color: '#F1F5F9',
                border: '1px solid rgba(255,255,255,0.08)', outline: 'none',
              }}
            />
          </div>

          {/* Drawing mode tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[
              { mode: 'ida', label: 'Trazar Ida', color: '#2ECC71', count: idaPoints.length },
              { mode: 'regreso', label: 'Trazar Vuelta', color: '#E74C3C', count: regresoPoints.length },
            ].map(tab => (
              <button
                key={tab.mode}
                onClick={() => setEditMode(tab.mode)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: editMode === tab.mode
                    ? `${tab.color}20`
                    : 'rgba(255,255,255,0.04)',
                  color: editMode === tab.mode ? tab.color : '#64748B',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderColor: editMode === tab.mode ? `${tab.color}50` : 'transparent',
                  borderWidth: 1, borderStyle: 'solid',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Drawing instructions */}
          {editMode !== 'idle' && (
            <div style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 10,
              background: editMode === 'ida' ? 'rgba(46,204,113,0.08)' : 'rgba(231,76,60,0.08)',
              border: `1px solid ${editMode === 'ida' ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.2)'}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <MousePointer size={13} style={{ color: editMode === 'ida' ? '#2ECC71' : '#E74C3C', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#94A3B8' }}>
                Haz clic en el mapa para agregar puntos a la ruta de <strong style={{ color: editMode === 'ida' ? '#2ECC71' : '#E74C3C' }}>{editMode === 'ida' ? 'IDA' : 'VUELTA'}</strong>
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={handleUndo}
              disabled={activePoints.length === 0}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)', color: '#94A3B8', fontSize: 11,
                cursor: activePoints.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 5,
                opacity: activePoints.length ? 1 : 0.4,
              }}
            >
              <Undo2 size={12} /> Deshacer
            </button>

            <button
              onClick={handleSnapToRoads}
              disabled={activePoints.length < 2 || isSnapping}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)',
                background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontSize: 11,
                cursor: activePoints.length >= 2 ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 5,
                opacity: activePoints.length >= 2 ? 1 : 0.4,
              }}
            >
              <Zap size={12} /> {isSnapping ? 'Ajustando...' : 'Snap to Roads'}
            </button>

            <button
              onClick={resetEditor}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 11,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || idaPoints.length < 2 || !nombre}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none', marginTop: 12,
              background: (saving || idaPoints.length < 2 || !nombre)
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: (saving || idaPoints.length < 2 || !nombre) ? '#475569' : '#000',
              fontSize: 13, fontWeight: 700, cursor: (saving || idaPoints.length < 2 || !nombre) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: (saving || idaPoints.length < 2 || !nombre) ? 'none' : '0 4px 16px rgba(245,158,11,0.3)',
            }}
          >
            <Save size={14} /> {saving ? 'Guardando...' : (editingRouteId ? 'Actualizar Ruta' : 'Guardar Ruta')}
          </button>
        </div>

        {/* Route List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            📋 Rutas existentes ({routes.length})
          </p>

          {loadingRoutes ? (
            <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 20 }}>Cargando...</p>
          ) : routes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Route size={28} style={{ color: '#334155', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 12, color: '#475569' }}>No hay rutas. ¡Crea la primera!</p>
            </div>
          ) : (
            routes.map(route => (
              <div key={route._id} style={{
                marginBottom: 6, borderRadius: 12, overflow: 'hidden',
                background: expandedRoute === route._id ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${expandedRoute === route._id ? (route.color || '#333') + '40' : 'rgba(255,255,255,0.05)'}`,
                transition: 'all 0.2s',
              }}>
                <button
                  onClick={() => setExpandedRoute(expandedRoute === route._id ? null : route._id)}
                  style={{
                    width: '100%', padding: '10px 12px', border: 'none', background: 'none',
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: route.color || '#6B7280',
                    boxShadow: `0 0 8px ${(route.color || '#6B7280')}60`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {route.nombre}
                    </p>
                    <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>{route.operador}</p>
                  </div>
                  <ChevronDown size={12} style={{
                    color: '#475569', flexShrink: 0,
                    transform: expandedRoute === route._id ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }} />
                </button>

                {expandedRoute === route._id && (
                  <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleEdit(route)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.2)',
                        background: 'rgba(6,182,212,0.08)', color: '#06B6D4', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      <Edit3 size={11} /> Editar
                    </button>
                    {showDeleteConfirm === route._id ? (
                      <>
                        <button
                          onClick={() => handleDelete(route._id)}
                          style={{
                            flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
                            background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          style={{
                            padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)', color: '#94A3B8', fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(route._id)}
                        style={{
                          padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
                          background: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 11,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ======= MAP ======= */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={BARRANQUILLA_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            maxZoom={19}
            subdomains="abcd"
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            maxZoom={19}
            subdomains="abcd"
          />

          <AdminMapClick onAddPoint={handleAddPoint} isDrawing={editMode !== 'idle'} />
          <AdminMapFit points={editMode === 'ida' ? idaPoints : regresoPoints} shouldFit={shouldFitMap} />

          {/* IDA polyline */}
          {idaDisplay.length > 1 && (
            <Polyline
              positions={idaDisplay}
              pathOptions={{ color: '#2ECC71', weight: 4, opacity: 0.85, dashArray: snappedIda.length > 1 ? null : '8, 8' }}
            />
          )}

          {/* REGRESO polyline */}
          {regresoDisplay.length > 1 && (
            <Polyline
              positions={regresoDisplay}
              pathOptions={{ color: '#E74C3C', weight: 4, opacity: 0.85, dashArray: snappedRegreso.length > 1 ? null : '8, 8' }}
            />
          )}

          {/* Raw click markers (IDA) */}
          {editMode === 'ida' && idaPoints.map((p, i) => (
            <Marker key={`ida-${i}`} position={[p.lat, p.lng]} icon={createPointIcon(i, '#2ECC71')}>
              <Popup><span style={{ fontSize: 11 }}>Ida punto {i + 1}</span></Popup>
            </Marker>
          ))}

          {/* Raw click markers (REGRESO) */}
          {editMode === 'regreso' && regresoPoints.map((p, i) => (
            <Marker key={`reg-${i}`} position={[p.lat, p.lng]} icon={createPointIcon(i, '#E74C3C')}>
              <Popup><span style={{ fontSize: 11 }}>Vuelta punto {i + 1}</span></Popup>
            </Marker>
          ))}

          {/* Existing routes preview */}
          {editMode === 'idle' && routes.map(route => {
            const idaCoords = route.ida?.trazado?.coordinates;
            if (!idaCoords?.length) return null;
            return (
              <Polyline
                key={route._id}
                positions={idaCoords.map(c => [c[1], c[0]])}
                pathOptions={{ color: route.color || '#666', weight: 3, opacity: 0.5 }}
              >
                <Popup><strong>{route.nombre}</strong><br /><span style={{ fontSize: 11 }}>{route.operador}</span></Popup>
              </Polyline>
            );
          })}
        </MapContainer>

        {/* Crosshair overlay when drawing */}
        {editMode !== 'idle' && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', zIndex: 1000,
            width: 30, height: 30,
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: 0, right: 0, height: 1,
              background: editMode === 'ida' ? 'rgba(46,204,113,0.4)' : 'rgba(231,76,60,0.4)',
            }} />
            <div style={{
              position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1,
              background: editMode === 'ida' ? 'rgba(46,204,113,0.4)' : 'rgba(231,76,60,0.4)',
            }} />
          </div>
        )}

        {/* Status bar */}
        {editMode !== 'idle' && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, padding: '8px 18px', borderRadius: 12,
            background: editMode === 'ida' ? 'rgba(46,204,113,0.9)' : 'rgba(231,76,60,0.9)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <MapPin size={14} />
            Trazando {editMode === 'ida' ? 'IDA' : 'VUELTA'} — {activePoints.length} puntos
          </div>
        )}

        {/* Toast message */}
        {message && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1100, padding: '10px 20px', borderRadius: 12,
            background: message.type === 'error' ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.3s ease-out forwards',
          }}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
