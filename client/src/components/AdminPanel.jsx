/**
 * ============================================
 * RutaQuilla - Admin Panel v2 (Multi-Tab)
 * ============================================
 *
 * Centro de control con 4 secciones:
 * 1. Dashboard — stats, tráfico, actividad
 * 2. Capturas — verificación de rutas comunitarias
 * 3. Editor — trazar/editar rutas oficiales
 * 4. Usuarios — gestión de cuentas
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents, Popup, CircleMarker
} from 'react-leaflet';
import L from 'leaflet';
import {
  Plus, Trash2, Save, Undo2, ArrowLeft, Route, Bus, Palette,
  MousePointer, MapPin, Zap, CheckCircle2, AlertTriangle,
  ChevronDown, Edit3, X, RotateCcw, Navigation,
  LayoutDashboard, Radar, Users, Map
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { routesAPI, adminRoutesAPI } from '../services/api';
import { snapToRoads, reverseGeocode } from '../services/routingService';

// Lazy sub-tabs
import DashboardTab from './admin/DashboardTab';
import CapturesTab from './admin/CapturesTab';
import UsersTab from './admin/UsersTab';
import ReportsTab from './ReportsTab';

const BARRANQUILLA_CENTER = [10.9685, -74.7813];
const DEFAULT_ZOOM = 13;

const OPERATOR_COLORS = {
  'Coolitoral': '#06B6D4', 'Sobusa': '#F59E0B', 'Transmecar': '#10B981',
  'Cootransnorte': '#8B5CF6', 'Embusa': '#EC4899', 'Flota Angulo': '#F97316',
  'Sodis': '#A855F7', 'Lolaya': '#EF4444', 'Lucero San Felipe': '#F472B6',
  'Coochofal': '#14B8A6', 'Cootrasol': '#22D3EE', 'La Carolina': '#818CF8',
};

function createPointIcon(index, color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-family:Inter,sans-serif">${index + 1}</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

function AdminMapClick({ onAddPoint, isDrawing }) {
  useMapEvents({ click(e) { if (isDrawing) onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function AdminMapFit({ points, shouldFit }) {
  const map = useMap();
  useEffect(() => {
    if (shouldFit && points.length >= 2) {
      map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 16 });
    }
  }, [shouldFit]);
  return null;
}

/* ========== ROUTE EDITOR TAB (extracted from old AdminPanel) ========== */
function RouteEditorTab({ user }) {
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [editMode, setEditMode] = useState('idle');
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [idaPoints, setIdaPoints] = useState([]);
  const [regresoPoints, setRegresoPoints] = useState([]);
  const [snappedIda, setSnappedIda] = useState([]);
  const [snappedRegreso, setSnappedRegreso] = useState([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const [nombre, setNombre] = useState('');
  const [operador, setOperador] = useState('Coolitoral');
  const [color, setColor] = useState('#06B6D4');
  const [fare, setFare] = useState(2600);
  const [codigo, setCodigo] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [shouldFitMap, setShouldFitMap] = useState(false);

  const loadRoutes = useCallback(async () => {
    try { setLoadingRoutes(true); const res = await routesAPI.getAll(); setRoutes(res.data || []); }
    catch (err) { console.error(err); } finally { setLoadingRoutes(false); }
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);
  useEffect(() => { if (OPERATOR_COLORS[operador]) setColor(OPERATOR_COLORS[operador]); }, [operador]);

  const activePoints = editMode === 'regreso' ? regresoPoints : idaPoints;
  const setActivePoints = editMode === 'regreso' ? setRegresoPoints : setIdaPoints;

  const handleAddPoint = useCallback((point) => {
    if (editMode === 'idle') return;
    setActivePoints(prev => [...prev, point]);
    if (editMode === 'ida') setSnappedIda([]); else setSnappedRegreso([]);
  }, [editMode, setActivePoints]);

  const handleUndo = useCallback(() => {
    setActivePoints(prev => prev.slice(0, -1));
    if (editMode === 'ida') setSnappedIda([]); else setSnappedRegreso([]);
  }, [editMode, setActivePoints]);

  const handleSnapToRoads = useCallback(async () => {
    const points = editMode === 'ida' ? idaPoints : regresoPoints;
    if (points.length < 2) return;
    setIsSnapping(true);
    try {
      const snapped = await snapToRoads(points, true);
      if (editMode === 'ida') setSnappedIda(snapped); else setSnappedRegreso(snapped);
      showMsg('✅ Ajustado a calles', 'success');
    } catch { showMsg('❌ Error al ajustar', 'error'); }
    finally { setIsSnapping(false); }
  }, [editMode, idaPoints, regresoPoints]);

  const handleSave = useCallback(async () => {
    if (!nombre || !operador) { showMsg('⚠️ Nombre y operador requeridos', 'error'); return; }
    const idaCoords = (snappedIda.length > 1 ? snappedIda : idaPoints).map(p => [p.lng, p.lat]);
    const regresoCoords = (snappedRegreso.length > 1 ? snappedRegreso : regresoPoints).map(p => [p.lng, p.lat]);
    if (idaCoords.length < 2) { showMsg('⚠️ Mínimo 2 puntos en ida', 'error'); return; }
    setSaving(true);
    try {
      const data = { nombre, operador, color, fare, codigo: codigo || undefined, ida: { trazado: { coordinates: idaCoords } }, regreso: regresoCoords.length >= 2 ? { trazado: { coordinates: regresoCoords } } : undefined };
      if (editingRouteId) { await adminRoutesAPI.update(editingRouteId, data); showMsg('✅ Actualizada', 'success'); }
      else { await adminRoutesAPI.create(data); showMsg('✅ Creada', 'success'); }
      resetEditor(); loadRoutes();
    } catch (err) { showMsg(`❌ ${err.message || 'Error'}`, 'error'); }
    finally { setSaving(false); }
  }, [nombre, operador, color, fare, codigo, idaPoints, regresoPoints, snappedIda, snappedRegreso, editingRouteId, loadRoutes]);

  const handleDelete = useCallback(async (id) => {
    try { await adminRoutesAPI.delete(id); showMsg('🗑️ Eliminada', 'success'); setShowDeleteConfirm(null); loadRoutes(); }
    catch { showMsg('❌ Error', 'error'); }
  }, [loadRoutes]);

  const handleEdit = useCallback((route) => {
    setEditingRouteId(route._id); setNombre(route.nombre || ''); setOperador(route.operador || 'Coolitoral');
    setColor(route.color || '#06B6D4'); setFare(route.fare || 2600); setCodigo(route.codigo || '');
    setIdaPoints((route.ida?.trazado?.coordinates || []).map(c => ({ lat: c[1], lng: c[0] }))); setSnappedIda([]);
    setRegresoPoints((route.regreso?.trazado?.coordinates || []).map(c => ({ lat: c[1], lng: c[0] }))); setSnappedRegreso([]);
    setEditMode('ida'); setShouldFitMap(true); setTimeout(() => setShouldFitMap(false), 500);
  }, []);

  const resetEditor = useCallback(() => {
    setEditMode('idle'); setEditingRouteId(null); setIdaPoints([]); setRegresoPoints([]);
    setSnappedIda([]); setSnappedRegreso([]); setNombre(''); setOperador('Coolitoral');
    setColor('#06B6D4'); setFare(2600); setCodigo('');
  }, []);

  const showMsg = (text, type) => { setMessage({ text, type }); setTimeout(() => setMessage(null), 4000); };

  const idaDisplay = snappedIda.length > 1 ? snappedIda.map(p => [p.lat, p.lng]) : idaPoints.map(p => [p.lat, p.lng]);
  const regresoDisplay = snappedRegreso.length > 1 ? snappedRegreso.map(p => [p.lat, p.lng]) : regresoPoints.map(p => [p.lat, p.lng]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Editor sidebar */}
      <div style={{ width: 320, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.06)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {editingRouteId ? '✏️ Editando' : '🆕 Nueva Ruta'}
        </p>
        <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#F1F5F9', fontSize: 12, outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={operador} onChange={e => setOperador(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, background: 'rgba(255,255,255,0.04)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }}>
            {Object.keys(OPERATOR_COLORS).map(op => <option key={op} value={op}>{op}</option>)}
            <option value="Otra">Otra</option>
          </select>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 38, height: 35, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" placeholder="Tarifa" value={fare} onChange={e => setFare(parseInt(e.target.value) || 0)} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, background: 'rgba(255,255,255,0.04)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
          <input type="text" placeholder="Código" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, background: 'rgba(255,255,255,0.04)', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
        </div>
        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ mode: 'ida', label: 'Ida', color: '#2ECC71', count: idaPoints.length }, { mode: 'regreso', label: 'Vuelta', color: '#E74C3C', count: regresoPoints.length }].map(t => (
            <button key={t.mode} onClick={() => setEditMode(t.mode)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${editMode === t.mode ? t.color + '50' : 'transparent'}`, background: editMode === t.mode ? `${t.color}20` : 'rgba(255,255,255,0.04)', color: editMode === t.mode ? t.color : '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={handleUndo} disabled={!activePoints.length} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8', fontSize: 10, cursor: activePoints.length ? 'pointer' : 'not-allowed', opacity: activePoints.length ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 4 }}><Undo2 size={10} /> Deshacer</button>
          <button onClick={handleSnapToRoads} disabled={activePoints.length < 2} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontSize: 10, cursor: activePoints.length >= 2 ? 'pointer' : 'not-allowed', opacity: activePoints.length >= 2 ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 4 }}><Zap size={10} /> Snap</button>
          <button onClick={resetEditor} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><RotateCcw size={10} /> Reset</button>
        </div>
        <button onClick={handleSave} disabled={saving || idaPoints.length < 2 || !nombre} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: (saving || idaPoints.length < 2 || !nombre) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #F59E0B, #D97706)', color: (saving || idaPoints.length < 2 || !nombre) ? '#475569' : '#000', fontSize: 12, fontWeight: 700, cursor: (saving || idaPoints.length < 2 || !nombre) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={12} /> {saving ? 'Guardando...' : editingRouteId ? 'Actualizar' : 'Guardar'}
        </button>

        {/* Route list */}
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>📋 Rutas ({routes.length})</p>
          {loadingRoutes ? <p style={{ fontSize: 11, color: '#475569' }}>Cargando...</p> :
           routes.map(route => (
            <div key={route._id} style={{ marginBottom: 4, borderRadius: 10, background: expandedRoute === route._id ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${expandedRoute === route._id ? (route.color || '#333') + '40' : 'rgba(255,255,255,0.05)'}` }}>
              <button onClick={() => setExpandedRoute(expandedRoute === route._id ? null : route._id)} style={{ width: '100%', padding: '8px 10px', border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: route.color || '#6B7280' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#F1F5F9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{route.nombre}</p>
                  <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>{route.operador}</p>
                </div>
                <ChevronDown size={10} style={{ color: '#475569', transform: expandedRoute === route._id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {expandedRoute === route._id && (
                <div style={{ padding: '0 10px 8px', display: 'flex', gap: 4 }}>
                  <button onClick={() => handleEdit(route)} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(6,182,212,0.2)', background: 'rgba(6,182,212,0.08)', color: '#06B6D4', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                  {showDeleteConfirm === route._id ? (
                    <><button onClick={() => handleDelete(route._id)} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Confirmar</button>
                    <button onClick={() => setShowDeleteConfirm(null)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8', fontSize: 10, cursor: 'pointer' }}>✕</button></>
                  ) : (
                    <button onClick={() => setShowDeleteConfirm(route._id)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer' }}><Trash2 size={10} /></button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={BARRANQUILLA_CENTER} zoom={DEFAULT_ZOOM} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" maxZoom={19} subdomains="abcd" />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" maxZoom={19} subdomains="abcd" />
          <AdminMapClick onAddPoint={handleAddPoint} isDrawing={editMode !== 'idle'} />
          <AdminMapFit points={editMode === 'ida' ? idaPoints : regresoPoints} shouldFit={shouldFitMap} />
          {idaDisplay.length > 1 && <Polyline positions={idaDisplay} pathOptions={{ color: '#2ECC71', weight: 4, opacity: 0.85, dashArray: snappedIda.length > 1 ? null : '8, 8' }} />}
          {regresoDisplay.length > 1 && <Polyline positions={regresoDisplay} pathOptions={{ color: '#E74C3C', weight: 4, opacity: 0.85, dashArray: snappedRegreso.length > 1 ? null : '8, 8' }} />}
          {editMode === 'ida' && idaPoints.map((p, i) => <Marker key={`ida-${i}`} position={[p.lat, p.lng]} icon={createPointIcon(i, '#2ECC71')} />)}
          {editMode === 'regreso' && regresoPoints.map((p, i) => <Marker key={`reg-${i}`} position={[p.lat, p.lng]} icon={createPointIcon(i, '#E74C3C')} />)}
          {editMode === 'idle' && routes.map(r => { const c = r.ida?.trazado?.coordinates; if (!c?.length) return null; return <Polyline key={r._id} positions={c.map(x => [x[1], x[0]])} pathOptions={{ color: r.color || '#666', weight: 3, opacity: 0.5 }}><Popup><strong>{r.nombre}</strong><br/>{r.operador}</Popup></Polyline>; })}
        </MapContainer>
        {editMode !== 'idle' && <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '6px 16px', borderRadius: 10, background: editMode === 'ida' ? 'rgba(46,204,113,0.9)' : 'rgba(231,76,60,0.9)', color: '#fff', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}><MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{editMode === 'ida' ? 'IDA' : 'VUELTA'} — {activePoints.length} pts</div>}
        {message && <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, padding: '8px 18px', borderRadius: 10, background: message.type === 'error' ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)', color: '#fff', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>{message.text}</div>}
      </div>
    </div>
  );
}

/* ========== MAIN ADMIN PANEL ========== */
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
  { id: 'captures', label: 'Capturas', icon: <Radar size={14} /> },
  { id: 'reports', label: 'Reportes', icon: <AlertTriangle size={14} /> },
  { id: 'editor', label: 'Editor', icon: <Map size={14} /> },
  { id: 'users', label: 'Usuarios', icon: <Users size={14} /> },
];

export default function AdminPanel({ onBack }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', background: 'var(--bg-dark)' }}>
      {/* Sidebar nav */}
      <div style={{
        width: 56, flexShrink: 0, height: '100%',
        background: 'rgba(7, 11, 22, 0.98)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 0',
      }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: 'rgba(255,255,255,0.06)', color: '#94A3B8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', marginBottom: 16,
        }}>
          <ArrowLeft size={16} />
        </button>

        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.label} style={{
            width: 40, height: 40, borderRadius: 10, border: 'none',
            background: activeTab === tab.id ? 'rgba(245,158,11,0.12)' : 'transparent',
            color: activeTab === tab.id ? '#F59E0B' : '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', marginBottom: 4, transition: 'all 0.2s',
          }}>
            {tab.icon}
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#F59E0B' }}>A</span>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <h1 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            Admin <span style={{ color: '#F59E0B' }}>{TABS.find(t => t.id === activeTab)?.label}</span>
          </h1>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: '#475569' }}>{user?.email}</span>
        </div>

        {/* Tab content — editor needs hidden (map), others need scrollable */}
        <div style={{ flex: 1, overflow: activeTab === 'editor' ? 'hidden' : 'auto' }}>
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'captures' && <CapturesTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'editor' && <RouteEditorTab user={user} />}
          {activeTab === 'users' && <UsersTab />}
        </div>
      </div>
    </div>
  );
}
