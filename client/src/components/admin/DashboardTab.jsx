import { useState, useEffect, useRef } from 'react';
import { Users, Bus, MapPin, Clock, Activity, CheckCircle2, XCircle, AlertTriangle, TrendingUp, Zap, Trophy, Star } from 'lucide-react';
import { adminAPI, communityAPI } from '../../services/api';

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div style={{
      padding: '14px', borderRadius: 14,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
        <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );
}

function TrafficChart({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  if (!data?.length) return null;

  const W = 500, H = 130;
  const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  const peakIndex = data.reduce((best, d, i) => d.count > data[best].count ? i : best, 0);

  // Y-axis grid values
  const yTicks = [0, Math.round(max * 0.5), max];

  const toX = i => PAD.left + (i / (data.length - 1)) * innerW;
  const toY = v => PAD.top + innerH - (v / max) * innerH;

  // Build SVG path
  const points = data.map((d, i) => [toX(i), toY(d.count)]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${points[0][0].toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  // Hours to show on x-axis (every 4h)
  const xLabelIndices = [0, 6, 12, 18, 23];

  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width) - PAD.left;
    const idx = Math.round((mx / innerW) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHoverIndex(clamped);
    setTooltip({ x: toX(clamped), y: toY(data[clamped].count), d: data[clamped] });
  };

  const handleMouseLeave = () => { setTooltip(null); setHoverIndex(null); };

  return (
    <div style={{
      borderRadius: 16,
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Activity size={13} color="#F59E0B" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9', fontFamily: 'Outfit, sans-serif' }}>
            Tráfico API
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600, color: '#64748B',
            background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 6px',
          }}>24h</span>
          {/* Live pulse */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#10B981',
              boxShadow: '0 0 0 2px rgba(16,185,129,0.25)',
              animation: 'pulse 2s infinite',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 9, color: '#10B981', fontWeight: 600 }}>LIVE</span>
          </span>
        </div>
        {/* Summary pills */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)',
            borderRadius: 8, padding: '3px 8px',
          }}>
            <TrendingUp size={10} color="#F59E0B" />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B' }}>
              {total.toLocaleString('es-CO')} req
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)',
            borderRadius: 8, padding: '3px 8px',
          }}>
            <Zap size={10} color="#8B5CF6" />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6' }}>
              Pico: {data[peakIndex]?.count} @ {data[peakIndex]?.label}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ position: 'relative', padding: '0 14px 10px' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="tg-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="tg-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="1" />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines */}
          {yTicks.map(v => {
            const y = toY(v);
            return (
              <g key={v}>
                <line
                  x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1"
                  strokeDasharray={v === 0 ? 'none' : '4,4'}
                />
                <text
                  x={PAD.left - 5} y={y + 4}
                  textAnchor="end" fontSize="9" fill="#475569" fontFamily="Inter, sans-serif"
                >
                  {v}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#tg-area)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke="url(#tg-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Peak marker */}
          <circle
            cx={toX(peakIndex)} cy={toY(data[peakIndex].count)}
            r="4" fill="#F59E0B" stroke="#000" strokeWidth="1.5"
          />

          {/* X-axis labels */}
          {xLabelIndices.map(i => (
            <text
              key={i} x={toX(i)} y={H - 4}
              textAnchor="middle" fontSize="9" fill="#334155" fontFamily="Inter, sans-serif"
            >
              {data[i]?.label}
            </text>
          ))}

          {/* Hover line + dot */}
          {tooltip && hoverIndex !== null && (
            <>
              <line
                x1={tooltip.x} y1={PAD.top}
                x2={tooltip.x} y2={PAD.top + innerH}
                stroke="rgba(245,158,11,0.35)" strokeWidth="1" strokeDasharray="4,3"
              />
              <circle
                cx={tooltip.x} cy={tooltip.y}
                r="5" fill="#F59E0B" stroke="#0F172A" strokeWidth="2"
              />
            </>
          )}
        </svg>

        {/* Floating tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: `calc(${(tooltip.x / W) * 100}% + 6px)`,
            top: `${(tooltip.y / H) * 80}%`,
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            background: 'rgba(7,11,22,0.95)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 8,
            padding: '6px 10px',
            minWidth: 80,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}>
            <p style={{ margin: 0, fontSize: 9, color: '#64748B', fontWeight: 600 }}>{tooltip.d.label}</p>
            <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>
              {tooltip.d.count.toLocaleString('es-CO')}
            </p>
            <p style={{ margin: 0, fontSize: 9, color: '#475569' }}>requests</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [traffic, setTraffic] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [dashRes, trafficRes, lbRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getTraffic(),
        communityAPI.getLeaderboard(5),
      ]);
      setStats(dashRes.data);
      setTraffic(trafficRes.data || []);
      setLeaderboard(lbRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); const t = setInterval(loadData, 30000); return () => clearInterval(t); }, []);

  if (loading) return <p style={{ padding: 20, color: '#475569', fontSize: 12 }}>Cargando dashboard...</p>;
  if (!stats) return <p style={{ padding: 20, color: '#EF4444', fontSize: 12 }}>Error al cargar</p>;

  return (
    <div className="animate-fade-in" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard icon={<Users size={14} color="#06B6D4" />} label="Usuarios" value={stats.users.total} color="#06B6D4"
          sub={`${stats.users.active} activos (7d)`} />
        <StatCard icon={<Bus size={14} color="#F59E0B" />} label="Rutas oficiales" value={stats.routes.total} color="#F59E0B" />
        <StatCard icon={<MapPin size={14} color="#10B981" />} label="Capturas" value={stats.captures.total} color="#10B981"
          sub={`${stats.captures.pending} pendientes`} />
        <StatCard icon={<Clock size={14} color="#8B5CF6" />} label="Aprobadas" value={stats.captures.approved} color="#8B5CF6"
          sub={`${stats.captures.rejected} rechazadas`} />
      </div>

      <TrafficChart data={traffic} />

      {/* Leaderboard Quilla XP */}
      <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Trophy size={13} color="#F59E0B" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9', fontFamily: 'Outfit, sans-serif' }}>Ranking Quilla XP</span>
          </div>
          <span style={{ fontSize: 9, color: '#475569', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>TOP 5</span>
        </div>

        {leaderboard.length === 0 ? (
          <p style={{ fontSize: 11, color: '#475569', padding: '8px 14px 14px', margin: 0 }}>Sin contribuidores aún</p>
        ) : (
          <div style={{ padding: '0 14px 12px' }}>
            {leaderboard.map((u, i) => {
              const rankColors = ['#F59E0B', '#94A3B8', '#CD7F32', '#64748B', '#64748B'];
              const rankIcons = ['🥇', '🥈', '🥉', '4°', '5°'];
              const initials = u.name?.charAt(0)?.toUpperCase() || '?';
              const xpMax = leaderboard[0]?.xp || 1;
              const barW = Math.max(4, Math.round((u.xp / xpMax) * 100));
              return (
                <div key={u._id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 0',
                  borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  {/* Rank */}
                  <span style={{ fontSize: 12, width: 22, textAlign: 'center', flexShrink: 0 }}>{rankIcons[i]}</span>

                  {/* Avatar initial */}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: `${u.levelColor}22`,
                    border: `1.5px solid ${u.levelColor}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: u.levelColor,
                  }}>{initials}</div>

                  {/* Name + XP bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                        {u.name}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: u.levelColor, flexShrink: 0 }}>
                        {u.xp} XP
                      </span>
                    </div>
                    {/* XP progress bar */}
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ width: `${barW}%`, height: '100%', background: `linear-gradient(90deg, ${u.levelColor}99, ${u.levelColor})`, borderRadius: 2, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>

                  {/* Level badge */}
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: u.levelColor,
                    background: `${u.levelColor}15`, border: `1px solid ${u.levelColor}30`,
                    borderRadius: 6, padding: '2px 6px', flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {u.levelName}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User breakdown */}
      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>👥 Distribución de usuarios</p>
        {[
          { label: 'Free', count: stats.users.free, color: '#64748B' },
          { label: 'Premium', count: stats.users.premium, color: '#F59E0B' },
          { label: 'Admin', count: stats.users.admin, color: '#EF4444' },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
            <span style={{ fontSize: 11, color: '#94A3B8', flex: 1 }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.count}</span>
          </div>
        ))}
      </div>

      {/* Recent captures */}
      {stats.recentCaptures?.length > 0 && (
        <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>📡 Capturas recientes</p>
          {stats.recentCaptures.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < stats.recentCaptures.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {c.status === 'pending' ? <AlertTriangle size={11} color="#FBBF24" /> : c.status === 'approved' ? <CheckCircle2 size={11} color="#10B981" /> : <XCircle size={11} color="#EF4444" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, color: '#E2E8F0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.routeName}</p>
                <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>{c.userName} · {c.company}</p>
              </div>
              <span style={{ fontSize: 9, color: '#334155' }}>{new Date(c.createdAt).toLocaleDateString('es-CO')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
