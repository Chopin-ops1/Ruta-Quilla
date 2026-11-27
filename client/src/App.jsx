/**
 * ============================================
 * RutaQuilla - App Principal v3
 * ============================================
 *
 * Orquesta la navegación tipo Google Maps:
 * - Mapa limpio al iniciar (sin rutas visibles)
 * - Estado de navegación (origen → destino)
 * - Pin-drop mode para marcar puntos en el mapa
 * - Listado de rutas para exploración individual
 * - Sistema freemium: 3 búsquedas gratis sin registro
 * - Páginas legales y banner de cookies
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Trophy, Megaphone, X } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { routesAPI, mapsAPI, reportAPI } from './services/api';
import { getCurrentPosition, startTracking, stopTracking } from './services/gpsService';
import { isNativeApp } from './utils/platform';
import { fxRouteFound, fxPinDrop } from './utils/soundAndHaptics';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import GPSTracker from './components/GPSTracker';
import LoginModal from './components/LoginModal';
import AndroidAuthScreen from './components/AndroidAuthScreen';
import LegalPages from './components/LegalPages';
import StorageNotice from './components/StorageNotice';
import MapQuickBar from './components/MapQuickBar';
import RouteResultBar from './components/RouteResultBar';
import IncidentReporter from './components/IncidentReporter';
import CommunityHub from './components/CommunityHub';
import ReportActionPanel from './components/ReportActionPanel';
import LiveNavigation from './components/LiveNavigation';

// Lazy load AdminPanel — only downloaded when admin navigates to /admin
const AdminPanel = lazy(() => import('./components/AdminPanel'));

export default function App() {
  // ---- Page routing ----
  const [currentPage, setCurrentPage] = useState(() => {
    return window.location.pathname === '/admin' ? 'admin' : 'main';
  });
  // ---- UI state ----
  const [menuOpen, setMenuOpen] = useState(() => window.innerWidth >= 768);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  const [showLogin, setShowLogin] = useState(false);
  const [loginReason, setLoginReason] = useState(null);
  const [showLegal, setShowLegal] = useState(null); // 'privacy' | 'terms' | null

  // Track screen size for responsive sidebar margin
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(window.location.pathname === '/admin' ? 'admin' : 'main');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ---- Routes data (for the list, loaded on-demand) ----
  const [routes, setRoutes] = useState([]);
  const [sponsoredLocations, setSponsoredLocations] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loadingRouteId, setLoadingRouteId] = useState(null);
  const [focusedStop, setFocusedStop] = useState(null);
  const [activeOfficialVariant, setActiveOfficialVariant] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---- PWA install prompt ----
  const [installPromptEvent, setInstallPromptEvent] = useState(null);

  // ---- Map extra data layers (Acciones B & C) ----
  const [showTransmetroStops, setShowTransmetroStops] = useState(false);
  const [transmetroStops, setTransmetroStops] = useState([]);
  const [loadingTransmetroStops, setLoadingTransmetroStops] = useState(false);
  const [focusedTransmetroStop, setFocusedTransmetroStop] = useState(null);

  const [showRoadSafety, setShowRoadSafety] = useState(false);
  const [roadSafetyPoints, setRoadSafetyPoints] = useState([]);
  const [loadingRoadSafety, setLoadingRoadSafety] = useState(false);

  // ---- Contextual route report trigger ----
  const [reportTrigger, setReportTrigger] = useState(null);

  // ---- Navigation state ----
  const [navigationResult, setNavigationResult] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);

  // ---- Pin-drop mode ----
  const [pinMode, setPinMode] = useState(null); // 'origin' | 'destination' | null
  const [originFromMap, setOriginFromMap] = useState(null);
  const [destFromMap, setDestFromMap] = useState(null);

  // ---- Preview markers (shown on map before navigation search) ----
  const [previewOrigin, setPreviewOrigin] = useState(null);
  const [previewDestination, setPreviewDestination] = useState(null);

  // ---- Map layer visibility ----
  const [layerVisibility, setLayerVisibility] = useState({
    official: true,
    community: true,
  });

  // ---- GPS capture state ----
  const [isCapturing, setIsCapturing] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const [gpsTrack, setGpsTrack] = useState([]);

  // ---- Community state ----
  const [showCommunity, setShowCommunity] = useState(false);
  const [activeReports, setActiveReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  // ---- Live Navigation state ----
  const [liveNavOption, setLiveNavOption] = useState(null);
  const [liveNavPhase, setLiveNavPhase] = useState(null);

  // ---- Capture Config state ----
  const [showCaptureConfig, setShowCaptureConfig] = useState(false);

  const {
    isPremium,
    isAuthenticated,
    isAdmin,
    loading: authLoading,
    canNavigate,
    incrementUsage,
    remainingFreeSearches,
    publicConfig,
  } = useAuth();
  const [bannerDismissedText, setBannerDismissedText] = useState('');
  const activeBanner =
    publicConfig?.banner?.enabled &&
    publicConfig?.banner?.text &&
    bannerDismissedText !== publicConfig.banner.text
      ? publicConfig.banner
      : null;
  const toast = useToast();
  const hasQuickBar = Boolean(
    !navigationResult && (previewOrigin || previewDestination || originFromMap || destFromMap)
  );
  const hideMobileMapChrome = !isDesktop && menuOpen;
  const fabBottom = isDesktop
    ? navigationResult
      ? 224
      : hasQuickBar
      ? 156
      : selectedRoute
      ? 160
      : 34
    : navigationResult
    ? 224
    : hasQuickBar
    ? 152
    : selectedRoute
    ? 146
    : 44;

  /**
   * Full state reset on logout.
   * When the user logs out, clear all navigation/capture/app state
   * so no residual data from the previous session is visible.
   */
  useEffect(() => {
    if (!isAuthenticated) {
      setNavigationResult(null);
      setSelectedRoute(null);
      setLoadingRouteId(null);
      setFocusedStop(null);
      setActiveOfficialVariant(null);
      setReportTrigger(null);
      setSelectedOptionIdx(0);
      setIsNavigating(false);
      setGpsTrack([]);
      setIsCapturing(false);
      setShowCaptureConfig(false);
      setOriginFromMap(null);
      setDestFromMap(null);
      setPreviewOrigin(null);
      setPreviewDestination(null);
      setPinMode(null);
      setLiveNavOption(null);
      setLiveNavPhase(null);
      setShowCommunity(false);
      setSelectedReport(null);
      // Return to main page if on admin
      if (currentPage === 'admin') {
        window.history.pushState({}, '', '/');
        setCurrentPage('main');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Redirect non-admin users away from /admin once auth finishes loading
  useEffect(() => {
    if (!authLoading && currentPage === 'admin' && !isAdmin) {
      window.history.replaceState({}, '', '/');
      setCurrentPage('main');
    }
  }, [authLoading, currentPage, isAdmin]);

  // Navigate to admin panel
  const goToAdmin = useCallback(() => {
    window.history.pushState({}, '', '/admin');
    setCurrentPage('admin');
  }, []);

  const goToMain = useCallback(() => {
    window.history.pushState({}, '', '/');
    setCurrentPage('main');
  }, []);

  /**
   * Load routes list (for the Rutas tab - lazy, doesn't render on map).
   */
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const response = await routesAPI.getAll();
        setRoutes(response.data || []);
      } catch (err) {
        console.error('Error cargando rutas:', err);
        // Keep existing routes on error — don't wipe the list
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  /**
   * Request user geolocation on mount (deferred until authenticated in native Android app).
   * Centers the map on the user's position and shows the animated blue dot.
   */
  useEffect(() => {
    if (isNativeApp() && !isAuthenticated) return;
    getCurrentPosition()
      .then((pos) => {
        setUserPosition(pos);
      })
      .catch((err) => {
        console.log('📍 Ubicación no disponible:', err.message);
      });
  }, [isAuthenticated]);

  /**
   * Continuous GPS tracking during active Live Navigation (unless capture is active).
   */
  useEffect(() => {
    if (!liveNavOption || isCapturing) return;
    const watchId = startTracking(
      (pos) => setUserPosition(pos),
      (err) => console.warn('LiveNav GPS:', err.message),
      { maxAccuracy: 50, minInterval: 2000 }
    );
    return () => stopTracking(watchId);
  }, [liveNavOption, isCapturing]);

  // ---- PWA install prompt listener ----
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = useCallback(async () => {
    if (!installPromptEvent) return;
    try {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch (_) {
      // ignore dismissed prompt errors
    } finally {
      setInstallPromptEvent(null);
    }
  }, [installPromptEvent]);

  const handleRequestGPS = useCallback(async () => {
    try {
      const pos = await getCurrentPosition();
      setUserPosition(pos);
      return pos;
    } catch (err) {
      console.log('📍 Ubicación no disponible:', err.message);
      return null;
    }
  }, []);

  const ensureTransmetroStopsLoaded = useCallback(async () => {
    if (transmetroStops.length > 0 || loadingTransmetroStops) return;
    setLoadingTransmetroStops(true);
    try {
      const res = await mapsAPI.getTransmetroStops();
      setTransmetroStops(res.data || []);
    } catch (err) {
      console.error('Error cargando paraderos Transmetro:', err);
      toast.error('No se pudieron cargar los paraderos de Transmetro');
    } finally {
      setLoadingTransmetroStops(false);
    }
  }, [transmetroStops.length, loadingTransmetroStops, toast]);

  const handleToggleTransmetroStops = useCallback((forcedValue) => {
    setShowTransmetroStops((prev) => {
      const next = typeof forcedValue === 'boolean' ? forcedValue : !prev;
      if (next) ensureTransmetroStopsLoaded();
      return next;
    });
  }, [ensureTransmetroStopsLoaded]);

  const ensureRoadSafetyLoaded = useCallback(async () => {
    if (roadSafetyPoints.length > 0 || loadingRoadSafety) return;
    setLoadingRoadSafety(true);
    try {
      const res = await mapsAPI.getRoadSafety();
      const list = res.data || [];
      setRoadSafetyPoints(list);
      if (list.length === 0) {
        toast.warning('No hay datos de seguridad vial disponibles en este momento');
      }
    } catch (err) {
      console.error('Error cargando seguridad vial:', err);
      toast.error('No se pudo cargar la capa de seguridad vial');
    } finally {
      setLoadingRoadSafety(false);
    }
  }, [roadSafetyPoints.length, loadingRoadSafety, toast]);

  const handleToggleRoadSafety = useCallback((forcedValue) => {
    setShowRoadSafety((prev) => {
      const next = typeof forcedValue === 'boolean' ? forcedValue : !prev;
      if (next) ensureRoadSafetyLoaded();
      return next;
    });
  }, [ensureRoadSafetyLoaded]);

  /**
   * Load sponsored locations (only for free users).
   */
  useEffect(() => {
    async function loadSponsors() {
      if (isPremium) { setSponsoredLocations([]); return; }
      try {
        const response = await mapsAPI.getSponsored();
        setSponsoredLocations(response.data || []);
      } catch (err) {
        console.error('Error cargando sponsors:', err);
      }
    }
    loadSponsors();
  }, [isPremium]);

  // Load active reports (incidents on the map)
  const loadActiveReports = useCallback(async () => {
    try {
      const lat = userPosition?.lat || 10.9685;
      const lng = userPosition?.lng || -74.7813;
      const res = await reportAPI.getActive(lat, lng, 8000);
      setActiveReports(res.data || []);
    } catch (e) { console.warn('Reports load error:', e); }
  }, [userPosition]);

  useEffect(() => {
    loadActiveReports();
    const interval = setInterval(loadActiveReports, 60000); // Refresh every 1 min
    return () => clearInterval(interval);
  }, [loadActiveReports]);

  /**
   * Navigate: search for route options between origin and destination.
   * Includes freemium gate: after 3 free searches, requires login.
   */
  const handleNavigate = useCallback(async (origin, destination) => {
    // Freemium gate: check if user can navigate
    if (!canNavigate()) {
      setLoginReason('limit');
      setShowLogin(true);
      return;
    }

    try {
      setIsNavigating(true);
      setSelectedRoute(null); // Clear single route preview

      const response = await routesAPI.navigate(origin, destination);
      setNavigationResult(response);
      setSelectedOptionIdx(0);
      if (response?.options?.length > 0) {
        fxRouteFound();
      }

      // Increment usage counter (only for non-authenticated users)
      incrementUsage();

      // Close sidebar on mobile
      setMenuOpen(false);
    } catch (err) {
      console.error('Error en navegación:', err);
      toast.error('Error al buscar rutas. Intenta de nuevo.');
    } finally {
      setIsNavigating(false);
    }
  }, [canNavigate, incrementUsage, toast]);

  /**
   * Select a route option idx — updates the map display.
   */
  const handleSelectOptionIdx = useCallback((idx) => {
    setSelectedOptionIdx(idx);
  }, []);

  /**
   * Clear navigation results.
   */
  const handleClearNavigation = useCallback(() => {
    setNavigationResult(null);
    setSelectedOptionIdx(0);
    setOriginFromMap(null);
    setDestFromMap(null);
    setPreviewOrigin(null);
    setPreviewDestination(null);
    setPinMode(null);
  }, []);

  /**
   * Start live navigation with a selected route option.
   */
  const handleStartLiveNav = useCallback((option) => {
    setLiveNavOption(option);
    setLiveNavPhase(null);
    setMenuOpen(false);
    // GPS tracking will be handled by the LiveNavigation component
    // via the existing userPosition updates
  }, []);

  const handleCancelLiveNav = useCallback(() => {
    setLiveNavOption(null);
    setLiveNavPhase(null);
  }, []);

  /**
   * Handle map click for pin-drop.
   */
  const handleMapClick = useCallback((coords) => {
    if (pinMode === 'origin') {
      fxPinDrop();
      setOriginFromMap({ ...coords });
      setPreviewOrigin({ ...coords });
      setPinMode(null);
    } else if (pinMode === 'destination') {
      fxPinDrop();
      setDestFromMap({ ...coords });
      setPreviewDestination({ ...coords });
      setPinMode(null);
    }
  }, [pinMode]);

  const routeSelectReqRef = useRef(0);

  const handleClearSelectedRoute = useCallback(() => {
    routeSelectReqRef.current += 1;
    setLoadingRouteId(null);
    setSelectedRoute(null);
    setFocusedStop(null);
    setActiveOfficialVariant(null);
  }, []);

  /**
   * Select a route from the list (lazy-loads full geometry & stops if omitted).
   */
  const handleRouteSelect = useCallback(async (route) => {
    setNavigationResult(null);
    setFocusedStop(null);
    setActiveOfficialVariant(null);
    if (!route) {
      handleClearSelectedRoute();
      return;
    }

    if (selectedRoute?._id === route._id && loadingRouteId !== route._id) {
      handleClearSelectedRoute();
      return;
    }

    if (route.ida?.trazado?.coordinates?.length >= 2 && (route.sistema !== 'masivo' || route.paradasOficiales)) {
      routeSelectReqRef.current += 1;
      setLoadingRouteId(null);
      setSelectedRoute(route);
      if (!isDesktop) setMenuOpen(false);
      return;
    }

    // Show summary card immediately while full geometry & stops load
    const reqId = ++routeSelectReqRef.current;
    setLoadingRouteId(route._id);
    setSelectedRoute(route);
    if (!isDesktop) setMenuOpen(false);

    try {
      const res = await routesAPI.getById(route._id);
      if (routeSelectReqRef.current !== reqId || !res?.data) return;
      const fullRoute = res.data;
      setSelectedRoute(fullRoute);
      setRoutes(prev => prev.map(r => (r._id === fullRoute._id ? fullRoute : r)));
    } catch (err) {
      if (routeSelectReqRef.current === reqId) {
        console.error('Error cargando geometría de ruta:', err);
        toast.error('No se pudo cargar el trazado completo de la ruta');
      }
    } finally {
      if (routeSelectReqRef.current === reqId) {
        setLoadingRouteId(null);
      }
    }
  }, [selectedRoute, loadingRouteId, isDesktop, toast, handleClearSelectedRoute]);

  const handleToggleLayer = useCallback((layer) => {
    setLayerVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleCaptureToggle = useCallback((capturing) => {
    setIsCapturing(capturing);
    if (!capturing) setGpsTrack([]);
  }, []);

  const handlePositionUpdate = useCallback((position) => {
    setUserPosition(position);
  }, []);

  const handleTrackUpdate = useCallback((track) => {
    setGpsTrack(track);
  }, []);

  const handleStartCapture = useCallback(() => {
    if (isCapturing) {
      handleCaptureToggle(false);
    } else {
      if (!isAuthenticated) {
        toast.warning('Inicia sesión para capturar rutas GPS');
        setLoginReason(null);
        setShowLogin(true);
        return;
      }
      setShowCaptureConfig(true);
    }
  }, [isCapturing, handleCaptureToggle, isAuthenticated]);

  const handleOpenLogin = useCallback((reason = null) => {
    setLoginReason(reason);
    setShowLogin(true);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setShowLogin(false);
    setLoginReason(null);
  }, []);

  const handleSelectRouteByCode = useCallback((codigo) => {
    if (!codigo) return;
    const match = routes.find((r) => r.codigo === codigo || r.nombre === codigo);
    if (match) {
      handleRouteSelect(match);
    } else {
      toast.info(`La ruta ${codigo} no figura en el catálogo activo`);
    }
  }, [routes, handleRouteSelect, toast]);

  const handleReportRouteChange = useCallback((route) => {
    if (!route) return;
    if (!isAuthenticated) {
      toast.warning('Inicia sesión para reportar cambios en la ruta');
      setLoginReason(null);
      setShowLogin(true);
      return;
    }
    setReportTrigger({ route, defaultType: 'desvio', _t: Date.now() });
    if (!isDesktop) setMenuOpen(false);
  }, [isAuthenticated, isDesktop, toast]);

  const nativeApp = isNativeApp();

  useEffect(() => {
    if (!nativeApp) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#0D1014' }).catch(() => {});
    SplashScreen.hide().catch(() => {});

    const backSub = CapApp.addListener('backButton', () => {
      if (showLegal) { setShowLegal(null); return; }
      if (showLogin) { handleCloseLogin(); return; }
      if (showCommunity) { setShowCommunity(false); return; }
      if (selectedReport) { setSelectedReport(null); return; }
      if (showCaptureConfig) { setShowCaptureConfig(false); return; }
      if (liveNavOption) { handleCancelLiveNav(); return; }
      if (!isDesktop && menuOpen) { setMenuOpen(false); return; }
      if (navigationResult) { handleClearNavigation(); return; }
      if (selectedRoute) { handleClearSelectedRoute(); return; }
      CapApp.minimizeApp();
    });

    return () => {
      backSub.then((h) => h.remove()).catch(() => {});
    };
  }, [
    nativeApp, showLegal, showLogin, showCommunity, selectedReport, showCaptureConfig,
    liveNavOption, isDesktop, menuOpen, navigationResult, selectedRoute,
    handleCloseLogin, handleCancelLiveNav, handleClearNavigation, handleClearSelectedRoute,
  ]);

  if (nativeApp && authLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6" style={{ background: 'var(--bg-dark)' }}>
        <div className="rq-card animate-spring-up" style={{ width: '100%', maxWidth: 300, padding: '24px 20px', textAlign: 'center' }}>
          <div
            className="mx-auto mb-3 overflow-hidden"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              border: '1px solid rgba(255, 194, 26, 0.35)',
              background: 'var(--plate-bg)',
            }}
          >
            <img src="/logo.png" alt="RutaQuilla" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <p className="font-display text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
            RutaQuilla
          </p>
          <p className="text-xs mt-1 mb-0" style={{ color: 'var(--text-muted)' }}>
            Preparando tu sesión...
          </p>
        </div>
      </div>
    );
  }

  if (nativeApp && !isAuthenticated) {
    return (
      <div className="w-full h-full" style={{ background: 'var(--bg-dark)' }}>
        <AndroidAuthScreen onShowLegal={setShowLegal} />
        {showLegal && (
          <LegalPages
            page={showLegal}
            onClose={() => setShowLegal(null)}
            onNavigate={setShowLegal}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'var(--bg-dark)' }}>
      {/* Admin Panel — guard against flash while verifying JWT role */}
      {currentPage === 'admin' && authLoading ? (
        <div className="w-full h-full flex items-center justify-center p-6" style={{ background: 'var(--bg-dark)' }}>
          <div className="rq-card animate-fade-in" style={{ width: '100%', maxWidth: 320, padding: '24px 22px', textAlign: 'center' }}>
            <div
              className="font-mono mx-auto mb-3 inline-flex items-center justify-center px-3 py-1.5 rounded-md font-bold"
              style={{
                background: 'var(--plate-bg)',
                color: 'var(--plate-fg)',
                border: '1px solid rgba(255, 194, 26, 0.35)',
                borderLeft: '4px solid var(--brand)',
                fontSize: 12,
                letterSpacing: '0.08em',
              }}
            >
              ADMIN
            </div>
            <p className="font-display text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
              Verificando permisos de administrador
            </p>
            <p className="text-xs mt-1 mb-0" style={{ color: 'var(--text-muted)' }}>
              Validando sesión y credenciales
            </p>
          </div>
        </div>
      ) : currentPage === 'admin' && isAdmin ? (
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center p-6" style={{ background: 'var(--bg-dark)' }}>
            <div className="rq-card animate-fade-in" style={{ width: '100%', maxWidth: 320, padding: '24px 22px', textAlign: 'center' }}>
              <p className="font-display text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                Cargando centro de control...
              </p>
            </div>
          </div>
        }>
          <AdminPanel onBack={goToMain} />
        </Suspense>
      ) : (
      <>
      <Header
        onLoginClick={() => handleOpenLogin()}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        menuOpen={menuOpen}
        onShowLegal={setShowLegal}
        onAdminClick={isAdmin ? goToAdmin : undefined}
        routeCount={routes.length}
        canInstallPWA={Boolean(installPromptEvent)}
        onInstallPWA={handleInstallPWA}
      />

      <div className="flex-1 flex relative overflow-hidden" style={{ marginTop: 56 }}>
        <Sidebar
          routes={routes}
          isOpen={menuOpen}
          onRouteSelect={handleRouteSelect}
          selectedRoute={selectedRoute}
          loadingRouteId={loadingRouteId}
          onClearSelectedRoute={handleClearSelectedRoute}
          onFocusStop={(stop) => {
            setFocusedStop({ ...stop, _t: Date.now() });
            if (!isDesktop) setMenuOpen(false);
          }}
          activeOfficialVariant={activeOfficialVariant}
          onSelectOfficialVariant={setActiveOfficialVariant}
          onReportRouteChange={handleReportRouteChange}
          userPosition={userPosition}
          onRequestGPS={handleRequestGPS}
          transmetroStops={transmetroStops}
          loadingTransmetroStops={loadingTransmetroStops}
          onEnsureTransmetroStops={ensureTransmetroStopsLoaded}
          showTransmetroStops={showTransmetroStops}
          onToggleTransmetroStops={handleToggleTransmetroStops}
          onFocusTransmetroStop={(stop) => {
            handleToggleTransmetroStops(true);
            setFocusedTransmetroStop({ ...stop, _t: Date.now() });
            if (!isDesktop) setMenuOpen(false);
          }}
          onSelectRouteByCode={handleSelectRouteByCode}
          onToggleLayer={handleToggleLayer}
          layerVisibility={layerVisibility}
          onStartCapture={handleStartCapture}
          isCapturing={isCapturing}
          // Navigation props
          onNavigate={handleNavigate}
          onClearNavigation={handleClearNavigation}
          navigationResult={navigationResult}
          isNavigating={isNavigating}
          selectedOptionIdx={selectedOptionIdx}
          onSelectOptionIdx={handleSelectOptionIdx}
          onSetOriginFromMap={originFromMap}
          onSetDestinationFromMap={destFromMap}
          pinMode={pinMode}
          onPinModeChange={setPinMode}
          onPreviewOriginChange={setPreviewOrigin}
          onPreviewDestinationChange={setPreviewDestination}
          activeReports={activeReports}
        />

        {/* Dark overlay behind sidebar on mobile */}
        {menuOpen && !isDesktop && (
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1040,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              transition: 'opacity 0.3s',
            }}
          />
        )}

        <main className="flex-1 min-w-0 overflow-hidden relative" style={{ marginLeft: menuOpen && isDesktop ? '22.5rem' : 0, transition: 'margin-left 0.3s ease-out' }}>
          {activeBanner && (
            <div
              className="animate-fade-in"
              style={{
                position: 'absolute',
                top: isDesktop ? 56 : 52,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 45,
                maxWidth: 'min(92vw, 560px)',
                padding: '6px 12px',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                fontWeight: 600,
                boxShadow: 'var(--shadow-md)',
                background:
                  activeBanner.type === 'carnaval'
                    ? 'var(--carnaval)'
                    : activeBanner.type === 'warning'
                    ? 'var(--brand)'
                    : 'var(--caribe)',
                color: activeBanner.type === 'warning' ? '#14171C' : '#FFFFFF',
              }}
            >
              <Megaphone size={13} style={{ flexShrink: 0 }} />
              <span className="truncate">{activeBanner.text}</span>
              <button
                type="button"
                onClick={() => setBannerDismissedText(activeBanner.text)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  flexShrink: 0,
                }}
                aria-label="Cerrar aviso"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="w-full h-full flex items-center justify-center p-6">
              <div className="rq-card animate-fade-in" style={{ width: '100%', maxWidth: 320, padding: '24px 22px', textAlign: 'center' }}>
                <div
                  className="font-display mx-auto mb-3 flex items-center justify-center"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: 'var(--plate-bg)',
                    color: 'var(--plate-fg)',
                    border: '1px solid rgba(255, 194, 26, 0.3)',
                    borderLeft: '4px solid var(--brand)',
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  RQ
                </div>
                <p className="font-display text-base font-bold m-0" style={{ color: 'var(--text-primary)' }}>
                  Cargando red de rutas
                </p>
                <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
                  Sincronizando Barranquilla y área metropolitana
                </p>
                <div style={{ height: 3, borderRadius: 999, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: '55%',
                      height: '100%',
                      borderRadius: 999,
                      background: 'var(--brand)',
                      animation: 'rqProgress 1.2s ease-in-out infinite',
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <MapComponent
              navigationResult={navigationResult}
              selectedRoute={selectedRoute}
              loadingRouteId={loadingRouteId}
              focusedStop={focusedStop}
              activeOfficialVariant={activeOfficialVariant}
              onClearSelectedRoute={handleClearSelectedRoute}
              onOpenSidebarRoutes={() => setMenuOpen(true)}
              selectedOptionIdx={selectedOptionIdx}
              sponsoredLocations={sponsoredLocations}
              gpsTrack={gpsTrack}
              userPosition={userPosition}
              isCapturing={isCapturing}
              pinMode={pinMode}
              previewOrigin={previewOrigin}
              previewDestination={previewDestination}
              onMapClick={handleMapClick}
              onSetOrigin={(coords) => {
                setOriginFromMap({ ...coords, _t: Date.now() });
                setPreviewOrigin({ ...coords });
              }}
              onSetDestination={(coords) => {
                setDestFromMap({ ...coords, _t: Date.now() });
                setPreviewDestination({ ...coords });
              }}
              activeReports={activeReports}
              onReportClick={setSelectedReport}
              isLiveNav={Boolean(liveNavOption)}
              showTransmetroStops={showTransmetroStops}
              onToggleTransmetroStops={handleToggleTransmetroStops}
              transmetroStops={transmetroStops}
              loadingTransmetroStops={loadingTransmetroStops}
              focusedTransmetroStop={focusedTransmetroStop}
              onSelectRouteByCode={handleSelectRouteByCode}
              showRoadSafety={showRoadSafety}
              onToggleRoadSafety={handleToggleRoadSafety}
              roadSafetyPoints={roadSafetyPoints}
              loadingRoadSafety={loadingRoadSafety}
            />
          )}
        </main>
      </div>

      <GPSTracker
        isCapturing={isCapturing}
        onCaptureToggle={handleCaptureToggle}
        onPositionUpdate={handlePositionUpdate}
        onTrackUpdate={handleTrackUpdate}
        showConfigModal={showCaptureConfig}
        onCloseConfigModal={() => setShowCaptureConfig(false)}
      />

      <LoginModal
        isOpen={showLogin}
        onClose={handleCloseLogin}
        reason={loginReason}
        onShowLegal={setShowLegal}
      />

      {showLegal && (
        <LegalPages
          page={showLegal}
          onClose={() => setShowLegal(null)}
          onNavigate={setShowLegal}
        />
      )}

      <StorageNotice onShowPrivacy={() => setShowLegal('privacy')} />

      {/* Floating bottom bar for map-picked points (mobile-friendly) */}
      {!hideMobileMapChrome && (
        <MapQuickBar
          originFromMap={originFromMap}
          destFromMap={destFromMap}
          previewOrigin={previewOrigin}
          previewDestination={previewDestination}
          onNavigate={handleNavigate}
          onClear={handleClearNavigation}
          isNavigating={isNavigating}
          navigationResult={navigationResult}
        />
      )}

      {/* Route result bar (replaces MapQuickBar when results exist) */}
      {!liveNavOption && !hideMobileMapChrome && (
        <RouteResultBar
          navigationResult={navigationResult}
          selectedOptionIdx={selectedOptionIdx}
          onSelectOptionIdx={handleSelectOptionIdx}
          onClear={handleClearNavigation}
          onStartLiveNav={handleStartLiveNav}
        />
      )}

      {/* Live Navigation overlay */}
      {liveNavOption && navigationResult && (
        <LiveNavigation
          navigationOption={liveNavOption}
          origin={navigationResult.origin}
          destination={navigationResult.destination}
          userPosition={userPosition}
          onCancel={handleCancelLiveNav}
          onPhaseChange={setLiveNavPhase}
        />
      )}

      {/* Incident Reporter (floating button + modal) — hidden during live nav or open mobile drawer */}
      {!liveNavOption && !hideMobileMapChrome && (
        <IncidentReporter
          routes={routes}
          userPosition={userPosition}
          onReportCreated={loadActiveReports}
          bottomOffset={fabBottom}
          compact={!isDesktop}
          reportTrigger={reportTrigger}
          onClearReportTrigger={() => setReportTrigger(null)}
        />
      )}

      {/* Report Action Panel (confirm / dismiss) */}
      {selectedReport && (
        <ReportActionPanel
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onActionDone={loadActiveReports}
        />
      )}

      {/* Community toggle button — hidden during live nav, open mobile drawer, or mobile navigation result */}
      {!liveNavOption && !hideMobileMapChrome && (isDesktop || !navigationResult) && (
      <button
        onClick={() => setShowCommunity(true)}
        style={{
          position: 'fixed',
          bottom: fabBottom + (isDesktop ? 54 : 48),
          right: isDesktop ? 16 : 10,
          zIndex: 1100,
          width: isDesktop ? 44 : 40,
          height: isDesktop ? 44 : 40,
          borderRadius: isDesktop ? 12 : 10,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          color: 'var(--brand)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'bottom 0.25s ease, transform 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--brand)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }}
        title="Comunidad Quilla"
        aria-label="Abrir Comunidad Quilla"
      >
        <Trophy size={isDesktop ? 19 : 17} />
      </button>
      )}

      {/* Community Hub (ranking + feed + profile) */}
      <CommunityHub
        isOpen={showCommunity}
        onClose={() => setShowCommunity(false)}
      />
      </>
      )}
    </div>
  );
}
