/**
 * ============================================
 * RutaQuilla - RouteResultBar v4 (Hoja de Resultados)
 * ============================================
 *
 * Tarjeta flotante inferior estilo Citymapper / Transit:
 * - Tiempo total protagonista en Geist Mono + tarifa
 * - Placa de bus con color de operador
 * - CTA sólido Mangle "Iniciar navegación"
 * - Selector desplegable de rutas alternativas
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
} from 'lucide-react';

function RouteResultBarContent({
  navigationResult,
  selectedOptionIdx,
  onSelectOptionIdx,
  onClear,
  onStartLiveNav,
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);

  const options = navigationResult.options;
  const selectedOpt = options[selectedOptionIdx] || options[0];
  const routeCol = selectedOpt.route.color || '#FFC21A';

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
      className="animate-slide-up rq-sheet"
      style={{
        '--route-color': routeCol,
        position: 'fixed',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        translate: '-50% 0',
        zIndex: 1200,
        width: 'calc(100% - 20px)',
        maxWidth: 448,
        overflow: 'hidden',
        maxHeight: showAll ? '58vh' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ height: 3, flexShrink: 0, background: routeCol }} />
      <div className="sheet-handle" />

      <div style={{ padding: '5px 12px 10px', flexShrink: 0 }}>
        {/* Encabezado: placas + nombre + bloque de tiempo y tarifa */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
              {selectedOpt.isOptimal && (
                <span
                  className="font-mono"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  <Star size={8} fill="currentColor" /> Óptima
                </span>
              )}
              {selectedOpt.isTransfer && (
                <span
                  className="font-mono"
                  style={{
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'var(--caribe-soft)',
                    color: 'var(--caribe)',
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  1 transbordo
                </span>
              )}
              {selectedOpt.transfer?.sistemasNoIntegrados && (
                <span
                  className="font-mono"
                  title="Transmetro y bus urbano cobran pasaje separado"
                  style={{
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'var(--brand-soft)',
                    color: 'var(--brand)',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  2 pasajes
                </span>
              )}
              <span
                className="font-mono"
                style={{
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: selectedOpt.direction === 'ida' ? 'var(--mangle-soft)' : 'var(--carnaval-soft)',
                  color: selectedOpt.direction === 'ida' ? 'var(--mangle)' : 'var(--carnaval)',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {selectedOpt.direction === 'ida' ? 'IDA' : 'VUELTA'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {selectedOpt.route.codigo && (
                <span className="transit-code flex-shrink-0">{selectedOpt.route.codigo}</span>
              )}
              <p
                className="font-display"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedOpt.isTransfer && selectedOpt.transfer?.secondRoute
                  ? `${selectedOpt.route.name || selectedOpt.route.nombre} → ${
                      selectedOpt.transfer.secondRoute.codigo ? `[${selectedOpt.transfer.secondRoute.codigo}] ` : ''
                    }${selectedOpt.transfer.secondRoute.name}`
                  : selectedOpt.route.name || selectedOpt.route.nombre}
              </p>
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, color: routeCol, margin: '2px 0 0' }}>
              {selectedOpt.isTransfer && selectedOpt.transfer?.secondRoute
                ? `${selectedOpt.route.company || selectedOpt.route.operador} + ${selectedOpt.transfer.secondRoute.company}`
                : selectedOpt.route.company || selectedOpt.route.operador}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                ~{selectedOpt.totalMinutes}
                <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 2 }}>min</span>
              </div>
              <div className="tabular-nums" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', marginTop: 3 }}>
                ${selectedOpt.route.fare?.toLocaleString()}
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Cerrar resultados"
              className="rq-icon-btn"
              style={{ width: 28, height: 28 }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Tira de tramos */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            padding: '7px 10px',
            borderRadius: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Footprints size={11} color="var(--caribe)" />
            <span className="tabular-nums" style={{ fontSize: 11, color: 'var(--caribe)', fontWeight: 600 }}>
              {selectedOpt.boardPoint.walkDistance} m
            </span>
          </div>
          <CornerDownRight size={10} style={{ color: 'var(--text-muted)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Bus size={11} color={routeCol} />
            <span className="tabular-nums" style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
              {selectedOpt.isTransfer && selectedOpt.transfer
                ? `${selectedOpt.route.name} (~${Math.max(1, selectedOpt.busMinutes - selectedOpt.transfer.secondBusMinutes)}m)`
                : `~${selectedOpt.busMinutes} min`}
            </span>
          </div>
          {selectedOpt.isTransfer && selectedOpt.transfer?.secondRoute && (
            <>
              <CornerDownRight size={10} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Footprints size={11} color="var(--caribe)" />
                <span className="tabular-nums" style={{ fontSize: 11, color: 'var(--caribe)', fontWeight: 600 }}>
                  {selectedOpt.transfer.walkDistance} m
                </span>
              </div>
              <CornerDownRight size={10} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Bus size={11} color={selectedOpt.transfer.secondRoute.color || '#3B8BF0'} />
                <span className="tabular-nums" style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
                  {selectedOpt.transfer.secondRoute.name} (~{selectedOpt.transfer.secondBusMinutes}m)
                </span>
              </div>
            </>
          )}
          <CornerDownRight size={10} style={{ color: 'var(--text-muted)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} color="var(--carnaval)" />
            <span className="tabular-nums" style={{ fontSize: 11, color: 'var(--carnaval)', fontWeight: 600 }}>
              {selectedOpt.alightPoint.walkDistance < 50 ? 'Directo' : `${selectedOpt.alightPoint.walkDistance} m`}
            </span>
          </div>
          <span className="tabular-nums" style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-muted)' }}>
            {selectedOpt.totalWalkMinutes}m a pie
          </span>
        </div>

        {/* Botón CTA Iniciar navegación */}
        {onStartLiveNav && (
          <button
            onClick={() => onStartLiveNav(selectedOpt)}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'var(--mangle)',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              boxShadow: 'var(--shadow-sm)',
              transition: 'filter 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'none';
            }}
          >
            <Navigation size={14} /> Iniciar navegación en vivo
          </button>
        )}

        {options.length > 1 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="rq-btn-ghost"
            style={{
              width: '100%',
              marginTop: 6,
              padding: '6px 10px',
              fontSize: 11.5,
            }}
          >
            {showAll ? (
              <>
                <ChevronUp size={13} /> Ocultar alternativas
              </>
            ) : (
              <>
                <ChevronDown size={13} /> Ver {options.length - 1} {options.length - 1 === 1 ? 'opción más' : 'opciones más'}
              </>
            )}
          </button>
        )}
      </div>

      {/* Alternativas */}
      {showAll && (
        <div
          className="animate-fade-in"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 14px 12px',
            borderTop: '1px solid var(--border-color)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="rq-section-label mb-2">Otras opciones sugeridas</div>

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
                      padding: '9px 11px',
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
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          ~{opt.totalMinutes} min
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
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Footprints size={10} color="var(--caribe)" />
                          <span className="tabular-nums" style={{ fontSize: 10, color: 'var(--caribe)' }}>
                            {opt.boardPoint.walkDistance} m
                          </span>
                        </div>
                        <CornerDownRight size={9} style={{ color: 'var(--text-muted)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Bus size={10} color={altCol} />
                          <span className="tabular-nums" style={{ fontSize: 10, color: 'var(--text-primary)' }}>
                            ~{opt.busMinutes} min
                          </span>
                        </div>
                        <CornerDownRight size={9} style={{ color: 'var(--text-muted)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={10} color="var(--carnaval)" />
                          <span className="tabular-nums" style={{ fontSize: 10, color: 'var(--carnaval)' }}>
                            {opt.alightPoint.walkDistance < 50 ? 'Directo' : `${opt.alightPoint.walkDistance} m`}
                          </span>
                        </div>
                        <span className="tabular-nums" style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>
                          ${opt.route.fare?.toLocaleString()}
                        </span>
                      </div>
                    )}
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
