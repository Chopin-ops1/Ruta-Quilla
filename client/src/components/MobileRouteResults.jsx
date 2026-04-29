/**
 * ============================================
 * RutaQuilla - MobileRouteResults
 * ============================================
 *
 * Bottom-sheet minimalista para smartphones que muestra
 * los resultados de navegación directamente sobre el mapa.
 *
 * Se activa SOLO en móvil cuando hay navigationResult
 * y el sidebar está cerrado. Permite:
 * - Ver las opciones de ruta óptimas
 * - Seleccionar entre ellas (toca para cambiar)
 * - Expandir detalles paso a paso
 * - Cerrar/limpiar la búsqueda
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bus, Clock, Footprints, Star, X,
  ChevronUp, ChevronDown, MapPin, Navigation,
  CornerDownRight, ArrowUp,
} from 'lucide-react';

export default function MobileRouteResults({
  navigationResult,
  selectedOptionIdx = 0,
  onSelectOptionIdx,
  onClear,
  onStartLiveNav,
}) {
  const [expandedOption, setExpandedOption] = useState(null);
  const [sheetState, setSheetState] = useState('peek'); // 'peek' | 'half' | 'full'
  const sheetRef = useRef(null);
  const dragRef = useRef({ startY: 0, startHeight: 0, isDragging: false });

  const options = navigationResult?.options || [];

  // Reset state when navigation result changes
  useEffect(() => {
    setExpandedOption(null);
    setSheetState('peek');
  }, [navigationResult]);

  // Don't render on desktop or when no results
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isMobile || !navigationResult || options.length === 0) return null;

  const selectedOpt = options[selectedOptionIdx];

  // Sheet height configs
  const peekHeight = 160;  // Shows top option summary
  const halfHeight = Math.min(420, window.innerHeight * 0.55);
  const fullHeight = window.innerHeight * 0.85;

  const getSheetHeight = () => {
    switch (sheetState) {
      case 'peek': return peekHeight;
      case 'half': return halfHeight;
      case 'full': return fullHeight;
      default: return peekHeight;
    }
  };

  const handleDragStart = (e) => {
    const clientY = e.touches?.[0]?.clientY || e.clientY;
    dragRef.current = {
      startY: clientY,
      startHeight: getSheetHeight(),
      isDragging: true,
    };
  };

  const handleDragMove = (e) => {
    if (!dragRef.current.isDragging) return;
    const clientY = e.touches?.[0]?.clientY || e.clientY;
    const diff = dragRef.current.startY - clientY;
    const newHeight = Math.max(100, Math.min(fullHeight, dragRef.current.startHeight + diff));

    if (sheetRef.current) {
      sheetRef.current.style.height = `${newHeight}px`;
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleDragEnd = (e) => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    const clientY = e.changedTouches?.[0]?.clientY || e.clientY;
    const diff = dragRef.current.startY - clientY;
    const currentHeight = dragRef.current.startHeight + diff;

    // Snap to nearest state
    if (currentHeight < peekHeight + 40) {
      setSheetState('peek');
    } else if (currentHeight < halfHeight + 60) {
      setSheetState('half');
    } else {
      setSheetState('full');
    }

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  };

  const cycleSheet = () => {
    if (sheetState === 'peek') setSheetState('half');
    else if (sheetState === 'half') setSheetState('full');
    else setSheetState('peek');
  };

  return (
    <div
      ref={sheetRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        height: getSheetHeight(),
        borderRadius: '22px 22px 0 0',
        background: 'rgba(7, 11, 22, 0.97)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderBottom: 'none',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
        transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Gradient accent bar */}
      <div style={{
        height: 2,
        background: 'linear-gradient(90deg, #10B981, #F59E0B, #EF4444)',
        flexShrink: 0,
      }} />

      {/* Drag handle */}
      <div
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onClick={cycleSheet}
        style={{
          padding: '10px 0 6px',
          cursor: 'grab',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          touchAction: 'none',
        }}
      >
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.2)',
        }} />
      </div>

      {/* Header row: title + close */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px 10px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 9,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(6,182,212,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Navigation size={13} color="#F59E0B" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
              {options.length} ruta{options.length > 1 ? 's' : ''} encontrada{options.length > 1 ? 's' : ''}
            </p>
            <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>
              Toca para ver detalles
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {/* Expand/collapse button */}
          <button
            onClick={cycleSheet}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {sheetState === 'full' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {/* Close button */}
          <button
            onClick={onClear}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#F87171',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable options list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 12px 12px',
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map((opt, idx) => {
            const isSelected = selectedOptionIdx === idx;
            const isExpanded = expandedOption === idx;
            return (
              <button
                key={idx}
                id={`mobile-route-option-${idx}`}
                onClick={() => {
                  onSelectOptionIdx?.(idx);
                  setExpandedOption(isExpanded ? null : idx);
                  // Auto-expand sheet if in peek mode
                  if (sheetState === 'peek') setSheetState('half');
                }}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  padding: 0, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  borderRadius: 16, overflow: 'hidden',
                  background: isSelected ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${isSelected ? (opt.route.color || '#555') + '50' : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: isSelected ? `0 4px 16px ${(opt.route.color || '#555')}18` : 'none',
                  transition: 'all 0.25s',
                }}>
                  {/* Colored accent bar */}
                  <div style={{
                    height: 3,
                    background: isSelected
                      ? `linear-gradient(90deg, ${opt.route.color}, ${opt.route.color}60)`
                      : 'transparent',
                    transition: 'all 0.3s',
                  }} />

                  <div style={{ padding: '10px 12px' }}>
                    {/* Optimal badge */}
                    {opt.isOptimal && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        marginBottom: 6, padding: '2px 8px', borderRadius: 20,
                        background: 'rgba(251,191,36,0.12)',
                        border: '1px solid rgba(251,191,36,0.25)',
                      }}>
                        <Star size={9} style={{ color: '#FBBF24', fill: '#FBBF24' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Mejor opción
                        </span>
                      </div>
                    )}

                    {/* Route info row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        background: `${opt.route.color}18`,
                        border: `1px solid ${opt.route.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Bus size={14} style={{ color: opt.route.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 600, color: '#F1F5F9', margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {opt.route.name || opt.route.nombre}
                        </p>
                        <p style={{ fontSize: 10, color: opt.route.color, margin: 0, marginTop: 1 }}>
                          {opt.route.company || opt.route.operador}
                        </p>
                      </div>
                      {/* Direction pill */}
                      <div style={{
                        padding: '3px 7px', borderRadius: 7,
                        background: opt.direction === 'ida' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                        border: `1px solid ${opt.direction === 'ida' ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.25)'}`,
                        flexShrink: 0,
                      }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          color: opt.direction === 'ida' ? '#34D399' : '#A78BFA',
                        }}>
                          {opt.direction === 'ida' ? 'IDA' : 'VUELTA'}
                        </span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Time */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: 'rgba(245,158,11,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Clock size={11} color="#F59E0B" />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#F59E0B' }}>~{opt.totalMinutes}</span>
                        <span style={{ fontSize: 10, color: '#475569' }}>min</span>
                      </div>

                      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)' }} />

                      {/* Walk */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Footprints size={11} color="#60A5FA" />
                        <span style={{ fontSize: 11, color: '#475569' }}>{opt.totalWalkMinutes} min a pie</span>
                      </div>

                      {/* Fare */}
                      <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>
                        ${opt.route.fare?.toLocaleString()}
                      </div>
                    </div>

                    {/* Expanded step-by-step */}
                    {isExpanded && (
                      <div className="animate-fade-in" style={{
                        paddingTop: 10, marginTop: 10,
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        {[
                          {
                            icon: <Footprints size={12} />, color: '#60A5FA',
                            label: `Caminar ${opt.boardPoint.walkDistance}m (~${opt.boardPoint.walkMinutes} min)`,
                            sub: 'Hasta donde pasa la ruta',
                          },
                          {
                            icon: <Bus size={12} />, color: opt.route.color,
                            label: `${opt.route.nombre || opt.route.name} (~${opt.busMinutes} min)`,
                            sub: 'En bus',
                          },
                          {
                            icon: <MapPin size={12} />, color: '#F87171',
                            label: opt.alightPoint.walkDistance < 50
                              ? 'El bus pasa frente a tu destino 🎯'
                              : `Caminar ${opt.alightPoint.walkDistance}m al destino`,
                            sub: opt.alightPoint.walkDistance < 50 ? 'Bájate ahí mismo' : `~${opt.alightPoint.walkMinutes} min`,
                          },
                        ].map((step, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                              background: `${step.color}14`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: step.color, marginTop: 1,
                            }}>
                              {step.icon}
                            </div>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 500, color: step.color, margin: 0 }}>{step.label}</p>
                              <p style={{ fontSize: 10, color: '#475569', margin: 0, marginTop: 1 }}>{step.sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Live navigation button (inside expanded) */}
                    {isExpanded && onStartLiveNav && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onStartLiveNav(opt); }}
                        style={{
                          width: '100%', marginTop: 8, padding: '10px 0',
                          borderRadius: 11, border: 'none',
                          background: 'linear-gradient(135deg, #10B981, #059669)',
                          color: '#fff',
                          fontSize: 12, fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                        }}
                      >
                        <Navigation size={13} /> 🧭 Iniciar Ruta
                      </button>
                    )}

                    {/* Expand hint */}
                    <div style={{
                      display: 'flex', justifyContent: 'center',
                      marginTop: isExpanded ? 8 : 4,
                      paddingTop: isExpanded ? 6 : 0,
                      borderTop: isExpanded ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                      {isExpanded
                        ? <ChevronUp size={13} color="#334155" />
                        : <ChevronDown size={13} color="#334155" />}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
