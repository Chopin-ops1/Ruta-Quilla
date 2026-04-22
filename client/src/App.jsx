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

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { routesAPI, mapsAPI } from './services/api';
import { getCurrentPosition } from './services/gpsService';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import GPSTracker from './components/GPSTracker';
import LoginModal from './components/LoginModal';
import LegalPages from './components/LegalPages';
import CookieConsent from './components/CookieConsent';
import MapQuickBar from './components/MapQuickBar';

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
  const [loading, setLoading] = useState(true);

  // ---- Navigation state ----
  const [navigationResult, setNavigationResult] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);

  // ---- Pin-drop mode ----
  const [pinMode, setPinMode] = useState(null); // 'origin' | 'destination' | null
  const [originFromMap, setOriginFromMap] = useState(null);
  const [destFromMap, setDestFromMap] = useState(null);

  // ---- Map layer visibility ----
  const [layerVisibility, setLayerVisibility] = useState({
    official: true,
    community: true,
  });

  // ---- GPS capture state ----
  const [isCapturing, setIsCapturing] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const [gpsTrack, setGpsTrack] = useState([]);

  const { isPremium, isAuthenticated, isAdmin, canNavigate, incrementUsage, remainingFreeSearches } = useAuth();

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
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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

      // Increment usage counter (only for non-authenticated users)
      incrementUsage();

      // Close sidebar on mobile
      setMenuOpen(false);
    } catch (err) {
      console.error('Error en navegación:', err);
      alert('Error al buscar rutas. Intenta de nuevo.');
    } finally {
      setIsNavigating(false);
    }
  }, [canNavigate, incrementUsage]);

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
    setPinMode(null);
  }, []);

  /**
   * Handle map click for pin-drop.
   */
  const handleMapClick = useCallback((coords) => {
    if (pinMode === 'origin') {
      setOriginFromMap({ ...coords });
      setPinMode(null);
    } else if (pinMode === 'destination') {
      setDestFromMap({ ...coords });
      setPinMode(null);
    }
  }, [pinMode]);

  /**
   * Select a route from the list (preview only that route on map).
   */
  const handleRouteSelect = useCallback((route) => {
    // Clear navigation when viewing individual routes
    setNavigationResult(null);
    setSelectedRoute(prev => prev?._id === route._id ? null : route);
    setMenuOpen(false);
  }, []);

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
      setIsCapturing(true);
    }
  }, [isCapturing, handleCaptureToggle]);

  const handleOpenLogin = useCallback((reason = null) => {
    setLoginReason(reason);
    setShowLogin(true);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setShowLogin(false);
    setLoginReason(null);
  }, []);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'var(--bg-dark)' }}>
      {/* Admin Panel — separate full-screen page (lazy loaded) */}
      {currentPage === 'admin' && isAdmin ? (
        <Suspense fallback={
          <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔧</div>
              <p style={{ color: '#94A3B8', fontSize: 14 }}>Cargando panel de administración...</p>
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
      />

      <div className="flex-1 flex relative" style={{ marginTop: 56 }}>
        <Sidebar
          routes={routes}
          isOpen={menuOpen}
          onRouteSelect={(route) => {
            handleRouteSelect(route);
            // Auto-close sidebar on mobile after selecting a route
            if (!isDesktop) setMenuOpen(false);
          }}
          selectedRoute={selectedRoute}
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

        <main className="flex-1 relative" style={{ marginLeft: menuOpen && isDesktop ? '20rem' : 0, transition: 'margin-left 0.3s ease-out' }}>
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center animate-fade-in">
                <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    animation: 'spin-slow 2s linear infinite',
                  }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Cargando RutaQuilla...
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Conectando con el servidor
                </p>
              </div>
            </div>
          ) : (
            <MapComponent
              navigationResult={navigationResult}
              selectedRoute={selectedRoute}
              selectedOptionIdx={selectedOptionIdx}
              sponsoredLocations={sponsoredLocations}
              gpsTrack={gpsTrack}
              userPosition={userPosition}
              isCapturing={isCapturing}
              pinMode={pinMode}
              onMapClick={handleMapClick}
              onSetOrigin={(coords) => {
                setOriginFromMap({ ...coords, _t: Date.now() });
              }}
              onSetDestination={(coords) => {
                setDestFromMap({ ...coords, _t: Date.now() });
              }}
            />
          )}
        </main>
      </div>

      <GPSTracker
        isCapturing={isCapturing}
        onCaptureToggle={handleCaptureToggle}
        onPositionUpdate={handlePositionUpdate}
        onTrackUpdate={handleTrackUpdate}
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

      <CookieConsent onShowPrivacy={() => setShowLegal('privacy')} />

      {/* Floating bottom bar for map-picked points (mobile-friendly) */}
      <MapQuickBar
        originFromMap={originFromMap}
        destFromMap={destFromMap}
        onNavigate={handleNavigate}
        onClear={handleClearNavigation}
        isNavigating={isNavigating}
        navigationResult={navigationResult}
      />
      </>
      )}
    </div>
  );
}
