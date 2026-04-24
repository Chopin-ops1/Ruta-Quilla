/**
 * ============================================
 * RutaQuilla - RouteResultBar (Bottom Result Bar)
 * ============================================
 *
 * Floating bar that replaces MapQuickBar when navigation
 * results arrive. Shows the optimal route summary with
 * an expandable list of alternative routes.
 *
 * Works on ALL screen sizes (desktop + mobile).
 */

import { useState, useEffect } from 'react';
import {
  Bus, Clock, Footprints, Star, X,
  ChevronUp, ChevronDown, MapPin,
  Navigation, CornerDownRight,
} from 'lucide-react';

export default function RouteResultBar({
  navigationResult,
  selectedOptionIdx = 0,
  onSelectOptionIdx,
  onClear,
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);

  const options = navigationResult?.options || [];

  // Reset when new results come in
  useEffect(() => {
    setShowAll(false);
    setExpandedStep(null);
  }, [navigationResult]);

  if (!navigationResult || options.length === 0) return null;

  const selectedOpt = options[selectedOptionIdx] || options[0];
  const optimalIdx = options.findIndex(o => o.isOptimal);
  const optimalOpt = optimalIdx >= 0 ? options[optimalIdx] : options[0];

  const handleSelectOption = (idx) => {
    onSelectOptionIdx?.(idx);
    setExpandedStep(expandedStep === idx ? null : idx);
  };

  const handleClose = () => {
    setShowAll(false);
    setExpandedStep(null);
    onClear?.();
  };

  return (
    <div
      className="animate-slide-up"
      style={{
        position: 'fixed',
        bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        left: '50%', translate: '-50% 0',
        zIndex: 1200,
        width: 'calc(100% - 24px)', maxWidth: 440,
        borderRadius: 20,
        background: 'rgba(7, 11, 22, 0.96)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
        overflow: 'hidden',
        maxHeight: showAll ? '70vh' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Gradient accent */}
      <div style={{
        height: 2, flexShrink: 0,
        background: `linear-gradient(90deg, ${optimalOpt.route.color || '#F59E0B'}, #F59E0B, ${optimalOpt.route.color || '#F59E0B'}60)`,
      }} />

      <div style={{ padding: '10px 14px 12px', flexShrink: 0 }}>
        {/* Header: optimal route summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {/* Bus icon with route color */}
          <div style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            background: `${selectedOpt.route.color || '#F59E0B'}15`,
            border: `1.5px solid ${selectedOpt.route.color || '#F59E0B'}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bus size={16} style={{ color: selectedOpt.route.color || '#F59E0B' }} />
          </div>

          {/* Route name + company */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {selectedOpt.isOptimal && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '1px 6px', borderRadius: 10,
                  background: 'rgba(251,191,36,0.12)',
                  border: '1px solid rgba(251,191,36,0.25)',
                }}>
                  <Star size={8} style={{ color: '#FBBF24', fill: '#FBBF24' }} />
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Óptima
                  </span>
                </div>
              )}
              <div style={{
                padding: '1px 5px', borderRadius: 6,
                background: selectedOpt.direction === 'ida' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                border: `1px solid ${selectedOpt.direction === 'ida' ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.25)'}`,
              }}>
                <span style={{
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                  color: selectedOpt.direction === 'ida' ? '#34D399' : '#A78BFA',
                }}>
                  {selectedOpt.direction === 'ida' ? 'IDA' : 'VUELTA'}
                </span>
              </div>
            </div>
            <p style={{
              fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0, marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {selectedOpt.route.name || selectedOpt.route.nombre}
            </p>
            <p style={{ fontSize: 10, color: selectedOpt.route.color || '#94A3B8', margin: 0, marginTop: 1 }}>
              {selectedOpt.route.company || selectedOpt.route.operador}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#F87171', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {/* Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} color="#F59E0B" />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#F59E0B' }}>~{selectedOpt.totalMinutes}</span>
            <span style={{ fontSize: 10, color: '#64748B' }}>min</span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)' }} />

          {/* Walk */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Footprints size={12} color="#60A5FA" />
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{selectedOpt.totalWalkMinutes} min</span>
          </div>

          {/* Fare */}
          <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>
            ${selectedOpt.route.fare?.toLocaleString()}
          </div>
        </div>

        {/* Step-by-step (always visible for selected) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 8, padding: '0 2px',
        }}>
          {/* Walk to board */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Footprints size={10} color="#60A5FA" />
            <span style={{ fontSize: 10, color: '#60A5FA', fontWeight: 500 }}>
              {selectedOpt.boardPoint.walkDistance}m
            </span>
          </div>
          <CornerDownRight size={9} color="#334155" />
          {/* Bus ride */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Bus size={10} color={selectedOpt.route.color} />
            <span style={{ fontSize: 10, color: selectedOpt.route.color, fontWeight: 500 }}>
              ~{selectedOpt.busMinutes} min
            </span>
          </div>
          <CornerDownRight size={9} color="#334155" />
          {/* Walk from alight */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={10} color="#F87171" />
            <span style={{ fontSize: 10, color: '#F87171', fontWeight: 500 }}>
              {selectedOpt.alightPoint.walkDistance < 50 ? '¡Directo! 🎯' : `${selectedOpt.alightPoint.walkDistance}m`}
            </span>
          </div>
        </div>

        {/* Button: show more options */}
        {options.length > 1 && (
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              width: '100%', marginTop: 8, padding: '8px 0',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: showAll ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.08)',
              color: showAll ? '#94A3B8' : '#F59E0B',
              fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            {showAll ? (
              <><ChevronUp size={13} /> Ocultar opciones</>
            ) : (
              <><ChevronDown size={13} /> Ver {options.length - 1} ruta{options.length - 1 > 1 ? 's' : ''} más</>
            )}
          </button>
        )}
      </div>

      {/* Expanded list of alternative routes */}
      {showAll && (
        <div
          className="animate-fade-in"
          style={{
            flex: 1, overflowY: 'auto',
            padding: '0 12px 12px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <p style={{
            fontSize: 10, fontWeight: 600, color: '#475569',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            margin: '10px 4px 8px',
          }}>
            Otras rutas sugeridas
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {options.map((opt, idx) => {
              if (idx === selectedOptionIdx) return null; // skip current
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    borderRadius: 14, overflow: 'hidden',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s',
                  }}>
                    {/* Color bar */}
                    <div style={{ height: 2, background: `${opt.route.color || '#555'}40` }} />

                    <div style={{ padding: '9px 11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: `${opt.route.color || '#555'}12`,
                          border: `1px solid ${opt.route.color || '#555'}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Bus size={13} style={{ color: opt.route.color || '#555' }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 12, fontWeight: 600, color: '#E2E8F0', margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {opt.route.name || opt.route.nombre}
                          </p>
                          <p style={{ fontSize: 9, color: '#475569', margin: 0, marginTop: 1 }}>
                            {opt.route.company || opt.route.operador} • {opt.direction === 'ida' ? 'Ida' : 'Vuelta'}
                          </p>
                        </div>

                        {/* Quick stats */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', margin: 0 }}>
                            ~{opt.totalMinutes} min
                          </p>
                          <p style={{ fontSize: 9, color: '#475569', margin: 0, marginTop: 1 }}>
                            {opt.totalWalkMinutes} min a pie
                          </p>
                        </div>
                      </div>

                      {/* Step detail (expanded) */}
                      {expandedStep === idx && (
                        <div className="animate-fade-in" style={{
                          marginTop: 8, paddingTop: 8,
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Footprints size={9} color="#60A5FA" />
                            <span style={{ fontSize: 9, color: '#60A5FA' }}>{opt.boardPoint.walkDistance}m</span>
                          </div>
                          <CornerDownRight size={8} color="#334155" />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Bus size={9} color={opt.route.color} />
                            <span style={{ fontSize: 9, color: opt.route.color }}>~{opt.busMinutes} min</span>
                          </div>
                          <CornerDownRight size={8} color="#334155" />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={9} color="#F87171" />
                            <span style={{ fontSize: 9, color: '#F87171' }}>
                              {opt.alightPoint.walkDistance < 50 ? 'Directo' : `${opt.alightPoint.walkDistance}m`}
                            </span>
                          </div>
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#F59E0B' }}>
                            ${opt.route.fare?.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
