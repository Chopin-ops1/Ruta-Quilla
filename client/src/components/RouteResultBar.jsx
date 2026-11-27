/**
 * ============================================
 * RutaQuilla - RouteResultBar v5 (Hoja Compacta y Sutil)
 * ============================================
 *
 * Tarjeta flotante minimalista:
 * - Vista compacta por defecto para mantener despejado el trazado del mapa
 * - Acciones directas en una fila: compartir recorrido, iniciar guía GPS o expandir detalles
 * - Sin jerga técnica ni referencias internas visibles para el usuario
 */

import { useState } from 'react';
import {
  Bus,
  Footprints,
  Star,
  X,
  ChevronUp,
  ChevronDown,
  MapPin,
  Navigation,
  CornerDownRight,
  Share2,
} from 'lucide-react';
import { shareRouteSummary } from '../utils/platform';
import { fxTap } from '../utils/soundAndHaptics';
import { useToast } from '../context/ToastContext';

function RouteResultBarContent({
  navigationResult,
  selectedOptionIdx,
  onSelectOptionIdx,
  onClear,
  onStartLiveNav,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);
  const toast = useToast();

  const options = navigationResult.options;
  const selectedOpt = options[selectedOptionIdx] || options[0];
  const routeCol = selectedOpt.route.color || '#FFC21A';
  const mainRouteName =
    selectedOpt.isTransfer && selectedOpt.transfer?.secondRoute
      ? `${selectedOpt.route.name || selectedOpt.route.nombre} → ${
          selectedOpt.transfer.secondRoute.codigo ? `[${selectedOpt.transfer.secondRoute.codigo}] ` : ''
        }${selectedOpt.transfer.secondRoute.name}`
      : selectedOpt.route.name || selectedOpt.route.nombre;

  const handleSelectOption = (idx) => {
    fxTap();
    onSelectOptionIdx?.(idx);
    setExpandedStep(expandedStep === idx ? null : idx);
  };

  const handleClose = () => {
    fxTap();
    setShowDetails(false);
    setExpandedStep(null);
    onClear?.();
  };

  const handleShare = async () => {
    fxTap();
    const codigo = selectedOpt.route.codigo ? `[${selectedOpt.route.codigo}] ` : '';
    const op = selectedOpt.route.company || selectedOpt.route.operador || '';
    const text = `🚌 Ruta sugerida en RutaQuilla: ${codigo}${mainRouteName}${op ? ` (${op})` : ''} · ~${selectedOpt.totalMinutes} min · Camina ${selectedOpt.boardPoint.walkDistance} m para abordar.`;
    const res = await shareRouteSummary({ title: 'Mi ruta en RutaQuilla', text });
    if (res?.method === 'clipboard') {
      toast.success('Resumen de ruta copiado al portapapeles');
    }
  };

  const nearestStopText = selectedOpt.boardPoint?.nearestStop
    ? `Paradero cercano: ${selectedOpt.boardPoint.nearestStop.nombre} (${selectedOpt.boardPoint.nearestStop.distance} m)`
    : selectedOpt.alightPoint?.nearestStop
    ? `Descenso cercano: ${selectedOpt.alightPoint.nearestStop.nombre}`
    : null;

  const hasExtraDetails = Boolean(nearestStopText) || options.length > 1;

  return (
    <div
      className="animate-spring-up rq-sheet"
      style={{
        '--route-color': routeCol,
        position: 'fixed',
        bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        translate: '-50% 0',
        zIndex: 1200,
        width: 'calc(100% - 18px)',
        maxWidth: 440,
        overflow: 'hidden',
        maxHeight: showDetails ? '54vh' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ height: 3, flexShrink: 0, background: routeCol }} />

      <div style={{ padding: '8px 11px 9px', flexShrink: 0 }}>
        {/* Fila superior compacta: Placa + Nombre + Tiempo/Tarifa + Cerrar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              {selectedOpt.route.codigo && (
                <span className="transit-code flex-shrink-0" style={{ fontSize: 10, padding: '1px 6px' }}>
                  {selectedOpt.route.codigo}
                </span>
              )}
              <p
                className="font-display"
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {mainRouteName}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: routeCol }}>
                {selectedOpt.isTransfer && selectedOpt.transfer?.secondRoute
                  ? `${selectedOpt.route.company || selectedOpt.route.operador} + ${selectedOpt.transfer.secondRoute.company}`
                  : selectedOpt.route.company || selectedOpt.route.operador}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: selectedOpt.direction === 'ida' ? 'var(--mangle)' : 'var(--carnaval)',
                }}
              >
                {selectedOpt.direction === 'ida' ? 'Ida' : 'Vuelta'}
              </span>
              {selectedOpt.isOptimal && (
                <span
                  className="font-mono"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    fontSize: 8.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  <Star size={7} fill="currentColor" /> Óptima
                </span>
              )}
              {selectedOpt.isTransfer && (
                <span
                  className="font-mono"
                  style={{
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'var(--caribe-soft)',
                    color: 'var(--caribe)',
                    fontSize: 8.5,
                    fontWeight: 700,
                  }}
                >
                  1 transbordo
                </span>
              )}
              {selectedOpt.transfer?.sistemasNoIntegrados && (
                <span
                  className="font-mono"
                  style={{
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'var(--brand-soft)',
                    color: 'var(--brand)',
                    fontSize: 8.5,
                    fontWeight: 700,
                  }}
                >
                  2 pasajes
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                ~{selectedOpt.totalMinutes}
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 1 }}>m</span>
              </div>
              <div className="tabular-nums" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', marginTop: 2 }}>
                ${selectedOpt.route.fare?.toLocaleString()}
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Cerrar resultados"
              className="rq-icon-btn rq-pressable"
              style={{ width: 26, height: 26 }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Fila única compacta: resumen tramos + Compartir + Iniciar guía + Detalles/Opciones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 8px',
              borderRadius: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            <Footprints size={11} color="var(--caribe)" className="flex-shrink-0" />
            <span className="tabular-nums text-[10.5px] font-semibold truncate" style={{ color: 'var(--caribe)' }}>
              {selectedOpt.boardPoint.walkDistance}m
            </span>
            <CornerDownRight size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <Bus size={11} color={routeCol} className="flex-shrink-0" />
            <span className="tabular-nums text-[10.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              ~{selectedOpt.busMinutes}m
            </span>
            <CornerDownRight size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <MapPin size={11} color="var(--carnaval)" className="flex-shrink-0" />
            <span className="tabular-nums text-[10.5px] font-semibold truncate" style={{ color: 'var(--carnaval)' }}>
              {selectedOpt.alightPoint.walkDistance < 50 ? 'Directo' : `${selectedOpt.alightPoint.walkDistance}m`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            title="Compartir ruta"
            aria-label="Compartir ruta"
            className="rq-icon-btn rq-pressable"
            style={{ width: 30, height: 30, flexShrink: 0 }}
          >
            <Share2 size={13} />
          </button>

          {onStartLiveNav && (
            <button
              type="button"
              onClick={() => {
                fxTap();
                onStartLiveNav(selectedOpt);
              }}
              className="rq-pressable"
              style={{
                height: 30,
                padding: '0 11px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--mangle)',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
              }}
            >
              <Navigation size={12} />
              <span>Ir</span>
            </button>
          )}

          {hasExtraDetails && (
            <button
              type="button"
              onClick={() => {
                fxTap();
                setShowDetails((v) => !v);
              }}
              className="rq-chip rq-pressable"
              style={{
                height: 30,
                padding: '0 8px',
                fontSize: 10.5,
                flexShrink: 0,
              }}
              aria-label="Ver detalles y otras rutas"
            >
              {options.length > 1 && <span>+{options.length - 1}</span>}
              {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Detalles y opciones alternativas (expandible) */}
      {showDetails && (
        <div
          className="animate-fade-in"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 11px 10px',
            borderTop: '1px solid var(--border-color)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {nearestStopText && (
            <div
              style={{
                marginBottom: options.length > 1 ? 9 : 0,
                padding: '6px 9px',
                borderRadius: 8,
                background: 'var(--caribe-soft)',
                border: '1px solid color-mix(in srgb, var(--caribe) 26%, transparent)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <MapPin size={11} color="var(--caribe)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{nearestStopText}</span>
            </div>
          )}

          {options.length > 1 && (
            <>
              <div className="rq-section-label mb-1.5">Otras opciones sugeridas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {options.map((opt, idx) => {
                  if (idx === selectedOptionIdx) return null;
                  const altCol = opt.route.color || '#FFC21A';
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        className="rq-card"
                        style={{
                          '--route-color': altCol,
                          padding: '8px 10px',
                          borderLeft: `3px solid ${altCol}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {opt.route.codigo && (
                            <span className="transit-code flex-shrink-0">{opt.route.codigo}</span>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              className="font-display"
                              style={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                margin: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {opt.isTransfer && opt.transfer?.secondRoute
                                ? `${opt.route.name || opt.route.nombre} → ${opt.transfer.secondRoute.name}`
                                : opt.route.name || opt.route.nombre}
                            </p>
                            <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: '1px 0 0' }}>
                              {opt.route.company || opt.route.operador} · {opt.direction === 'ida' ? 'Ida' : 'Vuelta'}
                              {opt.isTransfer ? ' · 1 transbordo' : ''}
                            </p>
                          </div>

                          <div className="tabular-nums" style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                              ~{opt.totalMinutes}m
                            </p>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '1px 0 0' }}>
                              {opt.totalWalkMinutes}m a pie
                            </p>
                          </div>
                        </div>

                        {expandedStep === idx && (
                          <div
                            className="animate-fade-in"
                            style={{
                              marginTop: 7,
                              paddingTop: 7,
                              borderTop: '1px solid var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span className="tabular-nums text-[10px]" style={{ color: 'var(--caribe)' }}>
                              {opt.boardPoint.walkDistance}m a pie
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>·</span>
                            <span className="tabular-nums text-[10px]" style={{ color: 'var(--text-primary)' }}>
                              ~{opt.busMinutes}m en bus
                            </span>
                            <span className="tabular-nums text-[11px] font-bold" style={{ marginLeft: 'auto', color: 'var(--brand)' }}>
                              ${opt.route.fare?.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function RouteResultBar({
  navigationResult,
  selectedOptionIdx = 0,
  onSelectOptionIdx,
  onClear,
  onStartLiveNav,
}) {
  const options = navigationResult?.options || [];
  if (!navigationResult || options.length === 0) return null;

  const navKey = `${navigationResult?.origin?.lat || ''}-${navigationResult?.destination?.lat || ''}-${options.length}`;

  return (
    <RouteResultBarContent
      key={navKey}
      navigationResult={navigationResult}
      selectedOptionIdx={selectedOptionIdx}
      onSelectOptionIdx={onSelectOptionIdx}
      onClear={onClear}
      onStartLiveNav={onStartLiveNav}
    />
  );
}
