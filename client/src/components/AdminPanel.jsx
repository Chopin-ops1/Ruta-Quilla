/**
 * ============================================
 * RutaQuilla - Centro de Control Admin v4
 * ============================================
 *
 * Diseño "Señalética de tránsito caribeña":
 * - Navegación adaptativa: riel lateral en desktop, barra inferior táctil en móvil
 * - Soporte nativo para modo oscuro y claro
 * - 7 módulos: Resumen, Rutas y Editor, Capturas GPS, Colaborativas, Reportes, Usuarios y Seguridad
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  Map,
  Radar,
  GitMerge,
  AlertTriangle,
  Users,
  Shield,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { adminAPI } from '../services/api';

import DashboardTab from './admin/DashboardTab';
import RoutesManagerTab from './admin/RoutesManagerTab';
import CapturesTab from './admin/CapturesTab';
import CompositesTab from './admin/CompositesTab';
import ReportsTab from './ReportsTab';
import UsersTab from './admin/UsersTab';
import SecurityAuditTab from './admin/SecurityAuditTab';

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Resumen', short: 'Resumen', icon: LayoutDashboard },
  { id: 'routes', label: 'Rutas y Editor', short: 'Rutas', icon: Map },
  { id: 'captures', label: 'Capturas GPS', short: 'Capturas', icon: Radar },
  { id: 'composites', label: 'Colaborativas', short: 'Colab.', icon: GitMerge },
  { id: 'reports', label: 'Reportes', short: 'Reportes', icon: AlertTriangle },
  { id: 'users', label: 'Usuarios', short: 'Usuarios', icon: Users },
  { id: 'security', label: 'Seguridad', short: 'Seguridad', icon: Shield },
];

export default function AdminPanel({ onBack }) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshTick, setRefreshTick] = useState(0);
  const [badges, setBadges] = useState({ pendingCaptures: 0, activeReports: 0, needsAudit: 0 });
  const [routesFilterPreset, setRoutesFilterPreset] = useState('all');
  const [editorSeedCapture, setEditorSeedCapture] = useState(null);

  const loadBadges = useCallback(async () => {
    try {
      const res = await adminAPI.getDashboard();
      const d = res.data || {};
      setBadges({
        pendingCaptures: d.captures?.pending || 0,
        activeReports: d.reports?.activeNow || 0,
        needsAudit: d.routes?.needsAudit || 0,
      });
    } catch (_) {
      // silent badge refresh
    }
  }, []);

  useEffect(() => {
    loadBadges();
  }, [loadBadges, refreshTick]);

  const handleTriggerRefresh = () => {
    setRefreshTick((t) => t + 1);
  };

  const handleOpenRoutesWithPreset = useCallback((preset = 'all') => {
    setRoutesFilterPreset(preset);
    setEditorSeedCapture(null);
    setActiveTab('routes');
  }, []);

  const handleUseCaptureInEditor = useCallback((capture) => {
    if (!capture) return;
    setEditorSeedCapture({ ...capture, _seedTs: Date.now() });
    setActiveTab('routes');
  }, []);

  const currentTabMeta = ADMIN_TABS.find((t) => t.id === activeTab) || ADMIN_TABS[0];

  const getBadgeForTab = (tabId) => {
    if (tabId === 'captures' && badges.pendingCaptures > 0) return badges.pendingCaptures;
    if (tabId === 'reports' && badges.activeReports > 0) return badges.activeReports;
    if (tabId === 'routes' && badges.needsAudit > 0) return badges.needsAudit;
    return 0;
  };

  return (
    <div className="admin-shell">
      {/* Rail lateral Desktop */}
      <aside className="admin-rail" aria-label="Navegación de administración">
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={onBack}
            className="rq-btn-ghost"
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            <ArrowLeft size={14} />
            <span>Volver al mapa</span>
          </button>
        </div>

        <div className="px-2 py-1.5 mb-1">
          <div className="flex items-center gap-2">
            <span className="transit-code" style={{ fontSize: 10 }}>ADMIN</span>
            <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              RutaQuilla
            </span>
          </div>
          <p className="text-[10.5px] m-0 mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
            Control operacional
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const badge = getBadgeForTab(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                id={`admin-rail-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`admin-rail-btn${active ? ' active' : ''}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon size={15} color={active ? 'var(--brand)' : 'var(--text-muted)'} />
                  <span className="truncate">{tab.label}</span>
                </span>
                {badge > 0 && (
                  <span
                    className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{
                      background: tab.id === 'routes' ? 'var(--caribe-soft)' : 'var(--brand-soft)',
                      color: tab.id === 'routes' ? 'var(--caribe)' : 'var(--brand)',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-2.5 mt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="text-[10px] font-mono uppercase" style={{ color: 'var(--brand)', fontWeight: 700 }}>
              Sesión activa
            </div>
            <div className="text-[11px] font-semibold truncate mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {user?.name || 'Admin'}
            </div>
            <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
              {user?.email}
            </div>
          </div>
        </div>
      </aside>

      {/* Área principal */}
      <div className="admin-main">
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="rq-icon-btn md:hidden"
              style={{ width: 32, height: 32 }}
              aria-label="Volver al mapa"
              title="Volver al mapa"
            >
              <ArrowLeft size={15} />
            </button>
            <span className="transit-code flex-shrink-0" style={{ fontSize: 10 }}>ADMIN</span>
            <h1
              className="font-display text-[15px] font-bold m-0 truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {currentTabMeta.label}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleTriggerRefresh}
              className="rq-icon-btn"
              style={{ width: 32, height: 32 }}
              title="Actualizar módulo actual"
              aria-label="Actualizar datos"
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="rq-icon-btn"
              style={{ width: 32, height: 32, color: isDark ? 'var(--brand)' : 'var(--text-primary)' }}
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <span
              className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium max-w-[200px] truncate"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
            >
              {user?.email}
            </span>
          </div>
        </header>

        {/* Contenido */}
        <div className={`admin-content${activeTab === 'routes' ? ' no-scroll' : ''}`}>
          {activeTab === 'dashboard' && (
            <DashboardTab
              refreshTick={refreshTick}
              onNavigateTab={(tabId, preset) => {
                if (tabId === 'routes' && preset) {
                  handleOpenRoutesWithPreset(preset);
                } else {
                  setActiveTab(tabId);
                }
              }}
            />
          )}
          {activeTab === 'routes' && (
            <RoutesManagerTab
              refreshTick={refreshTick}
              initialFilter={routesFilterPreset}
              seedCapture={editorSeedCapture}
              onClearSeedCapture={() => setEditorSeedCapture(null)}
              onRoutesMutated={loadBadges}
            />
          )}
          {activeTab === 'captures' && (
            <CapturesTab
              refreshTick={refreshTick}
              onUseInEditor={handleUseCaptureInEditor}
              onCapturesMutated={loadBadges}
            />
          )}
          {activeTab === 'composites' && (
            <CompositesTab
              refreshTick={refreshTick}
              onCompositesMutated={loadBadges}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsTab
              refreshTick={refreshTick}
              onReportsMutated={loadBadges}
            />
          )}
          {activeTab === 'users' && <UsersTab refreshTick={refreshTick} />}
          {activeTab === 'security' && <SecurityAuditTab refreshTick={refreshTick} />}
        </div>

        {/* Barra inferior táctil en móvil */}
        <nav className="admin-bottom-nav" aria-label="Navegación móvil de administración">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const badge = getBadgeForTab(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                id={`admin-mobile-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`admin-bottom-btn${active ? ' active' : ''}`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon size={15} />
                  {badge > 0 && (
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -10,
                        fontSize: 8.5,
                        fontWeight: 700,
                        padding: '0 4px',
                        borderRadius: 999,
                        background: 'var(--brand)',
                        color: 'var(--brand-ink)',
                        lineHeight: '13px',
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <span>{tab.short}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
