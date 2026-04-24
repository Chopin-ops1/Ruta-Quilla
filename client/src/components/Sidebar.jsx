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
}) {
  const { user, isPremium, isAuthenticated, upgradeToPremium } = useAuth();
  const [filterType, setFilterType] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [activeTab, setActiveTab] = useState('navigate');
  const [searchText, setSearchText] = useState('');
  const [expandedCompany, setExpandedCompany] = useState(null);

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
        background: 'rgba(11, 17, 32, 0.92)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
      }}
    >
      <div className="h-full flex flex-col">
        {/* Tabs */}
        <div className="flex p-2 gap-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
          {[
            { id: 'navigate', icon: Navigation, label: 'Navegar' },
            { id: 'routes', icon: Route, label: 'Rutas' },
            { id: 'favorites', icon: Star, label: 'Favoritos' },
            { id: 'capture', icon: Navigation, label: 'Capturar' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.id ? 'var(--primary-amber)' : 'var(--text-muted)',
                border: activeTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
              }}
              id={`tab-${tab.id}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
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
              <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                {/* Quick search */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                  <Bus size={12} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Buscar ruta o empresa..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    className="flex-1 bg-transparent text-xs outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Type filters */}
                <div className="flex gap-1.5">
                  {[
                    { value: 'all', label: 'Todas' },
                    { value: 'official', label: 'Oficiales' },
                    { value: 'community', label: 'Comunidad' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterType(opt.value)}
                      className="text-xs px-3 py-2 rounded-full font-medium transition-all"
                      style={{
                        background: filterType === opt.value ? 'var(--bg-card)' : 'transparent',
                        color: filterType === opt.value ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        border: `1px solid ${filterType === opt.value ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
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
                    className="w-full text-xs px-3 py-2.5 rounded-lg outline-none"
                    style={{
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
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
                <div className="flex gap-1.5 mt-1">
                  <button
                    onClick={() => onToggleLayer?.('official')}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-full transition-all"
                    style={{
                      background: layerVisibility?.official ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      color: layerVisibility?.official ? '#34D399' : 'var(--text-muted)',
                      border: `1px solid ${layerVisibility?.official ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                    }}
                  >
                    {layerVisibility?.official ? <Eye size={12} /> : <EyeOff size={12} />}
                    Oficiales
                  </button>
                  <button
                    onClick={() => onToggleLayer?.('community')}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-full transition-all"
                    style={{
                      background: layerVisibility?.community ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                      color: layerVisibility?.community ? '#A78BFA' : 'var(--text-muted)',
                      border: `1px solid ${layerVisibility?.community ? 'rgba(139, 92, 246, 0.3)' : 'var(--border-color)'}`,
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
            <div className="p-4 space-y-4 animate-fade-in">
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Capturar Ruta GPS
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sube a un bus y activa el rastreo para contribuir la ruta a la comunidad.
                </p>
              </div>

              <div className="p-3 rounded-xl space-y-2" style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              }}>
                <div className="flex items-center gap-2">
                  <div className={`gps-dot ${isCapturing ? 'recording' : 'inactive'}`} />
                  <span className="text-xs font-medium" style={{
                    color: isCapturing ? 'var(--danger)' : 'var(--text-muted)'
                  }}>
                    {isCapturing ? 'Grabando ruta...' : 'GPS listo'}
                  </span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  • Captura cada 5 segundos<br />
                  • Filtro de precisión: ≤ 20 metros<br />
                  • Los datos se envían al parar
                </p>
              </div>

              <button
                onClick={() => onStartCapture?.()}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                  isCapturing ? 'text-white' : ''
                }`}
                style={{
                  background: isCapturing
                    ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                    : 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none', cursor: 'pointer',
                }}
                id="capture-btn"
              >
                <Navigation size={16} />
                {isCapturing ? 'Detener captura' : 'Iniciar captura'}
              </button>
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
