import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Bus,
  MapPin,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Zap,
  Trophy,
  Server,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { adminAPI, communityAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

function StatCard({ icon: Icon, label, value, color, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="rq-card text-left w-full"
      style={{
        padding: '13px 14px',
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="rq-section-label">{label}</span>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={14} />
        </div>
      </div>
      <p className="font-mono text-2xl font-bold tabular-nums m-0" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-1 mb-0 truncate" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </p>
      )}
    </Tag>
  );
}

function TrafficChart({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  if (!data?.length) return null;

  const W = 520;
  const H = 140;
  const PAD = { top: 14, right: 12, bottom: 26, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  const peakIndex = data.reduce((best, d, i) => (d.count > data[best].count ? i : best), 0);
  const yTicks = [0, Math.round(max * 0.5), max];

  const toX = (i) => PAD.left + (i / Math.max(1, data.length - 1)) * innerW;
  const toY = (v) => PAD.top + innerH - (v / max) * innerH;

  const points = data.map((d, i) => [toX(i), toY(d.count)]);
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${(
    PAD.top + innerH
  ).toFixed(1)} L${points[0][0].toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  const xLabelIndices = [0, 6, 12, 18, data.length - 1];

  const updatePointer = (clientX) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (clientX - rect.left) * (W / rect.width) - PAD.left;
    const idx = Math.round((mx / innerW) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHoverIndex(clamped);
    setTooltip({ x: toX(clamped), y: toY(data[clamped].count), d: data[clamped] });
  };

  return (
    <div className="rq-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap px-3.5 pt-3 pb-1.5">
        <div className="flex items-center gap-2">
          <Activity size={14} color="var(--brand)" />
          <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Tráfico API (24h)
          </span>
          <span
            className="inline-flex items-center gap-1 font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--mangle-soft)', color: 'var(--mangle)' }}
          >
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1 font-mono text-[10.5px] font-bold px-2 py-0.5 rounded"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            <TrendingUp size={10} />
            {total.toLocaleString('es-CO')} req
          </span>
          <span
            className="inline-flex items-center gap-1 font-mono text-[10.5px] font-bold px-2 py-0.5 rounded"
            style={{ background: 'var(--caribe-soft)', color: 'var(--caribe)' }}
          >
            <Zap size={10} />
            Pico {data[peakIndex]?.count} @ {data[peakIndex]?.label}
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', padding: '0 12px 10px' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
          onMouseMove={(e) => updatePointer(e.clientX)}
          onTouchMove={(e) => {
            if (e.touches[0]) updatePointer(e.touches[0].clientX);
          }}
          onMouseLeave={() => {
            setTooltip(null);
            setHoverIndex(null);
          }}
          onTouchEnd={() => {
            setTooltip(null);
            setHoverIndex(null);
          }}
        >
          <defs>
            <linearGradient id="rq-traffic-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFC21A" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#FFC21A" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((v) => {
            const y = toY(v);
            return (
              <g key={v}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  stroke="var(--border-color)"
                  strokeWidth="1"
                  strokeDasharray={v === 0 ? 'none' : '4,4'}
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--text-muted)"
                  fontFamily="var(--font-mono)"
                >
                  {v}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#rq-traffic-area)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={toX(peakIndex)}
            cy={toY(data[peakIndex].count)}
            r="4"
            fill="var(--brand)"
            stroke="var(--bg-card)"
            strokeWidth="1.5"
          />

          {xLabelIndices.map((i) => (
            <text
              key={i}
              x={toX(i)}
              y={H - 5}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
            >
              {data[i]?.label}
            </text>
          ))}

          {tooltip && hoverIndex !== null && (
            <>
              <line
                x1={tooltip.x}
                y1={PAD.top}
                x2={tooltip.x}
                y2={PAD.top + innerH}
                stroke="var(--brand)"
                strokeOpacity="0.4"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <circle
                cx={tooltip.x}
                cy={tooltip.y}
                r="5"
                fill="var(--brand)"
                stroke="var(--bg-card)"
                strokeWidth="2"
              />
            </>
          )}
        </svg>

        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(72, Math.max(8, (tooltip.x / W) * 100))}%`,
              top: 8,
              pointerEvents: 'none',
              background: 'var(--plate-bg)',
              color: '#F2EFE8',
              border: '1px solid rgba(255, 194, 26, 0.35)',
              borderRadius: 8,
              padding: '5px 9px',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
            }}
          >
            <div className="font-mono text-[9.5px]" style={{ color: '#A3A9B4' }}>
              {tooltip.d.label}
            </div>
            <div className="font-mono text-sm font-bold tabular-nums" style={{ color: '#FFC21A' }}>
              {tooltip.d.count.toLocaleString('es-CO')} req
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatUptime(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardTab({ refreshTick = 0, onNavigateTab }) {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [traffic, setTraffic] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [health, setHealth] = useState(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, trafficRes, lbRes, healthRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getTraffic(),
        communityAPI.getLeaderboard(5),
        adminAPI.getSystemHealth(),
      ]);
      setStats(dashRes.data);
      setTraffic(trafficRes.data || []);
      setLeaderboard(lbRes.data || []);
      setHealth(healthRes.data || null);
    } catch (e) {
      console.error('Error cargando dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, [loadData, refreshTick]);

  const handleClearCaches = async () => {
    setClearingCache(true);
    try {
      await adminAPI.clearCaches();
      toast.success('Cachés de mapas limpiadas');
      loadData();
    } catch (e) {
      toast.error(e.message || 'No se pudieron limpiar las cachés');
    } finally {
      setClearingCache(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={15} className="animate-spin" color="var(--brand)" />
        <span>Cargando métricas del sistema...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-xs" style={{ color: 'var(--carnaval)' }}>
        No se pudieron cargar las estadísticas de administración.
      </div>
    );
  }

  const cacheTotal = health?.caches
    ? Object.values(health.caches).reduce((s, n) => s + (Number(n) || 0), 0)
    : 0;

  return (
    <div className="animate-fade-in p-3 sm:p-4 space-y-3.5 max-w-[1200px] mx-auto">
      {/* KPIs principales */}
      <div className="admin-kpi-grid">
        <StatCard
          icon={Bus}
          label="Red de Rutas"
          value={stats.routes?.active ?? stats.routes?.total ?? 0}
          color="var(--brand)"
          sub={`${stats.routes?.total || 0} totales · ${stats.routes?.inactive || 0} pausadas`}
          onClick={() => onNavigateTab?.('routes', 'all')}
        />
        <StatCard
          icon={Users}
          label="Usuarios"
          value={stats.users?.total || 0}
          color="var(--caribe)"
          sub={`${stats.users?.active || 0} activos · ${stats.users?.premium || 0} Quilla-Pass`}
          onClick={() => onNavigateTab?.('users')}
        />
        <StatCard
          icon={MapPin}
          label="Capturas GPS"
          value={stats.captures?.total || 0}
          color="var(--mangle)"
          sub={`${stats.captures?.pending || 0} pendientes · ${stats.captures?.approved || 0} aprobadas`}
          onClick={() => onNavigateTab?.('captures')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Reportes en vivo"
          value={stats.reports?.activeNow ?? 0}
          color="var(--carnaval)"
          sub={`${stats.reports?.total || 0} históricos`}
          onClick={() => onNavigateTab?.('reports')}
        />
      </div>

      {/* Bandeja de atención rápida */}
      {(stats.captures?.pending > 0 || stats.routes?.needsAudit > 0 || stats.reports?.activeNow > 0 || stats.users?.suspended > 0) && (
        <div className="rq-card p-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="rq-section-label">Pendientes operativos</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {stats.captures?.pending > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab?.('captures')}
                className="rq-chip active"
              >
                <span>{stats.captures.pending} capturas por revisar</span>
                <ArrowRight size={11} />
              </button>
            )}
            {stats.routes?.needsAudit > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab?.('routes', 'audit')}
                className="rq-chip"
                style={{ color: 'var(--caribe)', borderColor: 'color-mix(in srgb, var(--caribe) 35%, var(--border-color))' }}
              >
                <span>{stats.routes.needsAudit} rutas por auditar</span>
                <ArrowRight size={11} />
              </button>
            )}
            {stats.reports?.activeNow > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab?.('reports')}
                className="rq-chip"
                style={{ color: 'var(--carnaval)', borderColor: 'color-mix(in srgb, var(--carnaval) 35%, var(--border-color))' }}
              >
                <span>{stats.reports.activeNow} incidencias activas</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tráfico + Salud del sistema */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <TrafficChart data={traffic} />
        </div>

        <div className="rq-card p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Server size={14} color="var(--mangle)" />
                <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  Salud del servidor
                </span>
              </div>
              <span
                className="font-mono text-[9.5px] font-bold px-2 py-0.5 rounded uppercase"
                style={{
                  background: health?.database?.status === 'connected' ? 'var(--mangle-soft)' : 'var(--carnaval-soft)',
                  color: health?.database?.status === 'connected' ? 'var(--mangle)' : 'var(--carnaval)',
                }}
              >
                {health?.database?.status === 'connected' ? 'Atlas OK' : health?.database?.status || 'N/A'}
              </span>
            </div>

            <div className="space-y-1.5 text-[11.5px]">
              <div className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Latencia MongoDB</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {health?.database?.latencyMs != null ? `${health.database.latencyMs} ms` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Memoria Heap / RSS</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {health?.memory ? `${health.memory.heapUsedMB} / ${health.memory.rssMB} MB` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tiempo activo</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {health ? formatUptime(health.uptimeSeconds) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span style={{ color: 'var(--text-secondary)' }}>Cachés en memoria</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--caribe)' }}>
                  {cacheTotal} entradas
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearCaches}
            disabled={clearingCache}
            className="rq-btn-ghost w-full text-[11.5px]"
            style={{ padding: '7px 10px' }}
          >
            <Trash2 size={12} color="var(--brand)" />
            <span>{clearingCache ? 'Limpiando...' : 'Vaciar cachés de mapas'}</span>
          </button>
        </div>
      </div>

      {/* Desglose de red + Leaderboard + Últimos eventos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Composición de la red */}
        <div className="rq-card p-3.5">
          <div className="rq-section-label mb-2.5">Composición de la red</div>
          <div className="space-y-2 text-[12px]">
            {[
              { label: 'Transmetro (BRT)', val: stats.routes?.masivo || 0, color: 'var(--caribe)' },
              { label: 'Buses Urbanos', val: stats.routes?.urbano || 0, color: 'var(--mangle)' },
              { label: 'Intermunicipales', val: stats.routes?.intermunicipal || 0, color: 'var(--brand)' },
              { label: 'Colab. en curso', val: (stats.composites?.building || 0) + (stats.composites?.complete || 0), color: 'var(--text-secondary)' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                </div>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {row.val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking Quilla XP */}
        <div className="rq-card p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Trophy size={13} color="var(--brand)" />
              <span className="rq-section-label">Top 5 Quilla XP</span>
            </div>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-xs m-0" style={{ color: 'var(--text-muted)' }}>
              Sin contribuidores aún
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((u, idx) => (
                <div key={u._id} className="flex items-center gap-2 text-[11.5px]">
                  <span className="font-mono font-bold w-4 text-center" style={{ color: 'var(--brand)' }}>
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {u.name}
                  </span>
                  <span className="font-mono text-[10.5px] font-bold tabular-nums" style={{ color: 'var(--mangle)' }}>
                    {u.xp} XP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bitácora reciente */}
        <div className="rq-card p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} color="var(--caribe)" />
              <span className="rq-section-label">Auditoría reciente</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('security')}
              className="text-[10.5px] font-semibold cursor-pointer bg-transparent border-none p-0"
              style={{ color: 'var(--brand)' }}
            >
              Ver todo
            </button>
          </div>
          {(stats.recentLogs || []).length === 0 ? (
            <p className="text-xs m-0" style={{ color: 'var(--text-muted)' }}>
              Sin acciones registradas aún
            </p>
          ) : (
            <div className="space-y-2">
              {(stats.recentLogs || []).slice(0, 5).map((log) => (
                <div key={log._id} className="text-[11px] leading-snug pb-1.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {log.summary || log.action}
                  </div>
                  <div className="text-[9.5px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {log.adminEmail} · {new Date(log.createdAt).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Capturas recientes */}
      {(stats.recentCaptures || []).length > 0 && (
        <div className="rq-card p-3.5">
          <div className="rq-section-label mb-2">Últimas capturas recibidas</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.recentCaptures.map((c, idx) => (
              <div
                key={c._id || idx}
                className="flex items-center gap-2.5 p-2 rounded-lg"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
              >
                {c.status === 'pending' ? (
                  <AlertTriangle size={13} color="var(--brand)" />
                ) : c.status === 'approved' ? (
                  <CheckCircle2 size={13} color="var(--mangle)" />
                ) : (
                  <XCircle size={13} color="var(--carnaval)" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {c.routeName}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {c.userName} · {c.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
