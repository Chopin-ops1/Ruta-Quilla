/**
 * ============================================
 * RutaQuilla - Sidebar (Panel Lateral v2)
 * ============================================
 *
 * Panel lateral con 3 tabs:
 * - Navegar: Panel de navegación origen→destino (Google Maps style)
 * - Rutas: Lista de rutas (click muestra solo esa ruta)
 * - Capturar: Captura GPS para crowdsourcing
 */

import { useState, useEffect } from 'react';
import {
  Route, Navigation, Filter, MapPin, Bus,
  ChevronRight, Crown, Download,
  CheckCircle2, Eye, EyeOff, Zap, Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDistance, getRouteLength } from '../utils/geoUtils';
import RouteNavigator from './RouteNavigator';

export default function Sidebar({
  routes,
  isOpen,
  onRouteSelect,
  selectedRoute,
  onToggleLayer,
  layerVisibility,
  onStartCapture,
  isCapturing,
  // Navigation props
  onNavigate,
  onClearNavigation,
  navigationResult,
  isNavigating,
  selectedOptionIdx,
  onSelectOptionIdx,
  onSetOriginFromMap,
  onSetDestinationFromMap,
  pinMode,
  onPinModeChange,
  onPreviewOriginChange,
  onPreviewDestinationChange,
  activeReports = [],
}) {
  const { user, isPremium, isAuthenticated, upgradeToPremium } = useAuth();
  const [filterType, setFilterType] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [activeTab, setActiveTab] = useState('navigate');
  const [searchText, setSearchText] = useState('');
  const [expandedCompany, setExpandedCompany] = useState(null);

  // Compute affected route IDs from active reports
  const affectedRouteIds = new Set(activeReports.map(r => r.routeId).filter(Boolean));

  // Favorites system (persisted in localStorage)
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rutaquilla_favorites') || '[]');
    } catch { return []; }
  });

  const toggleFavorite = (routeId) => {
    setFavorites(prev => {
      const next = prev.includes(routeId)
        ? prev.filter(id => id !== routeId)
        : [...prev, routeId];
      localStorage.setItem('rutaquilla_favorites', JSON.stringify(next));
      return next;
    });
  };

  const isFavorite = (routeId) => favorites.includes(routeId);

  // Auto-switch to navigation tab if user clicks map context menu
  useEffect(() => {
    if (onSetOriginFromMap || onSetDestinationFromMap) {
      setActiveTab('navigate');
    }
  }, [onSetOriginFromMap, onSetDestinationFromMap]);

  // Filter routes by type and search text
  const filteredRoutes = routes.filter(route => {
    if (filterType !== 'all' && route.type !== filterType) return false;
    if (filterCompany !== 'all' && (route.operador || route.company) !== filterCompany) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const n = (route.nombre || route.name || '').toLowerCase();
      const c = (route.operador || route.company || '').toLowerCase();
      return n.includes(q) || c.includes(q);
    }
    return true;
  });

  const companies = [...new Set(routes.map(r => r.operador || r.company))].sort();

  const handleUpgrade = async () => {
    try { await upgradeToPremium(); } catch (err) { console.error(err); }
  };

  return (
    <aside
      style={{
        position: 'fixed',
        top: 58,
        left: 0,
        bottom: 0,
        zIndex: 1050,
        width: '85vw',
        maxWidth: '20rem',
        overflow: 'hidden',
        transition: 'transform 0.3s ease-out',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        borderRight: '1px solid var(--glass-border)',
        background: 'rgba(11, 17, 32, 0.95)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
      }}
    >
      <div className="h-full flex flex-col">
        {/* Tabs — Mobile-first segmented control */}
        <div style={{
          padding: '10px 10px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            {[
              { id: 'navigate', icon: Navigation, label: 'Navegar', color: '#06B6D4' },
              { id: 'routes', icon: Route, label: 'Rutas', color: '#10B981' },
              { id: 'favorites', icon: Star, label: 'Favoritos', color: '#F59E0B' },
              { id: 'capture', icon: Zap, label: 'Capturar', color: '#EC4899' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '10px 4px 8px',
                  borderRadius: 11,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  background: activeTab === tab.id
                    ? `linear-gradient(135deg, ${tab.color}18, ${tab.color}08)`
                    : 'transparent',
                  boxShadow: activeTab === tab.id
                    ? `0 2px 12px ${tab.color}15, inset 0 0 0 1px ${tab.color}25`
                    : 'none',
                }}
                id={`tab-${tab.id}`}
              >
                <tab.icon
                  size={activeTab === tab.id ? 17 : 15}
                  color={activeTab === tab.id ? tab.color : '#475569'}
                  style={{ transition: 'all 0.2s', flexShrink: 0 }}
                />
                <span style={{
                  fontSize: 9,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? tab.color : '#475569',
                  letterSpacing: activeTab === tab.id ? '0.02em' : '0',
                  transition: 'all 0.2s',
                  lineHeight: 1,
                }}>
                  {tab.label}
                </span>
                {/* Active dot indicator */}
                {activeTab === tab.id && (
                  <div style={{
                    position: 'absolute',
                    bottom: 3,
                    width: 14,
                    height: 2,
                    borderRadius: 2,
                    background: tab.color,
                    boxShadow: `0 0 8px ${tab.color}80`,
                  }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* ---- Tab: Navegar ---- */}
          {activeTab === 'navigate' && (
            <RouteNavigator
              onNavigate={onNavigate}
              onClear={onClearNavigation}
              navigationResult={navigationResult}
              isNavigating={isNavigating}
              onSetOriginFromMap={onSetOriginFromMap}
              onSetDestinationFromMap={onSetDestinationFromMap}
              pinMode={pinMode}
              onPinModeChange={onPinModeChange}
              selectedOptionIdx={selectedOptionIdx}
              onSelectOptionIdx={onSelectOptionIdx}
              onPreviewOriginChange={onPreviewOriginChange}
              onPreviewDestinationChange={onPreviewDestinationChange}
            />
          )}

          {/* ---- Tab: Rutas ---- */}
          {activeTab === 'routes' && (
            <div className="animate-fade-in">
              {/* Search + Filters */}
              <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Quick search */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 14, marginBottom: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  transition: 'border-color 0.2s',
                }}>
                  <Bus size={14} style={{ color: '#475569', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Buscar ruta o empresa..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: '#F1F5F9', fontSize: 12, minWidth: 0 }}
                  />
                </div>

                {/* Type filters */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[
                    { value: 'all', label: 'Todas' },
                    { value: 'official', label: 'Oficiales' },
                    { value: 'community', label: 'Comunidad' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterType(opt.value)}
                      style={{
                        padding: '7px 14px', borderRadius: 10,
                        fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                        border: `1px solid ${filterType === opt.value ? '#06B6D4' + '40' : 'rgba(255,255,255,0.07)'}`,
                        background: filterType === opt.value ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.02)',
                        color: filterType === opt.value ? '#06B6D4' : '#64748B',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Company filter dropdown */}
                {companies.length > 1 && (
                  <select
                    value={filterCompany}
                    onChange={e => setFilterCompany(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 10,
                      fontSize: 11, outline: 'none', marginBottom: 10,
                      background: 'rgba(255,255,255,0.03)',
                      color: '#94A3B8',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <option value="all">Todas las empresas ({routes.length})</option>
                    {companies.map(c => (
                      <option key={c} value={c}>
                        {c} ({routes.filter(r => r.company === c).length})
                      </option>
                    ))}
                  </select>
                )}

                {/* Layer toggles */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onToggleLayer?.('official')}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '8px 10px', borderRadius: 10,
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: layerVisibility?.official ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                      color: layerVisibility?.official ? '#34D399' : '#475569',
                      border: `1px solid ${layerVisibility?.official ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    {layerVisibility?.official ? <Eye size={12} /> : <EyeOff size={12} />}
                    Oficiales
                  </button>
                  <button
                    onClick={() => onToggleLayer?.('community')}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '8px 10px', borderRadius: 10,
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: layerVisibility?.community ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
                      color: layerVisibility?.community ? '#A78BFA' : '#475569',
                      border: `1px solid ${layerVisibility?.community ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    {layerVisibility?.community ? <Eye size={12} /> : <EyeOff size={12} />}
                    Comunidad
                  </button>
                </div>
              </div>

              {/* Route list grouped by company */}
              <div className="p-2 space-y-1">
                {filteredRoutes.length === 0 ? (
                  <div className="text-center py-8">
                    <Bus size={32} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      No se encontraron rutas
                    </p>
                  </div>
                ) : (
                  (() => {
                    // Group routes by operador
                    const grouped = {};
                    filteredRoutes.forEach(route => {
                      const co = route.operador || 'Otra';
                      if (!grouped[co]) grouped[co] = [];
                      grouped[co].push(route);
                    });

                    return Object.entries(grouped).map(([operador, operadorRoutes]) => (
                      <div key={operador} className="mb-1">
                        {/* Operador header accordion */}
                        <button
                          onClick={() => setExpandedCompany?.(expandedCompany === operador ? null : operador)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                          style={{
                            background: expandedCompany === operador ? 'var(--bg-card)' : 'transparent',
                            border: `1px solid ${expandedCompany === operador ? (operadorRoutes[0]?.color || 'var(--border-color)') + '30' : 'transparent'}`,
                          }}
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{
                              background: operadorRoutes[0]?.color || '#6B7280',
                              boxShadow: `0 0 6px ${(operadorRoutes[0]?.color || '#6B7280')}40`,
                            }} />
                          <span className="flex-1 text-left text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {operador}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                            background: 'var(--bg-surface)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                          }}>
                            {operadorRoutes.length} ruta{operadorRoutes.length > 1 ? 's' : ''}
                          </span>
                          {expandedCompany === operador
                            ? <ChevronRight size={12} style={{ color: 'var(--text-muted)', transform: 'rotate(90deg)', transition: 'transform 0.2s' }} />
                            : <ChevronRight size={12} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s' }} />
                          }
                        </button>

                        {/* Operador routes (expanded) */}
                        {expandedCompany === operador && (
                          <div className="pl-3 space-y-0.5 mt-0.5 animate-fade-in">
                            {operadorRoutes.map(route => (
                              <button
                                key={route._id}
                                onClick={() => onRouteSelect?.(route)}
                                className="w-full text-left p-2.5 rounded-xl transition-all duration-200"
                                style={{
                                  background: selectedRoute?._id === route._id ? 'var(--bg-card)' : 'transparent',
                                  border: `1px solid ${selectedRoute?._id === route._id ? route.color + '40' : 'transparent'}`,
                                }}
                                onMouseEnter={e => {
                                  if (selectedRoute?._id !== route._id) e.currentTarget.style.background = 'var(--bg-card)';
                                }}
                                onMouseLeave={e => {
                                  if (selectedRoute?._id !== route._id) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                                    style={{ background: route.color, boxShadow: `0 0 6px ${route.color}40` }} />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[12px] font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
                                      {route.nombre}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={`badge ${route.type === 'official' ? 'badge-official' : 'badge-community'}`}
                                        style={{ fontSize: '9px', padding: '1px 6px' }}>
                                        {route.verified && <CheckCircle2 size={8} />}
                                        {route.type === 'official' ? 'Oficial' : 'Comunidad'}
                                      </span>
                                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                        {getRouteLength(route.ida?.trazado?.coordinates).toFixed(1)} km
                                      </span>
                                      {affectedRouteIds.has(route._id) && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{
                                          background: 'rgba(239,68,68,0.15)',
                                          color: '#EF4444',
                                          border: '1px solid rgba(239,68,68,0.3)',
                                          animation: 'pulse 2s infinite',
                                        }}>
                                          ⚠️ Afectada
                                        </span>
                                      )}
                                      {route.regreso?.trazado?.coordinates?.length > 1 && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{
                                          background: 'rgba(139, 92, 246, 0.1)',
                                          color: '#A78BFA',
                                          border: '1px solid rgba(139, 92, 246, 0.2)',
                                        }}>
                                          Ida + Vuelta
                                        </span>
                                      )}
                                      {route.resolucionPdf && (
                                        <a
                                          href={route.resolucionPdf}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5"
                                          style={{
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            color: '#10B981',
                                            border: '1px solid rgba(16, 185, 129, 0.2)',
                                            textDecoration: 'none',
                                          }}
                                          title={`Ver resolución oficial AMBQ ${route.codigoAMBQ || ''}`}
                                        >
                                          <Download size={8} />
                                          {route.codigoAMBQ || 'PDF'}
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(route._id); }}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      padding: 4, flexShrink: 0, display: 'flex',
                                      transition: 'transform 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                    title={isFavorite(route._id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                                  >
                                    <Star
                                      size={14}
                                      fill={isFavorite(route._id) ? '#F59E0B' : 'none'}
                                      color={isFavorite(route._id) ? '#F59E0B' : 'var(--text-muted)'}
                                    />
                                  </button>
                                  <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          )}

          {/* ---- Tab: Favoritos ---- */}
          {activeTab === 'favorites' && (
            <div className="animate-fade-in p-3">
              {(() => {
                const favRoutes = routes.filter(r => isFavorite(r._id));
                if (favRoutes.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Star size={36} style={{ color: 'var(--text-muted)', margin: '0 auto', opacity: 0.3 }} />
                      <p className="text-sm mt-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Sin favoritos aún
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', maxWidth: 220, margin: '4px auto 0' }}>
                        Toca la ⭐ en cualquier ruta para guardarla aquí y acceder rápido.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      ⭐ {favRoutes.length} ruta{favRoutes.length > 1 ? 's' : ''} favorita{favRoutes.length > 1 ? 's' : ''}
                    </p>
                    {favRoutes.map(route => (
                      <button
                        key={route._id}
                        onClick={() => onRouteSelect?.(route)}
                        className="w-full text-left p-3 rounded-xl transition-all duration-200"
                        style={{
                          background: selectedRoute?._id === route._id ? 'var(--bg-card)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${selectedRoute?._id === route._id ? (route.color || '#555') + '40' : 'var(--border-color)'}`,
                        }}
                        onMouseEnter={e => { if (selectedRoute?._id !== route._id) e.currentTarget.style.background = 'var(--bg-card)'; }}
                        onMouseLeave={e => { if (selectedRoute?._id !== route._id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: route.color, boxShadow: `0 0 8px ${route.color}50` }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-[12px] font-semibold truncate block" style={{ color: 'var(--text-primary)' }}>
                              {route.nombre}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {route.operador} · {getRouteLength(route.ida?.trazado?.coordinates).toFixed(1)} km
                            </span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(route._id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          >
                            <Star size={14} fill="#F59E0B" color="#F59E0B" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ---- Tab: Captura GPS ---- */}
          {activeTab === 'capture' && (
            <div className="animate-fade-in" style={{ padding: '16px 14px' }}>
              {/* Hero section */}
              <div style={{
                textAlign: 'center', padding: '20px 16px 16px',
                borderRadius: 16, marginBottom: 14,
                background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(139,92,246,0.06))',
                border: '1px solid rgba(236,72,153,0.12)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, margin: '0 auto 10px',
                  background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(245,158,11,0.15))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(236,72,153,0.15)',
                }}>
                  <Bus size={22} color="#EC4899" />
                </div>
                <h3 style={{
                  fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px',
                  fontFamily: 'Outfit, sans-serif',
                }}>
                  Capturar Ruta GPS
                </h3>
                <p style={{ fontSize: 11, color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                  Sube a un bus y contribuye la ruta para toda la comunidad 🚌
                </p>
              </div>

              {/* GPS status card */}
              <div style={{
                padding: '12px 14px', borderRadius: 14, marginBottom: 12,
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${isCapturing ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'border-color 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div className={`gps-dot ${isCapturing ? 'recording' : 'inactive'}`}
                    style={{ width: 10, height: 10, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: isCapturing ? '#F87171' : '#64748B',
                  }}>
                    {isCapturing ? '● Grabando ruta...' : 'GPS listo para capturar'}
                  </span>
                </div>

                {/* Feature list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { icon: '⏱️', text: 'Captura automática cada 5 segundos' },
                    { icon: '🎯', text: 'Filtro de precisión: ≤ 20 metros' },
                    { icon: '🤝', text: 'Se fusiona con capturas de otros usuarios' },
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#475569' }}>
                      <span style={{ fontSize: 12, lineHeight: 1 }}>{f.icon}</span>
                      {f.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Capture button — large mobile-friendly */}
              <button
                onClick={() => onStartCapture?.()}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: '#fff',
                  transition: 'all 0.3s',
                  background: isCapturing
                    ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                    : 'linear-gradient(135deg, #EC4899, #8B5CF6)',
                  boxShadow: isCapturing
                    ? '0 4px 20px rgba(239,68,68,0.3)'
                    : '0 4px 20px rgba(236,72,153,0.25)',
                }}
                id="capture-btn"
              >
                {isCapturing ? <Navigation size={18} /> : <Zap size={18} />}
                {isCapturing ? 'Detener captura' : 'Iniciar captura'}
              </button>

              {!isAuthenticated && (
                <p style={{
                  fontSize: 10, color: '#F59E0B', textAlign: 'center', marginTop: 10,
                  background: 'rgba(245,158,11,0.06)', padding: '8px 12px', borderRadius: 10,
                  border: '1px solid rgba(245,158,11,0.1)',
                }}>
                  ⚠️ Debes iniciar sesión para capturar rutas
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer: Premium upsell */}
        {isAuthenticated && !isPremium && (
          <div className="p-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={handleUpgrade}
              className="w-full p-3 rounded-xl flex items-center gap-3 transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1))',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              id="upgrade-btn"
            >
              <Crown size={20} style={{ color: '#FBBF24' }} />
              <div className="text-left">
                <p className="text-xs font-semibold" style={{ color: '#FBBF24' }}>Quilla-Pass Premium</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Sin publicidad • Descarga offline</p>
              </div>
            </button>
          </div>
        )}

        {isPremium && (
          <div className="p-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => window.open('/api/maps/download', '_blank')}
              className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"
              id="download-offline-btn"
            >
              <Download size={14} /> Descargar mapa offline
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
