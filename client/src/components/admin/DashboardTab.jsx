import { useState, useEffect, useRef } from 'react';
import { Users, Bus, MapPin, Clock, Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { adminAPI } from '../../services/api';

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
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Activity size={13} color="#F59E0B" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9' }}>Tráfico API (24h)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
        {data.map((d, i) => (
          <div key={i} title={`${d.label}: ${d.count} req`} style={{
            flex: 1, minWidth: 0,
            height: `${Math.max(2, (d.count / max) * 100)}%`,
            background: `linear-gradient(to top, rgba(245,158,11,0.6), rgba(245,158,11,0.15))`,
            borderRadius: '3px 3px 0 0',
            transition: 'height 0.3s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 8, color: '#334155' }}>{data[0]?.label}</span>
        <span style={{ fontSize: 8, color: '#334155' }}>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export default function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [traffic, setTraffic] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [dashRes, trafficRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getTraffic(),
      ]);
      setStats(dashRes.data);
      setTraffic(trafficRes.data || []);
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
